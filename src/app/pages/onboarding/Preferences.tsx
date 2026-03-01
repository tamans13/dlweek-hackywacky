import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
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
    question: "How often do you check your phone?",
    options: [
      { value: "never", label: "Never" },
      { value: "occasionally", label: "Occasionally" },
      { value: "20-30min", label: "Every 20–30 min" },
      { value: "frequently", label: "Very frequently" },
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
  { id: "mental-tired", question: "You feel mentally tired before studying." },
];

export default function OnboardingPreferences() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [studyLimit, setStudyLimit] = useState("");
  const [sleep, setSleep] = useState("");

  const handleContinue = () => {
    sessionStorage.setItem(
      "onboarding_preferences",
      JSON.stringify({
        answers,
        studyLimit,
        sleep,
      }),
    );
    navigate("/onboarding/complete");
  };

  const canContinue = 
    questions.every(q => answers[q.id]) &&
    ratingQuestions.every(q => answers[q.id]) &&
    studyLimit &&
    sleep;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="text-center space-y-2 pt-8 pb-4">
        <h2 className="text-3xl font-medium text-foreground">
          Let's understand your study patterns
        </h2>
        <p className="text-base text-muted-foreground">
          Answer these questions to help us personalize your experience
        </p>
      </div>

      <div className="space-y-5">
        {/* Multiple choice questions */}
        {questions.map((q) => (
          <div key={q.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <Label className="text-base font-medium text-foreground mb-4 block">
              {q.question}
            </Label>
            <RadioGroup
              value={answers[q.id] || ""}
              onValueChange={(value) => setAnswers({ ...answers, [q.id]: value })}
              className="space-y-2.5"
            >
              {q.options.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.value} id={`${q.id}-${option.value}`} />
                  <Label
                    htmlFor={`${q.id}-${option.value}`}
                    className="font-normal cursor-pointer flex-1"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ))}

        {/* Rating questions (1-5) */}
        {ratingQuestions.map((q) => (
          <div key={q.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <Label className="text-base font-medium text-foreground mb-4 block">
              {q.question}
            </Label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">1</span>
              <RadioGroup
                value={answers[q.id] || ""}
                onValueChange={(value) => setAnswers({ ...answers, [q.id]: value })}
                className="flex gap-4"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <div key={rating} className="flex flex-col items-center gap-1">
                    <RadioGroupItem value={rating.toString()} id={`${q.id}-${rating}`} />
                    <Label
                      htmlFor={`${q.id}-${rating}`}
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      {rating}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <span className="text-sm text-muted-foreground">5</span>
            </div>
          </div>
        ))}

        {/* Dropdown questions */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
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
                  {hour} hour{hour !== 1 ? 's' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
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
                  {hour} hour{hour !== 1 ? 's' : ''}
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
