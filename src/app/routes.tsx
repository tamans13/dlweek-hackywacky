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
import BrainosaursPage from "./pages/Brainosaurs";
import Login from "./pages/Login";
import OnboardingWelcome from "./pages/onboarding/Welcome";
import OnboardingPreferences from "./pages/onboarding/Preferences";
import OnboardingPermissions from "./pages/onboarding/Permissions";
import OnboardingExtension from "./pages/onboarding/Extension";
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
      { path: "extension", Component: OnboardingExtension },
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
      { path: "modules/:moduleId/topics/:topicId/visual-lab", lazy: async () => {
        const { default: VisualLab } = await import("./pages/VisualLab");
        return { Component: VisualLab };
      }},
      { path: "modules/:moduleId/topics/:topicId/spaced-review", lazy: async () => {
        const { default: SpacedReviewSession } = await import("./pages/SpacedReviewSession");
        return { Component: SpacedReviewSession };
      }},
      { path: "modules/:moduleId/topics/:topicId/quizzes/:quizId", lazy: async () => {
        const { default: TopicQuizSession } = await import("./pages/TopicQuizSession");
        return { Component: TopicQuizSession };
      }},
      { path: "insights", Component: Insights },
      { path: "exam-readiness", Component: ExamReadiness },
      { path: "brainosaurs", Component: BrainosaursPage },
      { path: "settings", Component: Settings },
      { path: "profile", Component: Profile },
    ],
  },
]);
