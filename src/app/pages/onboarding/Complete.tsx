import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAppData } from "../../state/AppDataContext";
import { generateOnboardingPersona } from "../../lib/api";
import type { OnboardingPersonaAnalysis } from "../../lib/api";
import { storeOnboardingPersona } from "../../lib/onboardingPersona";
import { brainotypeById, brainotypes, type Brainotype, type BrainotypeId } from "../../lib/brainotypes";
import { learningStyleLabels, type LearningStyleId } from "../../lib/brainotype-scoring";

const fallbackAnalysis: OnboardingPersonaAnalysis = {
  learningStyle: "Balanced Adaptive Learner",
  rationale: "Your responses suggest you benefit from structured sessions, active recall, and consistent review pacing.",
  studyTechniques: [
    { title: "Time-box your sessions", description: "Use fixed study blocks with short breaks to maintain focus." },
    { title: "Active recall first", description: "Attempt questions before rereading notes." },
    { title: "Spaced repetition rhythm", description: "Revisit weak topics on a schedule." },
    { title: "End-session checkpoint", description: "Write three key takeaways." },
  ],
};

// Dinos pushed strictly to the outer perimeter to keep the center and bottom-center clear
const floatingCards = [
  { key: "sprintosaur", top: "4%", left: "3%", scale: "w-48 h-48", anim: "float-1" },
  { key: "deeposaur", top: "15%", left: "15%", scale: "w-32 h-32", anim: "float-2" },
  { key: "methodosaur", bottom: "18%", left: "4%", scale: "w-56 h-56", anim: "float-3" },
  { key: "flexisaur", top: "45%", left: "5%", scale: "w-40 h-40", anim: "float-1" },
  
  { key: "recoverosaur", top: "6%", right: "4%", scale: "w-64 h-64", anim: "float-2" },
  { key: "nightosaur", top: "35%", right: "8%", scale: "w-36 h-36", anim: "float-3" },
  { key: "sprintosaur", bottom: "15%", right: "6%", scale: "w-48 h-48", anim: "float-1" },
  { key: "methodosaur", bottom: "45%", right: "4%", scale: "w-32 h-32", anim: "float-2" },
  
  // Extra edge fillers
  { key: "deeposaur", top: "70%", left: "2%", scale: "w-32 h-32", anim: "float-3" },
  { key: "flexisaur", top: "75%", right: "2%", scale: "w-28 h-28", anim: "float-1" },
];

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
  const [brainotypeSnapshot, setBrainotypeSnapshot] = useState<Brainotype | null>(null);
  const [learningStyleLabel, setLearningStyleLabel] = useState("Learning Style not set");

  useEffect(() => {
    let cancelled = false;

    async function runPersonaGeneration() {
      setAnalysisLoading(true);
      setAnalysisError("");

      try {
        const welcome = readSessionJson<Record<string, unknown>>("onboarding_welcome", {});
        const prefs = readSessionJson<Record<string, unknown>>("onboarding_preferences", {});
        const storedBrainotype = (prefs as Record<string, any>).brainotype || {};
        
        const primaryId = String(storedBrainotype.primary || "") as BrainotypeId;
        setBrainotypeSnapshot(brainotypeById[primaryId] || null);
        
        const key = String(storedBrainotype.learningStyle || "") as LearningStyleId;
        setLearningStyleLabel(learningStyleLabels[key] || "Learning Style not set");

        const result = await generateOnboardingPersona({ welcome, prefs });
        if (cancelled) return;

        setAnalysis(result.analysis);
        setAiEnabled(result.aiEnabled);
        storeOnboardingPersona(result.analysis);
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

  const displayLabel = learningStyleLabel.replace(" Learner", "");

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#E9F0E0] font-sans">
      <style>{`
        @keyframes float-1 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
        @keyframes float-2 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(15px); } }
        @keyframes float-3 { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-15px); } }

        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-6deg); }
          75% { transform: rotate(6deg); }
        }
        
        /*
          Left shell: flies bottom-left, tilted so the jagged crack edge faces up-right (toward the dino).
          Right shell: flies bottom-right, tilted so the jagged crack edge faces up-left (toward the dino).
          Both land roughly at button level, well outside the text block.
        */
        @keyframes split-left-shell {
          0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate(-320px, 280px) rotate(-50deg) scale(0.35); opacity: 1; }
        }
        @keyframes split-right-shell {
          0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate(320px, 280px) rotate(50deg) scale(0.35); opacity: 1; }
        }
        
        @keyframes hatch-words {
          0% { opacity: 0; transform: scale(0.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        @keyframes fade-in-dino {
          0% { opacity: 0; transform: translateY(30px) scale(0.8); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .animate-shake { animation: shake 0.4s ease-in-out 3; }
        .animate-split-left  { animation: split-left-shell  1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; animation-delay: 1.2s; }
        .animate-split-right { animation: split-right-shell 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; animation-delay: 1.2s; }
        
        .animate-hatch-words  { animation: hatch-words    0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; animation-delay: 1.2s; opacity: 0; }
        .animate-fade-in-dino { animation: fade-in-dino   1s  cubic-bezier(0.34, 1.56, 0.64, 1) forwards; animation-delay: 1.5s; opacity: 0; }
        .animate-delay-btn    { animation: fade-in-up     1s  ease-out                           forwards; animation-delay: 2.2s; opacity: 0; }
      `}</style>

      {/* Background Ecosystem */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {floatingCards.map((card, index) => (
          <div
            key={index}
            className={`absolute flex items-center justify-center ${card.scale}`}
            style={{
              top: card.top, bottom: card.bottom, left: card.left, right: card.right,
              animation: `${card.anim} ${7 + (index % 3)}s ease-in-out infinite`,
            }}
            aria-hidden
          >
            <img
              src={brainotypes.find((type) => type.id === card.key)?.image || "/brainosaur.jpg"}
              alt="Background dinosaur"
              className="h-full w-full object-contain drop-shadow-xl"
            />
          </div>
        ))}
      </div>

      {/* Main Center UI */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4 -mt-24">
        
        {/* Selected Dinosaur */}
        <div className="z-20 animate-fade-in-dino mb-4">
          <img
            src={brainotypeSnapshot?.image || "/brainosaur.jpg"}
            alt="Your Brainotype"
            className="h-[340px] w-[340px] object-contain drop-shadow-2xl"
          />
        </div>

        {/* The Hatching Words Area */}
        <div className="relative flex items-center justify-center w-full max-w-5xl h-[200px]">
          
          {/* Eggshells — positioned so they fly out to button level, angled toward center dino */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            {/* Left Shell — crack edge faces right (toward dino), flies down-left */}
            <div className="absolute animate-shake animate-split-left" style={{ transformOrigin: "right center" }}>
              <svg width="220" height="310" viewBox="0 0 200 280" className="drop-shadow-2xl">
                <path d="M 10 160 C 10 60, 50 10, 100 10 C 150 10, 190 60, 190 160 L 160 140 L 130 170 L 100 140 L 70 170 L 40 140 Z" fill="#F7F4EB" stroke="#D8D0C1" strokeWidth="3" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Right Shell — crack edge faces left (toward dino), flies down-right */}
            <div className="absolute animate-shake animate-split-right" style={{ transformOrigin: "left center" }}>
              <svg width="220" height="310" viewBox="0 0 200 280" className="drop-shadow-2xl">
                <path d="M 10 160 L 40 140 L 70 170 L 100 140 L 130 170 L 160 140 L 190 160 C 190 250, 160 270, 100 270 C 40 270, 10 250, 10 160 Z" fill="#F7F4EB" stroke="#D8D0C1" strokeWidth="3" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Bursting Text */}
          <div className="z-30 flex flex-col items-center text-center animate-hatch-words">
            <h1 className="text-[4rem] md:text-[5.5rem] font-bold tracking-tight text-[#111827] leading-[1.05]">
              {displayLabel}
            </h1>
            <h2 className="text-[4rem] md:text-[5.5rem] font-bold tracking-tight text-[#2F5233] leading-[1.05]">
              {brainotypeSnapshot?.name || "Brainotype"}
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col items-center mt-6 animate-delay-btn z-50">
          {authError && (
            <p className="text-sm text-red-500 font-medium mb-4 max-w-md text-center">
              {authError}
            </p>
          )}

          <button
            onClick={handleGoDashboard}
            disabled={submitting || analysisLoading}
            className="px-12 py-4 rounded-full bg-[#7C976E] text-white text-xl font-medium shadow-lg hover:bg-[#68815B] hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting || analysisLoading ? "Setting up..." : "Go to Dashboard"}
          </button>
        </div>

      </div>
    </div>
  );
}