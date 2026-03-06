import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { Calendar, CheckCircle2 } from "lucide-react";
import { useAppData } from "../state/AppDataContext";
import { EmptyState } from "../components/EmptyState";
import { daysUntil, formatDate } from "../lib/format";
import { toSlug } from "../lib/ids";

export default function ExamReadiness() {
  const { state, readiness, loading, error } = useAppData();
  const navigate = useNavigate();
  const moduleNames = state ? state.profile.modules : [];

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

  const nextExamDays = useMemo(() => {
    const upcoming = readinessByModule
      .filter((exam) => exam.daysRemaining !== null)
      .sort((a, b) => (a.daysRemaining || 999) - (b.daysRemaining || 999))[0];
    return upcoming?.daysRemaining ?? null;
  }, [readinessByModule]);

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
        {!moduleNames.length ? (
          <EmptyState
            illustration="chart"
            title="No exam readiness data yet"
            description="Complete quizzes or study sessions so Brainosaur can estimate your readiness."
            primaryActionLabel="Start Studying"
            onPrimaryAction={() => navigate("/dashboard/modules")}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-card border border-border rounded-lg p-4 space-y-2 md:col-span-2">
                <h3 className="font-medium text-foreground">Add Upcoming Exams</h3>
                <p className="text-sm text-muted-foreground">
                  To add an exam or midterm, go to the{" "}
                  <Link to="/dashboard/modules" className="font-medium text-primary hover:underline">
                    Module tab
                  </Link>{" "}
                  and select your module.
                </p>
              </div>

              <div className="rounded-lg p-4 bg-primary text-primary-foreground">
                <div className="text-sm text-primary-foreground/80">Days Until Next Exam</div>
                <div className="mt-1 text-3xl font-medium">{nextExamDays ?? "-"}</div>
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
          </>
        )}
      </div>
    </div>
  );
}
