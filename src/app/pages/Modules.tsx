import { Link } from "react-router";
import { Plus, Calendar, TrendingUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { useAppData } from "../state/AppDataContext";
import { daysUntil, formatDate } from "../lib/format";
import { toSlug } from "../lib/ids";

export default function Modules() {
  const { state, loading, error, saveProfileData, dueQuizzes } = useAppData();

  if (loading && !state) {
    return <div className="p-8 text-muted-foreground">Loading modules...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  const moduleNames = state ? state.profile.modules : [];

  const moduleCards = moduleNames.map((name) => {
    const exam = state?.examPlans[name];
    const due = dueQuizzes.filter((x) => x.moduleName === name).length;
    return {
      id: toSlug(name),
      name,
      examDate: exam ? formatDate(exam.examDate) : "No exam date set",
      daysRemaining: exam ? daysUntil(exam.examDate) : null,
      tasksDue: due,
    };
  });

  const handleAddModule = async () => {
    if (!state) return;
    const moduleName = window.prompt("Add module name (e.g. CS2040 Data Structures)");
    if (!moduleName) return;

    const nextModules = Array.from(new Set([...moduleNames, moduleName.trim()])).filter(Boolean);
    await saveProfileData({
      university: state.profile.university,
      yearOfStudy: state.profile.yearOfStudy,
      courseOfStudy: state.profile.courseOfStudy,
      modules: nextModules,
    });
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medium text-foreground">Your Modules</h1>
              <p className="text-muted-foreground mt-0.5">Track mastery and progress across all subjects</p>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleAddModule}>
              <Plus className="w-4 h-4 mr-2" />
              Add Module
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {!moduleCards.length ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
            No modules yet. Add your first module to start tracking.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {moduleCards.map((module) => (
              <Link
                key={module.id}
                to={`/dashboard/modules/${module.id}`}
                className="block bg-card border border-border rounded-lg p-5 hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-foreground group-hover:text-primary transition-colors">{module.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {module.daysRemaining === null
                          ? module.examDate
                          : `${module.daysRemaining} days until ${module.examDate}`}
                      </span>
                    </div>
                  </div>
                </div>

                {module.tasksDue > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">
                      <span className="font-medium">{module.tasksDue}</span> review task{module.tasksDue !== 1 ? "s" : ""} due
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
