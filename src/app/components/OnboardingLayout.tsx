import { Outlet } from "react-router";

export default function OnboardingLayout() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Outlet />
      </div>
    </div>
  );
}
