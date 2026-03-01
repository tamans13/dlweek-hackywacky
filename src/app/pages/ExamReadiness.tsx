import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Calendar, CheckCircle2, ChevronDown } from "lucide-react";
import { useAppData } from "../state/AppDataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Checkbox } from "../components/ui/checkbox";
import { daysUntil, formatDate } from "../lib/format";
import { toSlug } from "../lib/ids";

export default function ExamReadiness() {
  const { state, readiness, loading, error, saveExamPlan } = useAppData();
  const moduleNames = state ? state.profile.modules : [];

  const [moduleName, setModuleName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [topicsTested, setTopicsTested] = useState<string[]>([]);
  const [topicsPopoverOpen, setTopicsPopoverOpen] = useState(false);

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
      setTopicsTested(plan.topicsTested || []);
    } else {
      setExamDate("");
      setTopicsTested([]);
    }
  }, [moduleName, state]);

  const moduleTopicOptions = useMemo(() => {
    if (!state || !moduleName) return [];
    return Object.keys(state.modules[moduleName]?.topics || {}).sort((a, b) => a.localeCompare(b));
  }, [state, moduleName]);

  useEffect(() => {
    setTopicsTested((prev) => prev.filter((topicName) => moduleTopicOptions.includes(topicName)));
  }, [moduleTopicOptions]);

  const topicsTriggerLabel = useMemo(() => {
    if (!topicsTested.length) return "Select topics";
    if (topicsTested.length <= 2) return topicsTested.join(", ");
    return `${topicsTested.length} topics selected`;
  }, [topicsTested]);

  const readinessByModule = useMemo(() => {
    if (!state) return [];
    return moduleNames.map((name) => {
      const ready = readiness.find((r) => r.moduleName === name);
      const examPlan = state.examPlans[name];
      const hasExamPlan = Boolean(examPlan?.examDate);
      const selectedTopics = hasExamPlan ? examPlan.topicsTested || [] : [];
      const attemptsByTopic = new Map<string, number[]>();
      state.quizAttempts
        .filter((q) => q.moduleName === name)
        .forEach((attempt) => {
          const list = attemptsByTopic.get(attempt.topicName) || [];
          list.push(attempt.postScore);
          attemptsByTopic.set(attempt.topicName, list);
        });
      const topicsTested = selectedTopics
        .map((topicName) => state.modules[name]?.topics?.[topicName])
        .filter(Boolean)
        .map((topic) => {
          const scores = attemptsByTopic.get(topic.topicName) || [];
          const mastery = scores.length
            ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
            : 0;
          return {
            name: topic.topicName,
            mastery,
            needsReview: mastery <= 50,
          };
        });

      return {
        moduleId: toSlug(name),
        moduleName: name,
        examDate: hasExamPlan ? examPlan.examDate : "",
        daysRemaining: hasExamPlan ? daysUntil(examPlan.examDate) : null,
        readiness: hasExamPlan ? ready?.score || 0 : 0,
        topicsTested,
      };
    });
  }, [state, moduleNames, readiness]);

  const handleSaveExam = async () => {
    if (!moduleName || !examDate) return;
    await saveExamPlan({
      moduleName,
      examDate,
      totalTopics: topicsTested.length,
      topicsCovered: topicsTested.length,
      topicsTested,
    });
  };
  const toggleTopic = (topicName: string, checked: boolean) => {
    setTopicsTested((prev) => {
      if (checked) return Array.from(new Set([...prev, topicName]));
      return prev.filter((topic) => topic !== topicName);
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
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h3 className="font-medium text-foreground">Update Exam Plan</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label>Exam Date</Label>
                <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Topics Tested</Label>
                <Popover open={topicsPopoverOpen} onOpenChange={setTopicsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">{topicsTriggerLabel}</span>
                      <ChevronDown className="w-4 h-4 ml-2 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[320px] p-3">
                    <div className="space-y-2">
                      {!moduleTopicOptions.length && (
                        <p className="text-sm text-muted-foreground">No topics available for this module.</p>
                      )}
                      {moduleTopicOptions.map((topicName) => (
                        <label key={topicName} className="flex items-center gap-2 text-sm text-foreground">
                          <Checkbox checked={topicsTested.includes(topicName)} onCheckedChange={(checked) => toggleTopic(topicName, checked === true)} />
                          <span>{topicName}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">Select all topics that are tested in this exam.</p>
              </div>
              <div className="space-y-2">
                <Label>Number of Topics</Label>
                <Input value={String(topicsTested.length)} readOnly className="bg-muted/50" />
              </div>
            </div>
            <Button onClick={handleSaveExam}>Save</Button>
          </div>
        </div>

        {readinessByModule.map((exam) => {
          const sortedTopics = [...exam.topicsTested].sort((a, b) => {
            if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
            return a.mastery - b.mastery;
          });

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
                    <span className="text-sm text-muted-foreground">{exam.examDate ? formatDate(exam.examDate) : "No exam plan yet"}</span>
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
                          <span className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive font-medium">Needs urgent review</span>
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
            <div className="text-sm text-muted-foreground">Topics Tested Need Review</div>
          </div>
        </div>
      </div>
    </div>
  );
}
