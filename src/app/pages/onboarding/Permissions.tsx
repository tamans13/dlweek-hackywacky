import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { Shield, Eye, Brain, Clock } from "lucide-react";

export default function OnboardingPermissions() {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState({
    trackSessions: true,
    detectInactivity: true,
    classifyActivity: true,
  });

  const handleContinue = () => {
    navigate("/onboarding/preferences");
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-medium text-foreground">
          Privacy & Tracking
        </h2>
        <p className="text-lg text-muted-foreground">
          We track study sessions and inactivity to improve your learning insights.
        </p>
      </div>

      {/* Privacy reassurance */}
      <div className="bg-accent/10 border border-accent/30 rounded-lg p-5 flex gap-3">
        <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-foreground">Your data is private and secure</h4>
          <p className="text-sm text-muted-foreground">
            All learning data is encrypted and stored locally. We never share your personal 
            information with third parties.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {/* Track study sessions */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex gap-4 flex-1">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-1 flex-1">
                <Label htmlFor="trackSessions" className="cursor-pointer text-base">
                  Track study sessions
                </Label>
                <p className="text-sm text-muted-foreground">
                  Monitor session duration, frequency, and timing patterns to optimize your schedule.
                </p>
              </div>
            </div>
            <Switch
              id="trackSessions"
              checked={permissions.trackSessions}
              onCheckedChange={(checked) => setPermissions({ ...permissions, trackSessions: checked })}
            />
          </div>
        </div>

        {/* Detect inactivity */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex gap-4 flex-1">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-1 flex-1">
                <Label htmlFor="detectInactivity" className="cursor-pointer text-base">
                  Detect inactivity (25-minute idle detection)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Alert you when cursor has been idle for 25 minutes to maintain focus accuracy.
                </p>
              </div>
            </div>
            <Switch
              id="detectInactivity"
              checked={permissions.detectInactivity}
              onCheckedChange={(checked) => setPermissions({ ...permissions, detectInactivity: checked })}
            />
          </div>
        </div>

        {/* Classify help/distraction */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex gap-4 flex-1">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-1 flex-1">
                <Label htmlFor="classifyActivity" className="cursor-pointer text-base">
                  Classify help/distraction
                </Label>
                <p className="text-sm text-muted-foreground">
                  Intelligently categorize tab activity as focused study, educational support, or distraction.
                </p>
              </div>
            </div>
            <Switch
              id="classifyActivity"
              checked={permissions.classifyActivity}
              onCheckedChange={(checked) => setPermissions({ ...permissions, classifyActivity: checked })}
            />
          </div>
        </div>
      </div>

      <Button
        onClick={handleContinue}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg"
      >
        Continue
      </Button>
    </div>
  );
}