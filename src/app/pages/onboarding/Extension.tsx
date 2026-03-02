import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Download, ShieldCheck, TimerReset, BarChart3 } from "lucide-react";

export default function OnboardingExtension() {
  const navigate = useNavigate();
  const extensionUrl = useMemo(
    () => String(import.meta.env.VITE_CHROME_EXTENSION_URL || "https://chromewebstore.google.com/"),
    [],
  );

  const handleContinue = () => {
    navigate("/onboarding/preferences");
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-medium text-foreground">Install Chrome Extension</h2>
        <p className="text-lg text-muted-foreground">
          Brainosaur uses the extension to measure focused study activity accurately during active sessions.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground">
            Tracking only runs while you are in a study session. You stay in control and can stop tracking anytime.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <TimerReset className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground">
            It detects inactivity and helps auto-handle idle periods so study timing stays accurate.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <BarChart3 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground">
            This powers focus analytics, quiz readiness signals, and better recommendations for each topic.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="py-6 text-base"
          onClick={() => window.open(extensionUrl, "_blank", "noopener,noreferrer")}
        >
          <Download className="w-4 h-4 mr-2" />
          Download Extension
        </Button>
        <Button onClick={handleContinue} className="py-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
          Continue
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You can continue now and install the extension later from Settings.
      </p>
    </div>
  );
}
