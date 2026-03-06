import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { User, Edit2, Save } from "lucide-react";
import { useAppData } from "../state/AppDataContext";
import { getPersonaStorageKeys, PROFILE_FLASH_KEY } from "../lib/persona";
import { brainotypeById } from "../lib/brainotypes";
import { BrainotypeResult, learningStyleLabels, readBrainotypeResult } from "../lib/brainotype-scoring";

const defaultPersona = {
  learningStyle: "Adaptive Mixed Learner",
  rationale: "Complete more study sessions and quizzes to generate a higher-confidence persona.",
  studyTechniques: [
    {
      title: "Time-Boxing Method",
      description: "Use 30-60 minute focused blocks with short recovery breaks.",
    },
    {
      title: "Active Recall First",
      description: "Attempt questions before reviewing notes to expose real weaknesses.",
    },
    {
      title: "Spaced Review Priority",
      description: "Clear due spaced-repetition topics before new content.",
    },
  ],
};

export default function Profile() {
  const { state, loading, error, saveProfileData, authUser } = useAppData();
  const [isEditing, setIsEditing] = useState(false);
  const [highlightPersonaCard, setHighlightPersonaCard] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    school: "",
    course: "",
    year: "",
    modules: "",
  });
  const [brainotypeResult, setBrainotypeResult] = useState<BrainotypeResult | null>(null);
  const primaryBrainotype = useMemo(() => {
    if (!brainotypeResult) return null;
    return brainotypeById[brainotypeResult.primary];
  }, [brainotypeResult]);
  const learningStyleLabel = brainotypeResult ? learningStyleLabels[brainotypeResult.learningStyle] : "Not set";

  useEffect(() => {
    if (!state) return;
    setProfileData((prev) => ({
      ...prev,
      name: state.profile.fullName || "",
      email: state.profile.email || "",
      school: state.profile.university,
      course: state.profile.courseOfStudy,
      year: state.profile.yearOfStudy,
      modules: state.profile.modules.join(", "),
    }));
  }, [state]);

  useEffect(() => {
    if (window.sessionStorage.getItem(PROFILE_FLASH_KEY) !== "1") return;
    window.sessionStorage.removeItem(PROFILE_FLASH_KEY);
    setHighlightPersonaCard(true);
    const timeout = window.setTimeout(() => setHighlightPersonaCard(false), 1600);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!state) return;
    const personaData = state.personaProfile || state.onboardingPersona || defaultPersona;
    const learningStyle = String(personaData.learningStyle || defaultPersona.learningStyle).trim();

    const { currentKey, seenKey } = getPersonaStorageKeys(authUser?.email);
    window.localStorage.setItem(currentKey, learningStyle || defaultPersona.learningStyle);
    if (!window.localStorage.getItem(seenKey)) {
      window.localStorage.setItem(seenKey, learningStyle || defaultPersona.learningStyle);
    }
  }, [state, authUser?.email]);

  useEffect(() => {
    setBrainotypeResult(readBrainotypeResult());
  }, []);

  const handleSave = async () => {
    if (!state) return;
    const modules = profileData.modules
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    await saveProfileData({
      fullName: profileData.name,
      email: profileData.email,
      university: profileData.school,
      yearOfStudy: profileData.year,
      courseOfStudy: profileData.course,
      modules,
    });

    setIsEditing(false);
  };

  if (loading && !state) {
    return <div className="p-8 text-muted-foreground">Loading profile...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-medium text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-0.5">Manage your profile and view personalized learning recommendations</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-lg">Profile Information</h3>
                <p className="text-sm text-muted-foreground">Your account details</p>
              </div>
            </div>
            <Button
              onClick={() => (isEditing ? void handleSave() : setIsEditing(true))}
              variant={isEditing ? "default" : "outline"}
              className={isEditing ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
            >
              {isEditing ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profileData.name} onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} disabled={!isEditing} className={!isEditing ? "bg-muted/50" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profileData.email} onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} disabled={!isEditing} className={!isEditing ? "bg-muted/50" : ""} />
            </div>
            <div className="space-y-2">
              <Label>School</Label>
              <Input value={profileData.school} onChange={(e) => setProfileData({ ...profileData, school: e.target.value })} disabled={!isEditing} className={!isEditing ? "bg-muted/50" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Input value={profileData.course} onChange={(e) => setProfileData({ ...profileData, course: e.target.value })} disabled={!isEditing} className={!isEditing ? "bg-muted/50" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Year of Study</Label>
              <Input value={profileData.year} onChange={(e) => setProfileData({ ...profileData, year: e.target.value })} disabled={!isEditing} className={!isEditing ? "bg-muted/50" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Modules (comma separated)</Label>
              <Input value={profileData.modules} onChange={(e) => setProfileData({ ...profileData, modules: e.target.value })} disabled={!isEditing} className={!isEditing ? "bg-muted/50" : ""} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Brainosaur Type</p>
            <p className="text-lg font-semibold text-foreground">{primaryBrainotype?.name || "Not set"}</p>
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Learning Style</p>
            <p className="text-lg font-semibold text-foreground">{learningStyleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
