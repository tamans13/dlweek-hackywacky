import { useState } from "react";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Shield, Trash2, AlertTriangle } from "lucide-react";

export default function Settings() {
  const [privacy, setPrivacy] = useState({
    trackSessions: true,
    classifyDistractions: true,
    aiAssistance: true,
    shareAnonymous: false,
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-2xl font-medium text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">
        {/* Privacy & Data Tracking */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground">Privacy & Data Tracking</h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="trackSessions">Track study sessions</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitor session duration, frequency, and timing patterns
                </p>
              </div>
              <Switch
                id="trackSessions"
                checked={privacy.trackSessions}
                onCheckedChange={(checked) =>
                  setPrivacy({ ...privacy, trackSessions: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="classifyDistractions">Classify distractions</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Categorize tab activity to calculate focus efficiency
                </p>
              </div>
              <Switch
                id="classifyDistractions"
                checked={privacy.classifyDistractions}
                onCheckedChange={(checked) =>
                  setPrivacy({ ...privacy, classifyDistractions: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="aiAssistance">AI-powered insights</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Use ML to predict readiness and provide recommendations
                </p>
              </div>
              <Switch
                id="aiAssistance"
                checked={privacy.aiAssistance}
                onCheckedChange={(checked) =>
                  setPrivacy({ ...privacy, aiAssistance: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="shareAnonymous">Share anonymous usage data</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Help improve Brainosaur by sharing anonymized learning patterns
                </p>
              </div>
              <Switch
                id="shareAnonymous"
                checked={privacy.shareAnonymous}
                onCheckedChange={(checked) =>
                  setPrivacy({ ...privacy, shareAnonymous: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Trash2 className="w-5 h-5 text-destructive" />
            <h3 className="font-medium text-foreground">Data Management</h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground mb-1">
                    Data deletion is permanent
                  </div>
                  <div className="text-sm text-muted-foreground">
                    This action cannot be undone. All your learning data, analytics, and 
                    progress will be permanently deleted.
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                Export My Data
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All My Data
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
