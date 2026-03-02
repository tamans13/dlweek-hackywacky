import { Outlet, Link, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  BookOpen, 
  TrendingUp, 
  Target, 
  Settings as SettingsIcon,
  User,
  LogOut,
} from "lucide-react";
import { useAppData } from "../state/AppDataContext";

export default function DashboardLayout() {
  const location = useLocation();
  const { authUser, logout } = useAppData();

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
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-border bg-primary/10">
              <img src="/brainosaur.jpg" alt="Brainosaur dinosaur logo" className="w-full h-full object-cover" />
            </div>
            <div>
                  <h3 className="text-lg font-medium text-foreground">Brainosaur</h3>
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

        <div className="p-3 border-t border-border space-y-2">
          <div className="text-xs text-muted-foreground truncate px-2" title={authUser?.email || ""}>
            {authUser?.email || "Signed in"}
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
