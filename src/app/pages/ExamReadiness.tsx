import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Calendar, CheckCircle2 } from "lucide-react";
import { useAppData } from "../state/AppDataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { daysUntil, formatDate } from "../lib/format";
import { toSlug } from "../lib/ids";

export default function ExamReadiness() {
  const { state, readiness, loading, error, saveExamPlan } = useAppData();
  const moduleNames = state ? state.profile.modules : [];

  const [moduleName, setModuleName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [totalTopics, setTotalTopics] = useState("");
  const [topicsCovered, setTopicsCovered] = useState("");

  useEffect(() => {
    if (!moduleName && moduleNames.length) {
      setModuleName(moduleNames[0]);
    }
  }, [moduleName, moduleNames]);

  useEffect(() => {
    if (!state || !moduleName) return;
    const plan = state.examPlans[moduleName];
    if (plan) {
      setExamDate(plan.examDate);
      setTotalTopics(String(plan.totalTopics));
      setTopicsCovered(String(plan.topicsCovered));
    } else {
      setExamDate("");
      setTotalTopics(String(Object.keys(state.modules[moduleName]?.topics || {}).length || 0));
      setTopicsCovered("0");
    }
  }, [moduleName, state]);

  const readinessByModule = useMemo(() => {
    if (!state) return [];
    return moduleNames.map((name) => {
      const ready = readiness.find((r) => r.moduleName === name);
      const moduleTopics = Object.values(state.modules[name]?.topics || {});
      const topicsTested = moduleTopics.map((topic) => {
        const mastery = Math.round(((topic.estimatedMasteryNow ?? topic.mastery) / 10) * 100);
        return {
          name: topic.topicName,
          mastery,
          needsReview: mastery <= 50,
        };
      });

      return {
        moduleId: toSlug(name),
        moduleName: name,
        examDate: state.examPlans[name]?.examDate || "",
        daysRemaining: state.examPlans[name]?.examDate ? daysUntil(state.examPlans[name].examDate) : null,
        readiness: ready?.score || 0,
        topicsTested,
      };
    });
  }, [state, moduleNames, readiness]);

  const handleSaveExam = async () => {
    if (!moduleName || !examDate) return;
    await saveExamPlan({
      moduleName,
      examDate,
      totalTopics: Number(totalTopics || 0),
      topicsCovered: Number(topicsCovered || 0),
    });
  };

  const getReadinessColor = (value: number) => {
    if (value >= 80) return "text-success";
    if (value >= 50) return "text-warning";
    return "text-destructive";
  };

  const getReadinessBgColor = (value: number) => {
    if (value >= 80) return "bg-success";
    if (value >= 50) return "bg-warning";
    return "bg-destructive";
  };

  if (loading && !state) {
    return <div className="p-8 text-muted-foreground">Loading exam readiness...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-medium text-foreground">Exam Readiness</h1>
          <p className="text-muted-foreground mt-0.5">Overview of upcoming exams and preparation status</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <h3 className="font-medium text-foreground">Update Exam Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-1">
              <Label>Module</Label>
              <Select value={moduleName} onValueChange={setModuleName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {moduleNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <Label>Exam Date</Label>
              <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </div>
            <div className="md:col-span-1">
              <Label>Total Topics</Label>
              <Input type="number" value={totalTopics} onChange={(e) => setTotalTopics(e.target.value)} />
            </div>
            <div className="md:col-span-1">
              <Label>Topics Covered</Label>
              <Input type="number" value={topicsCovered} onChange={(e) => setTopicsCovered(e.target.value)} />
            </div>
            <Button className="md:col-span-1" onClick={handleSaveExam}>Save Plan</Button>
          </div>
        </div>

        {readinessByModule.map((exam) => {
          const sortedTopics = [...exam.topicsTested].sort((a, b) => (a.needsReview === b.needsReview ? 0 : a.needsReview ? -1 : 1));

          return (
            <Link
              key={exam.moduleId}
              to={`/dashboard/modules/${exam.moduleId}`}
              className="block bg-card border border-border rounded-lg p-5 hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-medium text-foreground group-hover:text-primary transition-colors mb-2">{exam.moduleName}</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{exam.examDate ? formatDate(exam.examDate) : "No exam date"}</span>
                    {exam.daysRemaining !== null && (
                      <>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className={`text-sm font-medium ${exam.daysRemaining < 20 ? "text-destructive" : "text-foreground"}`}>
                          {exam.daysRemaining} days remaining
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-medium ${getReadinessColor(exam.readiness)}`}>{exam.readiness}%</div>
                  <div className="text-sm text-muted-foreground">Ready</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${getReadinessBgColor(exam.readiness)}`} style={{ width: `${exam.readiness}%` }} />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-foreground">Topics Tested</h4>
                </div>
                <div className="space-y-2">
                  {sortedTopics.length === 0 && <div className="text-sm text-muted-foreground">No topics yet.</div>}
                  {sortedTopics.map((topic, index) => (
                    <div
                      key={`${topic.name}-${index}`}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        topic.needsReview ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {topic.needsReview ? (
                          <div className="w-5 h-5 rounded-full border-2 border-destructive flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-destructive">!</span>
                          </div>
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-foreground">{topic.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${topic.mastery <= 50 ? "text-destructive" : topic.mastery < 80 ? "text-warning" : "text-success"}`}>
                          {topic.mastery}%
                        </span>
                        {topic.needsReview && (
                          <span className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive font-medium">Needs Urgent Review</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
          <div className="bg-card border border-border rounded-lg p-5 text-center">
            <div className="text-3xl font-medium text-foreground mb-1">
              {readinessByModule.length ? Math.round(readinessByModule.reduce((sum, exam) => sum + exam.readiness, 0) / readinessByModule.length) : 0}%
            </div>
            <div className="text-sm text-muted-foreground">Average Readiness</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-5 text-center">
            <div className="text-3xl font-medium text-foreground mb-1">
              {readinessByModule.filter((x) => x.daysRemaining !== null).sort((a, b) => (a.daysRemaining || 999) - (b.daysRemaining || 999))[0]?.daysRemaining ?? "-"}
            </div>
            <div className="text-sm text-muted-foreground">Days Until Next Exam</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-5 text-center">
            <div className="text-3xl font-medium text-foreground mb-1">
              {readinessByModule.reduce((sum, exam) => sum + exam.topicsTested.filter((t) => t.needsReview).length, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Topics Need Review</div>
          </div>
        </div>
      </div>
    </div>
  );
}
