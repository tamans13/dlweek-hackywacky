import { createBrowserRouter } from "react-router";
import DashboardLayout from "./components/DashboardLayout";
import OnboardingLayout from "./components/OnboardingLayout";
import Dashboard from "./pages/Dashboard";
import Modules from "./pages/Modules";
import ModuleDetail from "./pages/ModuleDetail";
import Insights from "./pages/Insights";
import ExamReadiness from "./pages/ExamReadiness";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import OnboardingWelcome from "./pages/onboarding/Welcome";
import OnboardingPreferences from "./pages/onboarding/Preferences";
import OnboardingPermissions from "./pages/onboarding/Permissions";
import OnboardingComplete from "./pages/onboarding/Complete";
import { Navigate } from "react-router";
import { hasAuthSession } from "./lib/api";

function RootRedirect() {
  return hasAuthSession() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function OnboardingGate() {
  return hasAuthSession() ? <Navigate to="/dashboard" replace /> : <OnboardingLayout />;
}

function DashboardGate() {
  return hasAuthSession() ? <DashboardLayout /> : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    path: "/login",
    element: hasAuthSession() ? <Navigate to="/dashboard" replace /> : <Login />,
  },
  {
    path: "/onboarding",
    element: <OnboardingGate />,
    children: [
      { index: true, element: <Navigate to="/onboarding/welcome" replace /> },
      { path: "welcome", Component: OnboardingWelcome },
      { path: "permissions", Component: OnboardingPermissions },
      { path: "preferences", Component: OnboardingPreferences },
      { path: "complete", Component: OnboardingComplete },
    ],
  },
  {
    path: "/dashboard",
    element: <DashboardGate />,
    children: [
      { index: true, Component: Dashboard },
      { path: "modules", Component: Modules },
      { path: "modules/:moduleId", Component: ModuleDetail },
      { path: "modules/:moduleId/topics/:topicId", lazy: async () => {
        const { default: TopicDetail } = await import("./pages/TopicDetail");
        return { Component: TopicDetail };
      }},
      { path: "insights", Component: Insights },
      { path: "exam-readiness", Component: ExamReadiness },
      { path: "settings", Component: Settings },
      { path: "profile", Component: Profile },
    ],
  },
]);
