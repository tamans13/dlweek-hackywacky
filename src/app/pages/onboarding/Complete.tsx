import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { CheckCircle2, Brain } from "lucide-react";
import { useState } from "react";
import { useAppData } from "../../state/AppDataContext";

export default function OnboardingComplete() {
  const navigate = useNavigate();
  const { saveProfileData } = useAppData();
  const [submitting, setSubmitting] = useState(false);

  const handleGoDashboard = async () => {
    setSubmitting(true);
    try {
      const welcomeRaw = sessionStorage.getItem("onboarding_welcome");
      const prefRaw = sessionStorage.getItem("onboarding_preferences");
      const welcome = welcomeRaw ? JSON.parse(welcomeRaw) : {};
      const prefs = prefRaw ? JSON.parse(prefRaw) : {};
      const modules = String(prefs.modules || "")
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean);

      await saveProfileData({
        university: welcome.university || "",
        yearOfStudy: welcome.year || "",
        courseOfStudy: welcome.course || "",
        modules,
      });
      navigate("/dashboard");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-12">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
      </div>

      <div className="text-center space-y-3">
        <h1 className="text-4xl font-medium text-foreground">
          Analysis Complete
        </h1>
        <p className="text-lg text-muted-foreground">
          We've analyzed your responses to create your personalized study profile
        </p>
      </div>

      {/* AI Classification Result */}
      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="text-sm text-muted-foreground">Preliminary Study Persona</h3>
            <h2 className="text-2xl font-medium text-foreground">Analytical Burst Learner</h2>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-base text-foreground leading-relaxed">
            Based on your responses, you perform best with <span className="font-medium">focused, time-boxed study sessions</span> during 
            afternoon hours. You prefer active learning methods like practice questions and benefit from short breaks when 
            performance dips.
          </p>
          
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">Recommended Approach:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Schedule demanding topics between 2pm–6pm when you're most alert</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Use 40-60 minute focused sessions with 10-minute breaks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Prioritize active recall and practice problems over passive reading</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Monitor phone usage during study time to maintain focus</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground italic">
            This is not your finalized study persona. It may still be updated after observing your study patterns over time.
          </p>
        </div>
      </div>

      <Button
        onClick={handleGoDashboard}
        disabled={submitting}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-6 text-lg rounded-xl"
      >
        {submitting ? "Setting up..." : "Go to Dashboard"}
      </Button>
    </div>
  );
}
