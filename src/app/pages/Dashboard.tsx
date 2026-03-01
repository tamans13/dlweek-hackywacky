import { AlertCircle, TrendingUp, Info } from "lucide-react";
import { useMemo } from "react";
import { avg } from "../lib/format";
import { useAppData } from "../state/AppDataContext";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Dashboard() {
  const { state, loading, error } = useAppData();

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  const moduleValues = state ? Object.values(state.modules) : [];
  const burnoutRisk = Math.round(avg(moduleValues.map((x) => x.burnoutRisk || 0)));
  const focusEfficiency = Math.round(avg(moduleValues.map((x) => x.focusEfficiency || 0)));

  const eventCounts = useMemo(() => {
    if (!state) return { learning: 0, distraction: 0, help: 0 };
    return state.tabEvents.reduce(
      (acc, evt) => {
        if (evt.eventType === "learning") acc.learning += 1;
        if (evt.eventType === "distraction") acc.distraction += 1;
        if (evt.eventType === "help") acc.help += 1;
        return acc;
      },
      { learning: 0, distraction: 0, help: 0 },
    );
  }, [state]);

  const currentMonthCalendar = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const firstWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const spacedRepDays = new Set<number>();
    const examDays = new Set<number>();

    if (state) {
      Object.values(state.modules).forEach((mod) => {
        Object.values(mod.topics).forEach((topic) => {
          const d = new Date(topic.nextReviewAt);
          if (d.getMonth() === m && d.getFullYear() === y) spacedRepDays.add(d.getDate());
        });
      });

      Object.values(state.examPlans).forEach((exam) => {
        const d = new Date(exam.examDate);
        if (d.getMonth() === m && d.getFullYear() === y) examDays.add(d.getDate());
      });
    }

    const cells: Array<{ date: number; spacedRep: boolean; exam: boolean; empty?: boolean }> = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ date: 0, spacedRep: false, exam: false, empty: true });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: day, spacedRep: spacedRepDays.has(day), exam: examDays.has(day) });
    }
    return cells;
  }, [state]);

  const getBurnoutColor = (risk: number) => {
    if (risk <= 40) return { color: "text-success", bgColor: "text-success", label: "Low" };
    if (risk <= 70) return { color: "text-warning", bgColor: "text-warning", label: "Moderate" };
    return { color: "text-destructive", bgColor: "text-destructive", label: "High" };
  };

  const burnoutColors = getBurnoutColor(burnoutRisk);

  if (loading && !state) {
    return <div className="p-8 text-muted-foreground">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-medium text-foreground">{greeting}.</h1>
          <p className="text-muted-foreground mt-0.5">Here&apos;s your learning overview</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground">Burnout Risk</h3>
              <button
                className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                title="Computed from study intensity, score volatility, and downtrend."
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center py-3">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - burnoutRisk / 100)}`}
                    className={`${burnoutColors.bgColor} transition-all`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <div className={`text-3xl font-medium ${burnoutColors.color}`}>{burnoutRisk}%</div>
                  <div className="text-xs text-muted-foreground">{burnoutColors.label}</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center mt-2">Sustainability across your modules</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground">Focus Efficiency</h3>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-3xl font-medium text-foreground">{focusEfficiency}%</div>
              <div className="text-sm text-muted-foreground">current score</div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Focused events</span>
                <span className="text-foreground font-medium">{eventCounts.learning}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distraction events</span>
                <span className="text-foreground font-medium">{eventCounts.distraction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Help events</span>
                <span className="text-foreground font-medium">{eventCounts.help}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground text-lg">
              {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-muted-foreground">Spaced Rep</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-muted-foreground">Exam</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground pb-2">
                {day}
              </div>
            ))}

            {currentMonthCalendar.map((day, index) => (
              <div
                key={`${day.date}-${index}`}
                className={`aspect-square border border-border rounded-lg p-2 transition-colors relative ${day.empty ? "bg-transparent border-transparent" : "hover:bg-muted/30"}`}
              >
                {!day.empty && <div className="text-sm text-foreground">{day.date}</div>}
                {!day.empty && (
                  <div className="absolute bottom-1 left-1 right-1 flex gap-1 justify-center">
                    {day.spacedRep && <div className="w-1.5 h-1.5 rounded-full bg-warning" />}
                    {day.exam && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
