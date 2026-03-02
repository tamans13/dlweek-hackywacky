import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useAppData } from "../../state/AppDataContext";
import { generateOnboardingPersona } from "../../lib/api";
import type { OnboardingPersonaAnalysis } from "../../lib/api";

const fallbackAnalysis: OnboardingPersonaAnalysis = {
  learningStyle: "Balanced Adaptive Learner",
  rationale: "Your responses suggest you benefit from structured sessions, active recall, and consistent review pacing.",
  studyTechniques: [
    {
      title: "Time-box your sessions",
      description: "Use fixed study blocks with short breaks to maintain focus and reduce fatigue.",
    },
    {
      title: "Active recall first",
      description: "Attempt questions before rereading notes so you can identify real knowledge gaps.",
    },
    {
      title: "Spaced repetition rhythm",
      description: "Revisit weak topics on a schedule instead of massed review right before exams.",
    },
    {
      title: "End-session checkpoint",
      description: "Write three key takeaways and one unclear concept to prioritize in the next session.",
    },
  ],
};

function readSessionJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function OnboardingComplete() {
  const navigate = useNavigate();
  const { signupUser, saveProfileData } = useAppData();
  const [submitting, setSubmitting] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState("");
  const [authError, setAuthError] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [analysis, setAnalysis] = useState<OnboardingPersonaAnalysis>(fallbackAnalysis);

  useEffect(() => {
    let cancelled = false;

    async function runPersonaGeneration() {
      setAnalysisLoading(true);
      setAnalysisError("");

      try {
        const welcome = readSessionJson<Record<string, unknown>>("onboarding_welcome", {});
        const prefs = readSessionJson<Record<string, unknown>>("onboarding_preferences", {});

        const result = await generateOnboardingPersona({ welcome, prefs });
        if (cancelled) return;

        setAnalysis(result.analysis);
        setAiEnabled(result.aiEnabled);
        sessionStorage.setItem("onboarding_persona", JSON.stringify(result.analysis));
      } catch (err) {
        if (cancelled) return;
        setAnalysis(fallbackAnalysis);
        setAnalysisError(err instanceof Error ? err.message : "Failed to generate AI persona.");
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    }

    void runPersonaGeneration();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoDashboard = async () => {
    setSubmitting(true);
    setAuthError("");
    try {
      const welcome = readSessionJson<Record<string, unknown>>("onboarding_welcome", {});
      const email = String(welcome.email || "").trim();
      const password = String(welcome.password || "");

      if (!email || !password) {
        throw new Error("Missing email/password from onboarding. Go back and enter credentials.");
      }

      await signupUser(email, password);

      const onboardingPersona = readSessionJson<OnboardingPersonaAnalysis>("onboarding_persona", analysis);

      await saveProfileData({
        fullName: String(welcome.fullName || welcome.name || ""),
        email,
        university: String(welcome.university || ""),
        yearOfStudy: String(welcome.year || ""),
        courseOfStudy: String(welcome.course || ""),
        modules: [],
        onboardingPersona,
      });
      navigate("/dashboard");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to sign up and save your profile.");
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
        <h1 className="text-4xl font-medium text-foreground">Analysis Complete</h1>
        <p className="text-lg text-muted-foreground">We&apos;ve analyzed your responses to create your personalized study profile</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-border bg-primary/10">
            <img src="/brainosaur.jpg" alt="Brainosaur dinosaur logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="text-sm text-muted-foreground">Preliminary Study Persona</h3>
            <h2 className="text-2xl font-medium text-foreground">
              {analysisLoading ? "Analyzing your responses..." : analysis.learningStyle}
            </h2>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-base text-foreground leading-relaxed">
            {analysisLoading ? "Generating personalized learning style and techniques using AI..." : analysis.rationale}
          </p>

          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">Recommended Approach:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {analysis.studyTechniques.map((technique) => (
                <li key={technique.title} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <span className="font-medium text-foreground">{technique.title}:</span> {technique.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {analysisError && (
            <p className="text-xs text-warning">
              AI persona unavailable ({analysisError}). Showing fallback recommendations.
            </p>
          )}

          {!analysisLoading && !analysisError && (
            <p className="text-xs text-muted-foreground">
              AI integration: {aiEnabled ? "enabled" : "not configured (heuristic mode)"}
            </p>
          )}

          {authError && (
            <p className="text-xs text-destructive">
              Authentication failed: {authError}
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground italic">
            This is not your finalized study persona. It may still be updated after observing your study patterns over time.
          </p>
        </div>
      </div>

      <Button
        onClick={handleGoDashboard}
        disabled={submitting || analysisLoading}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-6 text-lg rounded-xl"
      >
        {submitting ? "Setting up..." : "Go to Dashboard"}
      </Button>
    </div>
  );
}
