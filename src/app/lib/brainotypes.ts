export type BrainotypeId =
  | "sprintosaur"
  | "deeposaur"
  | "methodosaur"
  | "recoverosaur"
  | "flexisaur"
  | "nightosaur";

export const brainotypeOrder: BrainotypeId[] = [
  "sprintosaur",
  "deeposaur",
  "methodosaur",
  "recoverosaur",
  "flexisaur",
  "nightosaur",
];

export type Brainotype = {
  id: BrainotypeId;
  name: string;
  tagline: string;
  image: string;
  bullets: string[];
};

export const brainotypes: Brainotype[] = [
  {
    id: "sprintosaur",
    name: "Sprintosaur",
    tagline: "Short Burst Learner",
    image: "/Sprintosaur.png",
    bullets: [
      "Focus < 40 minutes,",
      "performs best with practice questions",
      "Breaks frequently",
      "Works well with pomodoro and flashcards",
    ],
  },
  {
    id: "deeposaur",
    name: "Deeposaur",
    tagline: "Deep Focus Learner",
    image: "/Deeposaur.png",
    bullets: [
      "Focus endurance 60–90+ minutes,",
      "low phone distraction",
      "Uses teaching/explanation methods",
      "Strong for complex topics",
    ],
  },
  {
    id: "methodosaur",
    name: "Methodosaur",
    tagline: "Structured Planner",
    image: "/Methodosaur.png",
    bullets: [
      "Consistent study schedule,",
      "uses multiple study methods",
      "Benefits from structured plans",
      "Works well with spaced repetition",
    ],
  },
  {
    id: "recoverosaur",
    name: "Recoverosaur",
    tagline: "Burnout Sensitive",
    image: "/Recoverosaur.png",
    bullets: [
      "High fatigue before studying,",
      "performance drops despite study time",
      "Needs recovery and rest cycles",
      "Best with moderate sessions",
    ],
  },
  {
    id: "flexisaur",
    name: "Flexisaur",
    tagline: "Adaptive Learner",
    image: "/Flexisaur.png",
    bullets: [
      "Uses mixed strategies,",
      "moderate focus endurance",
      "Switches topics when stuck",
      "Flexible learning style",
    ],
  },
  {
    id: "nightosaur",
    name: "Nightosaur",
    tagline: "Late Cognitive Peak",
    image: "/Nightosaur.png",
    bullets: [
      "Mental sharpness peaks in evening,",
      "often studies better after 6–10pm",
      "Medium to long focus endurance",
      "Works well in quiet night sessions",
    ],
  },
];

export const brainotypeById: Record<BrainotypeId, Brainotype> = Object.fromEntries(
  brainotypes.map((type) => [type.id, type]),
) as Record<BrainotypeId, Brainotype>;
