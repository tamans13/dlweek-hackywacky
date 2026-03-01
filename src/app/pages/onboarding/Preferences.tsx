import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

const questions = [
  {
    id: "mental-sharp",
    question: "When do you feel most mentally sharp?",
    options: [
      { value: "6-10am", label: "6am–10am" },
      { value: "10am-2pm", label: "10am–2pm" },
      { value: "2-6pm", label: "2pm–6pm" },
      { value: "6-10pm", label: "6pm–10pm" },
      { value: "after-10pm", label: "After 10pm" },
    ],
  },
  {
    id: "focus-duration",
    question: "How long can you focus deeply before mental fatigue?",
    options: [
      { value: "<20", label: "<20 min" },
      { value: "20-40", label: "20–40 min" },
      { value: "40-60", label: "40–60 min" },
      { value: "60-90", label: "60–90 min" },
      { value: "90+", label: "90+ min" },
    ],
  },
  {
    id: "after-2hr",
    question: "After a 2-hour study session, you usually feel:",
    options: [
      { value: "energised", label: "Energised" },
      { value: "neutral", label: "Neutral" },
      { value: "slightly-drained", label: "Slightly drained" },
      { value: "exhausted", label: "Mentally exhausted" },
    ],
  },
  {
    id: "study-method",
    question: "When you study, you mostly:",
    options: [
      { value: "reread", label: "Reread notes" },
      { value: "practice", label: "Do practice questions" },
      { value: "summarise", label: "Summarise content" },
      { value: "teach", label: "Teach/explain concepts" },
      { value: "mix", label: "Mix methods" },
    ],
  },
  {
    id: "performance-drop",
    question: "When performance drops during a session, you:",
    options: [
      { value: "push", label: "Push through" },
      { value: "break", label: "Take a short break" },
      { value: "switch", label: "Switch topic" },
      { value: "stop", label: "Stop studying" },
    ],
  },
  {
    id: "phone-check",
    question: "How often do you check your phone during study?",
    options: [
      { value: "never", label: "Never" },
      { value: "occasionally", label: "Occasionally (every 1–2 hours)" },
      { value: "20-30min", label: "Every 20–30 min" },
      { value: "frequently", label: "Very frequently (almost every 5 min)" },
    ],
  },
  {
    id: "study-hours-trend",
    question: "In past 2 weeks, study hours:",
    options: [
      { value: "decreased", label: "Decreased" },
      { value: "stable", label: "Stable" },
      { value: "moderate-increase", label: "Increased moderately" },
      { value: "drastic-increase", label: "Increased drastically" },
    ],
  },
  {
    id: "performance-trend",
    question: "In past 2 weeks, performance:",
    options: [
      { value: "improved", label: "Improved" },
      { value: "stable", label: "Stable" },
      { value: "slight-decline", label: "Slightly declined" },
      { value: "dropped", label: "Dropped significantly" },
    ],
  },
];

const ratingQuestions = [
  { id: "guilt", question: "You feel guilty when not studying." },
  { id: "mental-tired", question: "You feel mentally tired even before starting study." },
];

const multiSelectQuestionIds = new Set(["study-method", "performance-drop", "phone-check"]);

