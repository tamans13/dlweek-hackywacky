import { Outlet, Link, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  BookOpen, 
  TrendingUp, 
  Target, 
  Settings as SettingsIcon,
  Brain,
  User
} from "lucide-react";

export default function DashboardLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    // For dashboard, only match exact path
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    // For other paths, match if pathname starts with path
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: BookOpen, label: "Modules", path: "/dashboard/modules" },
    { icon: TrendingUp, label: "Insights", path: "/dashboard/insights" },
    { icon: Target, label: "Exam Readiness", path: "/dashboard/exam-readiness" },
    { icon: User, label: "My Profile", path: "/dashboard/profile" },
    { icon: SettingsIcon, label: "Settings", path: "/dashboard/settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 bg-card border-r border-border flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
                  <h3 className="text-base font-medium text-foreground">Brainosaur</h3>
              <p className="text-xs text-muted-foreground">AI Learning Analytics</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
