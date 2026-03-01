import { useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, Calendar, TrendingDown, AlertCircle, CheckCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAppData } from "../state/AppDataContext";
import { fromSlugMatch, toSlug } from "../lib/ids";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

function toPct(value: number) {
  return Math.round((value / 10) * 100);
}

export default function TopicDetail() {
  const { moduleId, topicId } = useParams<{ moduleId: string; topicId: string }>();
  const { state, loading, error, submitQuizAttempt } = useAppData();
  const [form, setForm] = useState({ preScore: "", postScore: "", confidence: "3", aiUsed: false });
  const [resultMessage, setResultMessage] = useState("");

  const moduleNames = state ? state.profile.modules : [];

  const moduleName = fromSlugMatch(moduleId || "", moduleNames || []);
  const moduleState = moduleName && state ? state.modules[moduleName] : null;

  const topicNames = moduleState ? Object.keys(moduleState.topics) : [];
  const topicName = fromSlugMatch(topicId || "", topicNames);
  const topic = topicName && moduleState ? moduleState.topics[topicName] : null;

  const attempts = useMemo(() => {
    if (!state || !moduleName || !topicName) return [];
    return state.quizAttempts
      .filter((q) => q.moduleName === moduleName && q.topicName === topicName)
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  }, [state, moduleName, topicName]);

  const masteryTrend = useMemo(() => {
    if (!topic) return [];
    const historyPoints = topic.history.map((h) => ({
      date: new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      mastery: toPct(h.newMastery),
    }));
    if (!historyPoints.length) {
      return [
        {
          date: new Date(topic.lastInteractionAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          mastery: toPct(topic.estimatedMasteryNow ?? topic.mastery),
        },
      ];
    }
    return historyPoints;
  }, [topic]);

  const weaknesses = useMemo(() => {
    if (!topic) return [];
    const recentAttempts = attempts.slice(-5);
    const lowConfidence = recentAttempts.filter((a) => a.confidence <= 2).length;
    const dropCount = recentAttempts.filter((a) => a.postScore < a.preScore).length;
    const aiUsage = recentAttempts.filter((a) => a.aiUsed).length;
    const list: string[] = [];

    if (lowConfidence >= 2) list.push("Confidence is consistently low. Review core definitions before timed practice.");
    if (dropCount >= 1) list.push("Recent quizzes show regression; prioritize targeted remediation questions.");
    if (aiUsage >= 3) list.push("High AI-assist ratio detected. Add one no-assistance quiz to validate true mastery.");
    if (!list.length) list.push("No major weakness signal yet. Keep spaced repetition cadence.");
    return list;
  }, [attempts, topic]);

  const studySessions = useMemo(() => {
    if (!state || !moduleName || !topicName) return [];
    return state.studySessions
      .filter((s) => s.moduleName === moduleName && s.topicName === topicName && s.endAt)
      .slice(-6)
      .map((s) => {
        const mins = Math.max(1, Math.round((new Date(s.endAt as string).getTime() - new Date(s.startAt).getTime()) / 60000));
        return {
          date: new Date(s.startAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          duration: `${mins} min`,
        };
      });
  }, [state, moduleName, topicName]);

  const handleQuizSubmit = async () => {
    if (!moduleName || !topicName) return;
    const pre = Number(form.preScore);
    const post = Number(form.postScore);
    const confidence = Number(form.confidence);
    if (Number.isNaN(pre) || Number.isNaN(post)) return;

    const result = await submitQuizAttempt({
      moduleName,
      topicName,
      preScore: pre,
      postScore: post,
      confidence,
      aiUsed: form.aiUsed,
    });

    setResultMessage(
      `Mastery updated ${result.oldMastery.toFixed(2)} -> ${result.newMastery.toFixed(2)} (gain ${result.gain.toFixed(2)}, decay ${result.decay.toFixed(2)})`,
    );
    setForm({ preScore: "", postScore: "", confidence: "3", aiUsed: false });
  };

  if (loading && !state) {
    return <div className="p-8 text-muted-foreground">Loading topic...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  if (!topic || !moduleName || !moduleState || !topicName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-medium text-foreground mb-2">Topic not found</h2>
          <Link to="/dashboard" className="text-primary hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const masteryNow = topic.estimatedMasteryNow ?? topic.mastery;
  const masteryPct = toPct(masteryNow);
  const retentionDecay = Math.max(0, Math.round((topic.mastery - masteryNow) * 10));
  const risk = retentionDecay > 30 ? "high" : retentionDecay > 12 ? "medium" : "low";

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link
            to={`/dashboard/modules/${toSlug(moduleName)}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {moduleName}
          </Link>
          <h1 className="text-3xl font-medium text-foreground">{topicName}</h1>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mastery:</span>
              <span className="text-lg font-medium text-foreground">{masteryPct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Decay:</span>
              <span className={`text-lg font-medium ${risk === "high" ? "text-destructive" : risk === "medium" ? "text-warning" : "text-success"}`}>
                {retentionDecay}%
              </span>
            </div>
            <span className={`text-xs px-3 py-1.5 rounded ${risk === "high" ? "bg-destructive/10 text-destructive" : risk === "medium" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
              {risk === "high" ? "High Risk" : risk === "medium" ? "Medium Risk" : "Low Risk"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-1">
              <Label>Pre-Quiz</Label>
              <Input type="number" min="0" max="100" value={form.preScore} onChange={(e) => setForm((x) => ({ ...x, preScore: e.target.value }))} />
            </div>
            <div className="md:col-span-1">
              <Label>Post-Quiz</Label>
              <Input type="number" min="0" max="100" value={form.postScore} onChange={(e) => setForm((x) => ({ ...x, postScore: e.target.value }))} />
            </div>
            <div className="md:col-span-1">
              <Label>Confidence (1-5)</Label>
              <Input type="number" min="1" max="5" value={form.confidence} onChange={(e) => setForm((x) => ({ ...x, confidence: e.target.value }))} />
            </div>
            <label className="md:col-span-1 text-sm flex items-center gap-2">
              <input type="checkbox" checked={form.aiUsed} onChange={(e) => setForm((x) => ({ ...x, aiUsed: e.target.checked }))} />
              Used AI help
            </label>
            <Button className="md:col-span-1" onClick={handleQuizSubmit}>Submit Quiz</Button>
          </div>
          {resultMessage && <p className="text-sm text-primary mt-3">{resultMessage}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground text-lg">Mastery Trend</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={masteryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.5rem",
                  }}
                />
                <Line type="monotone" dataKey="mastery" stroke="var(--color-primary)" strokeWidth={2} dot={{ fill: "var(--color-primary)", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground text-lg">Specific Weaknesses</h3>
            </div>
            <div className="space-y-3">
              {weaknesses.map((weakness, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                  <p className="text-sm text-foreground">{weakness}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground text-lg">Quiz Performance History</h3>
          </div>
          <div className="space-y-3">
            {!attempts.length && <div className="text-sm text-muted-foreground">No quiz attempts yet for this topic.</div>}
            {attempts.map((quiz) => (
              <div key={quiz.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-foreground">{quiz.nextQuizType}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(quiz.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-medium text-foreground">{quiz.postScore}%</span>
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`${quiz.postScore >= 80 ? "bg-success" : quiz.postScore >= 60 ? "bg-warning" : "bg-destructive"} h-full`} style={{ width: `${quiz.postScore}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground text-lg">Topic Schedule</h3>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Upcoming Reviews</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                <div className="text-sm font-medium text-muted-foreground w-24 flex-shrink-0">
                  {new Date(topic.nextReviewAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
                <div className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                <div className="font-medium text-foreground">Spaced Repetition Review</div>
              </div>
              {state?.examPlans[moduleName] && (
                <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <div className="text-sm font-medium text-muted-foreground w-24 flex-shrink-0">
                    {new Date(state.examPlans[moduleName].examDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                  <div className="font-medium text-foreground">Module Exam</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Past Study Sessions</h4>
            <div className="space-y-2">
              {!studySessions.length && <div className="text-sm text-muted-foreground">No completed study sessions yet.</div>}
              {studySessions.map((session, index) => (
                <div key={`${session.date}-${index}`} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="text-sm font-medium text-foreground">{session.date}</div>
                  <div className="text-sm text-muted-foreground">{session.duration}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
