import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { User, Edit2, Save } from "lucide-react";
import { useAppData } from "../state/AppDataContext";
import { getPersonaStorageKeys, PROFILE_FLASH_KEY } from "../lib/persona";

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
  const [persona, setPersona] = useState(defaultPersona.learningStyle);
  const [personaSummary, setPersonaSummary] = useState(defaultPersona.rationale);
  const [personaTechniques, setPersonaTechniques] = useState(defaultPersona.studyTechniques);

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
    const rationale = String(personaData.rationale || defaultPersona.rationale).trim();
    const techniques = Array.isArray(personaData.studyTechniques)
      ? personaData.studyTechniques
          .map((item) => ({
            title: String(item?.title || "").trim(),
            description: String(item?.description || "").trim(),
          }))
          .filter((item) => item.title && item.description)
      : [];

    setPersona(learningStyle || defaultPersona.learningStyle);
    setPersonaSummary(rationale || defaultPersona.rationale);
    setPersonaTechniques(techniques.length ? techniques : defaultPersona.studyTechniques);

    const { currentKey, seenKey } = getPersonaStorageKeys(authUser?.email);
    window.localStorage.setItem(currentKey, learningStyle || defaultPersona.learningStyle);
    if (!window.localStorage.getItem(seenKey)) {
      window.localStorage.setItem(seenKey, learningStyle || defaultPersona.learningStyle);
    }
  }, [state, authUser?.email]);

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

        <div className="bg-card border border-border rounded-lg p-6" id="study-techniques">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-border bg-primary/10">
              <img src="/brainosaur.jpg" alt="Brainosaur dinosaur logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-lg">Learning Style & Study Persona</h3>
              <p className="text-sm text-muted-foreground">AI-generated insights based on your behavior</p>
            </div>
          </div>

          <div
            className={`rounded-lg p-5 mb-6 transition-colors duration-500 ${
              highlightPersonaCard ? "bg-warning/20 border border-warning/60" : "bg-primary/5 border border-primary/20"
            }`}
          >
            <div className="text-sm text-muted-foreground mb-1">Your Study Persona</div>
            <div className="text-2xl font-medium text-foreground mb-3">{persona}</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{personaSummary}</p>
          </div>

          <div className="space-y-3">
            {personaTechniques.map((technique) => (
              <div key={technique.title} className="border border-border rounded-lg p-4">
                <h5 className="font-medium text-foreground mb-1">{technique.title}</h5>
                <p className="text-sm text-muted-foreground">{technique.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
