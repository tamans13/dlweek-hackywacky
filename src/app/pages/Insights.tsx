import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Clock, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useAppData } from "../state/AppDataContext";
import { EmptyState } from "../components/EmptyState";

export default function Insights() {
  const { state, loading, error, runInsights } = useAppData();
  const navigate = useNavigate();
  const [insightSummary, setInsightSummary] = useState("");
  const [insightActions, setInsightActions] = useState<string[]>([]);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightBootstrapped, setInsightBootstrapped] = useState(false);

  const accuracyByTimeData = useMemo(() => {
    if (!state) return [];
    const buckets: Record<number, { total: number; count: number }> = {};
    state.quizAttempts.forEach((attempt) => {
      const h = new Date(attempt.submittedAt).getHours();
      if (!buckets[h]) buckets[h] = { total: 0, count: 0 };
      buckets[h].total += attempt.postScore;
      buckets[h].count += 1;
    });
    return Object.entries(buckets)
      .map(([hour, vals]) => ({
        time: `${hour.padStart(2, "0")}:00`,
        accuracy: Math.round(vals.total / vals.count),
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [state]);

  const sessionLengthData = useMemo(() => {
    if (!state) return [];
    const bins = [15, 30, 45, 60, 90, 120];
    const groups = bins.map((bin) => ({ length: `${bin}min`, retention: 0, count: 0 }));

    state.studySessions
      .filter((s) => s.endAt)
      .forEach((session) => {
        const mins = Math.max(1, Math.round((new Date(session.endAt as string).getTime() - new Date(session.startAt).getTime()) / 60000));
        const closest = groups.reduce((best, cur) => {
          const curDist = Math.abs(parseInt(cur.length, 10) - mins);
          const bestDist = Math.abs(parseInt(best.length, 10) - mins);
          return curDist < bestDist ? cur : best;
        }, groups[0]);

        const attempts = state.quizAttempts.filter((q) => q.moduleName === session.moduleName && q.topicName === session.topicName);
        const avgScore = attempts.length ? attempts.reduce((sum, a) => sum + a.postScore, 0) / attempts.length : 0;
        closest.retention += avgScore;
        closest.count += 1;
      });

    return groups.map((g) => ({
      length: g.length,
      retention: g.count ? Math.round(g.retention / g.count) : 0,
    }));
  }, [state]);

  const burnoutTrendData = useMemo(() => {
    if (!state) return [];
    const trend = Array.isArray(state.burnoutTrend) ? state.burnoutTrend : [];
    const points = trend
      .map((item) => {
        const atMs = new Date(item.at).getTime();
        if (!Number.isFinite(atMs)) return null;
        const date = new Date(atMs);
        const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return {
          period: label,
          score: Math.round(Number(item.score || 0)),
          at: item.at,
        };
      })
      .filter((item): item is { period: string; score: number; at: string } => Boolean(item))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(-30);

    if (points.length) return points;

    const risks = Object.values(state.modules).map((module) => Number(module.burnoutRisk || 0));
    if (!risks.length) return [];
    const averageRisk = Math.round(risks.reduce((sum, value) => sum + value, 0) / risks.length);
    const today = new Date();
    return [{
      period: today.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      score: averageRisk,
      at: today.toISOString(),
    }];
  }, [state]);

  const focusScore = useMemo(() => {
    if (!state) return 0;
    const values = Object.values(state.modules).map((x) => x.focusEfficiency || 0);
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  }, [state]);

  const burnoutScore = useMemo(() => {
    if (burnoutTrendData.length) return burnoutTrendData[burnoutTrendData.length - 1].score;
    if (!state) return 0;
    const values = Object.values(state.modules).map((x) => x.burnoutRisk || 0);
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  }, [state, burnoutTrendData]);

  const peakRange = useMemo(() => {
    if (!accuracyByTimeData.length) return "No data";
    const best = [...accuracyByTimeData].sort((a, b) => b.accuracy - a.accuracy)[0];
    const hour = Number(best.time.slice(0, 2));
    return `${hour}:00 - ${hour + 2}:00`;
  }, [accuracyByTimeData]);

  const handleGenerateInsights = async () => {
    setInsightLoading(true);
    try {
      const insights = await runInsights();
      setInsightSummary(insights.summary);
      setInsightActions(insights.actions || []);
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    if (!state || insightBootstrapped) return;
    setInsightBootstrapped(true);
    void handleGenerateInsights();
  }, [state, insightBootstrapped]);

  if (loading && !state) {
    return <div className="p-8 text-muted-foreground">Loading insights...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  const hasData = state && (state.quizAttempts.length > 0 || state.studySessions.length > 0);

  if (!hasData) {
    return (
      <div className="min-h-screen">
        <div className="border-b border-border bg-card">
          <div className="max-w-6xl mx-auto px-6 py-5">
            <h1 className="text-2xl font-medium text-foreground">Learning Insights</h1>
            <p className="text-muted-foreground mt-0.5">Analytics on your study patterns and performance</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <EmptyState
            illustration="brain"
            title="No insights available yet"
            description="Study a bit more and Brainosaur will start generating insights about your strengths and weaknesses."
            primaryActionLabel="Go to Modules"
            onPrimaryAction={() => navigate("/dashboard/modules")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-medium text-foreground">Learning Insights</h1>
              <p className="text-muted-foreground mt-0.5">Analytics on your study patterns and performance</p>
            </div>
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Burnout risk: intensity + volatility trend. Focus efficiency: focused vs distracted behavior weighted by quiz accuracy."
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
          {insightLoading && (
            <div className="mt-4 text-sm text-muted-foreground">Generating personalized insights...</div>
          )}
          {!!insightSummary && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
              <div>
                <div className="text-xs font-semibold tracking-wide text-primary uppercase mb-1">
                  AI Summary
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {insightSummary}
                </p>
              </div>

              {insightActions.length > 0 && (
                <div className="pt-3 border-t border-primary/20">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase mb-2">
                    Priority actions for this week
                  </div>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    {insightActions.map((item, idx) => (
                      <li key={`${item}-${idx}`} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-card border border-border rounded-lg p-5 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.01] hover:border-primary/30 transition-all duration-200 cursor-default">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground text-lg">Peak Performance Time</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={accuracyByTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="time" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "0.5rem" }} />
                  <Line type="monotone" dataKey="accuracy" stroke="var(--color-primary)" strokeWidth={2} dot={{ fill: "var(--color-primary)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div className="p-5 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-2">Your Peak Range</div>
                <div className="text-3xl font-medium text-primary mb-2">{peakRange}</div>
                <div className="text-sm text-muted-foreground">Schedule difficult topics in this window.</div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                Focus efficiency: <span className="font-medium text-foreground">{focusScore}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.01] hover:border-primary/30 transition-all duration-200 cursor-default">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground text-lg">Study Length vs Retention</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sessionLengthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="length" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "0.5rem" }} />
              <Bar dataKey="retention" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.01] hover:border-primary/30 transition-all duration-200 cursor-default">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground text-lg">Burnout Trend</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={burnoutTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="period" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "0.5rem" }} />
                  <Line type="monotone" dataKey="score" stroke="var(--color-warning)" strokeWidth={2} dot={{ fill: "var(--color-warning)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div className="p-5 bg-success/10 border border-success/20 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-2">Current Risk Level</div>
                <div className="text-3xl font-medium text-success mb-2">{burnoutScore}%</div>
                <div className="text-sm text-muted-foreground">{burnoutScore > 70 ? "High risk" : burnoutScore > 40 ? "Moderate risk" : "Low risk"}</div>
              </div>
            </div>
          </div>
        </div>

        <Link
          to="/dashboard/profile#study-techniques"
          className="block bg-primary/5 border-2 border-primary/30 rounded-lg p-6 hover:bg-primary/10 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] hover:border-primary/60 transition-all duration-200 group"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-foreground text-lg mb-2 group-hover:text-primary transition-colors">Recommended Study Techniques</h3>
              <p className="text-sm text-muted-foreground">View personalized learning strategies and study methods tailored to your behavior patterns</p>
            </div>
            <ArrowRight className="w-6 h-6 text-primary group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
}
