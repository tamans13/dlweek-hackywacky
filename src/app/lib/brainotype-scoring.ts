import { BrainotypeId, Brainotype, brainotypeOrder } from "./brainotypes";

export type LearningStyleId = "visual" | "auditory" | "kinesthetic";

export type BrainotypeResult = {
  primary: BrainotypeId;
  secondary: BrainotypeId;
  learningStyle: LearningStyleId;
  scores: Record<BrainotypeId, number>;
};

const STORAGE_KEY = "brainotype_result";

type Scores = Record<BrainotypeId, number>;
type Answers = Record<string, string | string[]>;

type CalculateParams = {
  answers: Answers;
  studyLimit: string;
  sleep: string;
};

const initScores = (): Scores =>
  brainotypeOrder.reduce((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {} as Scores);

const learningStyleOrder: LearningStyleId[] = ["visual", "auditory", "kinesthetic"];

const initLearningStyleScores = (): Record<LearningStyleId, number> =>
  learningStyleOrder.reduce((acc, style) => {
    acc[style] = 0;
    return acc;
  }, {} as Record<LearningStyleId, number>);

export const learningStyleLabels: Record<LearningStyleId, string> = {
  visual: "Visual Learner",
  auditory: "Auditory Learner",
  kinesthetic: "Kinesthetic Learner",
};

export const learningStyleDescriptions: Record<LearningStyleId, string> = {
  visual: "Diagrams, charts, and structured notes help you make sense of complex concepts.",
  auditory: "Talking through ideas, listening to explanations, and group reviews keep you engaged.",
  kinesthetic: "Hands-on practice and examples help knowledge stick—doing beats just reading.",
};

const toArray = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value : value ? [value] : [];

export function calculateBrainotype({ answers, studyLimit, sleep }: CalculateParams): BrainotypeResult {
  const scores = initScores();
  const learningScores = initLearningStyleScores();
  const add = (id: BrainotypeId, value: number) => {
    if (!value) return;
    scores[id] += value;
  };

  const addLearningStyle = (style: LearningStyleId, value: number) => {
    if (!value) return;
    learningScores[style] += value;
  };

  const focusDuration = String(answers["focus-duration"] || "");
  switch (focusDuration) {
    case "<20":
      add("sprintosaur", 3);
      break;
    case "20-40":
      add("sprintosaur", 2);
      break;
    case "40-60":
      add("flexisaur", 1);
      break;
    case "60-90":
      add("deeposaur", 2);
      break;
    case "90+":
      add("deeposaur", 3);
      break;
  }

  const peak = String(answers["mental-sharp"] || "");
  if (peak === "6-10am" || peak === "10am-2pm") {
    add("deeposaur", 1);
  } else if (peak === "2-6pm") {
    add("flexisaur", 1);
  } else if (peak === "6-10pm") {
    add("nightosaur", 2);
  } else if (peak === "after-10pm") {
    add("nightosaur", 3);
  }

  const switchFreq = String(answers["phone-check"] || "");
  switch (switchFreq) {
    case "never":
      add("deeposaur", 1);
      break;
    case "occasionally":
      add("methodosaur", 1);
      break;
    case "20-30min":
      add("sprintosaur", 1);
      break;
    case "frequently":
      add("recoverosaur", 1);
      break;
  }

  const studyMethods = toArray(answers["study-method"]);
  studyMethods.forEach((method) => {
    switch (method) {
      case "practice":
        add("sprintosaur", 2);
        break;
      case "teach":
        add("deeposaur", 2);
        break;
      case "summarise":
        add("methodosaur", 2);
        break;
      case "mix":
        add("flexisaur", 2);
        break;
    }
  });

  const fatigue = String(answers["after-2hr"] || "");
  if (fatigue === "exhausted") add("recoverosaur", 2);

  const guiltValue = Number(answers.guilt || 0);
  if (guiltValue >= 4) add("recoverosaur", 1);

  const tiredBefore = Number(answers["mental-tired"] || 0);
  if (tiredBefore === 4) add("recoverosaur", 2);
  if (tiredBefore === 5) add("recoverosaur", 3);

  if (String(answers["performance-trend"] || "") === "dropped") {
    add("recoverosaur", 3);
  }

  const procrastination = String(answers["procrastination-cause"] || "");
  switch (procrastination) {
    case "too-big":
      add("methodosaur", 2);
      break;
    case "tired":
      add("recoverosaur", 2);
      break;
    case "distracted":
      add("sprintosaur", 1);
      break;
    case "no-start":
      add("methodosaur", 1);
      break;
  }

  const understanding = String(answers["learning-style-understanding"] || "");
  if (learningStyleOrder.includes(understanding as LearningStyleId)) {
    addLearningStyle(understanding as LearningStyleId, 2);
  }

  const revision = String(answers["learning-style-revision"] || "");
  if (learningStyleOrder.includes(revision as LearningStyleId)) {
    addLearningStyle(revision as LearningStyleId, 2);
  }

  const limitHours = Number(studyLimit);
  if (limitHours > 0) {
    if (limitHours < 2) {
      add("sprintosaur", 2);
    } else if (limitHours <= 4) {
      add("flexisaur", 1);
    } else if (limitHours <= 6) {
      add("methodosaur", 1);
    } else if (limitHours <= 8) {
      add("deeposaur", 2);
    }
  }

  const sleepHours = Number(sleep);
  if (sleepHours > 0) {
    if (sleepHours < 5) {
      add("recoverosaur", 2);
    } else if (sleepHours <= 6) {
      add("nightosaur", 1);
    } else if (sleepHours <= 7) {
      add("flexisaur", 1);
    } else if (sleepHours <= 8) {
      add("deeposaur", 1);
    } else {
      add("methodosaur", 1);
    }
  }

  const sorted = brainotypeOrder
    .map((id, index) => ({ id, score: scores[id], index }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

  const primary = sorted[0]?.id || brainotypeOrder[0];
  const secondary = sorted[1]?.id || primary;

  const sortedLearning = learningStyleOrder
    .map((id, index) => ({ id, score: learningScores[id], index }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

  const learningStyle = sortedLearning[0]?.id || learningStyleOrder[0];

  return {
    primary,
    secondary,
    learningStyle,
    scores,
  };
}

export function storeBrainotypeResult(result: BrainotypeResult) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  } catch {
    // ignore storage errors
  }
}

export function readBrainotypeResult(): BrainotypeResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BrainotypeResult;
  } catch {
    return null;
  }
}
