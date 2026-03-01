import { AlertCircle, TrendingUp, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { avg } from "../lib/format";
import { useAppData } from "../state/AppDataContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type CalendarView = "month" | "week" | "day";
type CalendarEventType = "spacedRep" | "exam";

interface CalendarEvent {
  id: string;
  dateKey: string;
  moduleName: string;
  type: CalendarEventType;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateKeyFromIso(iso: string) {
  return String(iso).slice(0, 10);
}

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
}

export default function Dashboard() {
  const { state, loading, error } = useAppData();
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    return now;
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

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

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    if (!state) return [];
    const events: CalendarEvent[] = [];
    Object.entries(state.modules).forEach(([moduleName, moduleState]) => {
      Object.values(moduleState.topics).forEach((topic) => {
        events.push({
          id: `spaced-${moduleName}-${topic.topicName}-${topic.nextReviewAt}`,
          dateKey: dateKeyFromIso(topic.nextReviewAt),
          moduleName,
          type: "spacedRep",
        });
      });
    });

    Object.entries(state.examPlans).forEach(([moduleName, plan]) => {
      if (!plan.examDate) return;
      events.push({
        id: `exam-${moduleName}-${plan.examDate}`,
        dateKey: dateKeyFromIso(plan.examDate),
        moduleName,
        type: "exam",
      });
    });

    return events.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
      if (a.type !== b.type) return a.type === "exam" ? 1 : -1;
      return a.moduleName.localeCompare(b.moduleName);
    });
  }, [state]);

  const eventsByDate = useMemo(() => {
    const mapped: Record<string, CalendarEvent[]> = {};
    calendarEvents.forEach((event) => {
      if (!mapped[event.dateKey]) mapped[event.dateKey] = [];
      mapped[event.dateKey].push(event);
    });
    return mapped;
  }, [calendarEvents]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(calendarCursor);
    const monthEnd = endOfMonth(calendarCursor);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
    const days: Date[] = [];
    for (let day = new Date(gridStart); day <= gridEnd; day = addDays(day, 1)) {
      days.push(new Date(day));
    }
    return days;
  }, [calendarCursor]);

  const weekDaysInView = useMemo(() => {
    const weekStart = startOfWeek(calendarCursor);
    return Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx));
  }, [calendarCursor]);
  const activeDayEvents = selectedDayKey ? eventsByDate[selectedDayKey] || [] : [];
  const displayLabel = useMemo(() => {
    if (calendarView === "month") {
      return calendarCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    if (calendarView === "week") {
      const start = weekDaysInView[0];
      const end = weekDaysInView[6];
      return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return calendarCursor.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }, [calendarView, calendarCursor, weekDaysInView]);

  const getBurnoutColor = (risk: number) => {
    if (risk <= 40) return { color: "text-[#22C55E]", strokeColor: "text-[#22C55E]", label: "Low" };
    if (risk <= 70) return { color: "text-[#F59E0B]", strokeColor: "text-[#F59E0B]", label: "Moderate" };
    return { color: "text-[#EF4444]", strokeColor: "text-[#EF4444]", label: "High" };
  };

  const burnoutColors = getBurnoutColor(burnoutRisk);
  const moveCalendar = (dir: -1 | 1) => {
    setCalendarCursor((prev) => {
      if (calendarView === "month") return addMonths(prev, dir);
      if (calendarView === "week") return addDays(prev, dir * 7);
      return addDays(prev, dir);
    });
  };

  const eventClasses = (type: CalendarEventType) =>
    type === "exam"
      ? "bg-orange-300 text-black"
      : "bg-blue-100 text-blue-800";

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
                    className={`${burnoutColors.strokeColor} transition-all`}
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
            <div className="flex items-center gap-3">
              <h3 className="font-medium text-foreground text-lg">{displayLabel}</h3>
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                {(["month", "week", "day"] as CalendarView[]).map((view) => (
                  <button
                    key={view}
                    onClick={() => setCalendarView(view)}
                    className={`px-3 py-1.5 text-xs capitalize transition-colors ${calendarView === view ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => moveCalendar(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => moveCalendar(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Spaced Rep</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-400" />
                <span className="text-muted-foreground">Exam</span>
              </div>
            </div>
          </div>

          {calendarView === "month" && (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground pb-2">
                  {day}
                </div>
              ))}

              {monthDays.map((day) => {
                const dateKey = dateKeyFromDate(day);
                const dayEvents = eventsByDate[dateKey] || [];
                const previewEvents = dayEvents.slice(0, 2);
                const overflowCount = Math.max(0, dayEvents.length - previewEvents.length);
                const isOutsideMonth = day.getMonth() !== calendarCursor.getMonth();
                return (
                  <div
                    key={dateKey}
                    className={`min-h-[110px] border border-border rounded-lg p-2 transition-colors ${isOutsideMonth ? "bg-muted/20" : "hover:bg-muted/30"}`}
                  >
                    <button className={`text-sm ${isOutsideMonth ? "text-muted-foreground" : "text-foreground"}`} onClick={() => setSelectedDayKey(dateKey)}>
                      {day.getDate()}
                    </button>
                    <div className="mt-1.5 space-y-1">
                      {previewEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedDayKey(dateKey)}
                          className={`w-full text-left text-[11px] px-2 py-1 rounded ${eventClasses(event.type)}`}
                        >
                          {event.moduleName}
                        </button>
                      ))}
                      {overflowCount > 0 && (
                        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedDayKey(dateKey)}>
                          +{overflowCount} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {calendarView === "week" && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {weekDaysInView.map((day) => {
                const dateKey = dateKeyFromDate(day);
                const dayEvents = eventsByDate[dateKey] || [];
                const previewEvents = dayEvents.slice(0, 4);
                const overflowCount = Math.max(0, dayEvents.length - previewEvents.length);
                return (
                  <div key={dateKey} className="border border-border rounded-lg p-2 min-h-[160px]">
                    <button className="text-sm font-medium text-foreground" onClick={() => setSelectedDayKey(dateKey)}>
                      {weekDays[day.getDay()]} {day.getDate()}
                    </button>
                    <div className="mt-2 space-y-1">
                      {previewEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedDayKey(dateKey)}
                          className={`w-full text-left text-xs px-2 py-1 rounded ${eventClasses(event.type)}`}
                        >
                          {event.moduleName}
                        </button>
                      ))}
                      {overflowCount > 0 && (
                        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedDayKey(dateKey)}>
                          +{overflowCount} more
                        </button>
                      )}
                      {!dayEvents.length && <p className="text-xs text-muted-foreground">No events</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {calendarView === "day" && (
            <div className="border border-border rounded-lg p-4">
              <button className="text-sm font-medium text-foreground mb-3" onClick={() => setSelectedDayKey(dateKeyFromDate(calendarCursor))}>
                {calendarCursor.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </button>
              <div className="space-y-2">
                {(eventsByDate[dateKeyFromDate(calendarCursor)] || []).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedDayKey(dateKeyFromDate(calendarCursor))}
                    className={`w-full text-left text-sm px-3 py-2 rounded ${eventClasses(event.type)}`}
                  >
                    {event.moduleName}
                  </button>
                ))}
                {!(eventsByDate[dateKeyFromDate(calendarCursor)] || []).length && <p className="text-sm text-muted-foreground">No events for this day.</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(selectedDayKey)} onOpenChange={(open) => !open && setSelectedDayKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDayKey
                ? dateFromKey(selectedDayKey).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Day Events"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {!activeDayEvents.length && <p className="text-sm text-muted-foreground">No events for this day.</p>}
            {activeDayEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2">
                <span className="text-sm text-foreground">{event.moduleName}</span>
                <span className={`text-xs px-2 py-1 rounded ${eventClasses(event.type)}`}>{event.type === "exam" ? "Exam" : "Spaced Rep"}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