export default function OnboardingPreferences() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({
    guilt: "3",
    "mental-tired": "3",
  });
  const [studyLimit, setStudyLimit] = useState("");
  const [sleep, setSleep] = useState("");

  const isSelected = (questionId: string, optionValue: string) => {
    const current = answers[questionId];
    if (Array.isArray(current)) return current.includes(optionValue);
    return current === optionValue;
  };

  const handleOptionSelect = (questionId: string, optionValue: string) => {
    if (multiSelectQuestionIds.has(questionId)) {
      const current = answers[questionId];
      const selected = Array.isArray(current) ? current : [];
      const next = selected.includes(optionValue)
        ? selected.filter((v) => v !== optionValue)
        : [...selected, optionValue];
      setAnswers({ ...answers, [questionId]: next });
      return;
    }
    setAnswers({ ...answers, [questionId]: optionValue });
  };

  const handleRatingChange = (questionId: string, value: string) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  const handleContinue = () => {
    sessionStorage.setItem(
      "onboarding_preferences",
      JSON.stringify({ answers, studyLimit, sleep }),
    );
    navigate("/onboarding/complete");
  };

  const canContinue =
    questions.every((q) => {
      const answer = answers[q.id];
      if (multiSelectQuestionIds.has(q.id)) return Array.isArray(answer) && answer.length > 0;
      return typeof answer === "string" && answer.length > 0;
    }) &&
    ratingQuestions.every((q) => typeof answers[q.id] === "string" && (answers[q.id] as string).length > 0) &&
    studyLimit &&
    sleep;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="text-center space-y-4 pt-8 pb-4">
        <div className="flex justify-center">
          <div className="w-36 h-36 rounded-2xl overflow-hidden bg-primary/10">
            <img src="/brainosaur.jpg" alt="Brainosaur logo" className="w-full h-full object-cover" />
          </div>
        </div>
        <h2 className="text-3xl font-medium text-foreground">
          Understand How You Learn.
        </h2>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          AI-powered analytics that model your evolving learning state to help you study smarter.
        </p>
      </div>

      <div className="space-y-5">
        {/* Multiple and single choice questions */}
        {questions.map((q) => (
          <div key={q.id} className="border border-border rounded-2xl p-6 shadow-sm" style={{ backgroundColor: "#f7f5ef" }}>
            <Label className="text-base font-medium text-foreground mb-4 block">
              {q.question.includes("(select all that apply)") ? (
                <>
                  {q.question.replace(" (select all that apply)", "")}
                  <span className="text-sm font-normal italic text-gray-400"> (select all that apply)</span>
                </>
              ) : (
                q.question
              )}
            </Label>
            <div className="space-y-1">
              {q.options.map((option) => {
                const selected = isSelected(q.id, option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleOptionSelect(q.id, option.value)}
                    aria-pressed={selected}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm sm:text-base transition-colors duration-150 cursor-pointer hover:bg-muted/50"
                  >
                    {/* Donut radio indicator */}
                    <span
                      aria-hidden="true"
                      className="shrink-0 h-5 w-5 rounded-full flex items-center justify-center transition-colors duration-150"
                      style={{
                        backgroundColor: selected ? "transparent" : "#C8DCC3",
                        border: selected ? "2px solid #2D6A4F" : "2px solid #8FBA89",
                      }}
                    >
                      {selected && (
                        <span
                          className="block rounded-full"
                          style={{
                            width: "9px",
                            height: "9px",
                            backgroundColor: "#2D6A4F",
                          }}
                        />
                      )}
                    </span>
                    <span className={`flex-1 font-normal ${selected ? "text-foreground font-medium" : "text-foreground"}`}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Rating questions (1-5 slider) */}
        <style>{`
          .green-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 6px;
            border-radius: 9999px;
            outline: none;
            cursor: pointer;
          }
          .green-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #EDE8DC;
            border: 2px solid #2D6A4F;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          }
          .green-slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #EDE8DC;
            border: 2px solid #2D6A4F;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          }
        `}</style>
        {ratingQuestions.map((q) => {
          const val = Number(answers[q.id] || 3);
          const pct = ((val - 1) / 4) * 100;
          const trackStyle = {
            background: `linear-gradient(to right, #2D6A4F 0%, #2D6A4F ${pct}%, #C8DCC3 ${pct}%, #C8DCC3 100%)`,
          };
          return (
          <div key={q.id} className="border border-border rounded-2xl p-6 shadow-sm" style={{ backgroundColor: "#f7f5ef" }}>
            <Label className="text-base font-medium text-foreground mb-4 block">
              {q.question.includes("(select all that apply)") ? (
                <>
                  {q.question.replace(" (select all that apply)", "")}
                  <span className="text-sm font-normal italic text-gray-400"> (select all that apply)</span>
                </>
              ) : (
                q.question
              )}
            </Label>
            <p className="text-sm text-muted-foreground mb-3">(1 = Never, 5 = Always)</p>
            <div className="space-y-2">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={val}
                onChange={(e) => handleRatingChange(q.id, e.target.value)}
                className="green-slider"
                style={trackStyle}
                aria-label={q.question}
              />
              <div className="relative h-5 text-xs text-muted-foreground mt-1">
                {[1, 2, 3, 4, 5].map((rating, i) => (
                  <span
                    key={rating}
                    className="absolute -translate-x-1/2"
                    style={{ left: `calc(${i * 25}% + ${10 - i * 5}px)` }}
                  >
                    {rating}
                  </span>
                ))}
              </div>
            </div>
          </div>
          );
        })}

        {/* Dropdown questions */}
        <div className="border border-border rounded-2xl p-6 shadow-sm" style={{ backgroundColor: "#f7f5ef" }}>
          <Label className="text-base font-medium text-foreground mb-3 block">
            Ideal daily study limit?
          </Label>
          <Select value={studyLimit} onValueChange={setStudyLimit}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select hours" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((hour) => (
                <SelectItem key={hour} value={hour.toString()}>
                  {hour} hour{hour !== 1 ? "s" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border border-border rounded-2xl p-6 shadow-sm" style={{ backgroundColor: "#f7f5ef" }}>
          <Label className="text-base font-medium text-foreground mb-3 block">
            Average sleep?
          </Label>
          <Select value={sleep} onValueChange={setSleep}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select hours" />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((hour) => (
                <SelectItem key={hour} value={hour.toString()}>
                  {hour} hour{hour !== 1 ? "s" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={handleContinue}
        disabled={!canContinue}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg rounded-xl"
      >
        Continue
      </Button>
    </div>
  );
}