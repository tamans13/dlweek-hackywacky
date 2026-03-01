export interface ProfileData {
  university: string;
  yearOfStudy: string;
  courseOfStudy: string;
  modules: string[];
}

export interface TopicState {
  topicName: string;
  mastery: number;
  estimatedMasteryNow?: number;
  createdAt: string;
  lastInteractionAt: string;
  lastQuizAt: string | null;
  nextReviewAt: string;
  history: Array<{
    at: string;
    oldMastery: number;
    newMastery: number;
    preScore: number;
    postScore: number;
    confidence: number;
    aiUsed: boolean;
    decay: number;
    gain: number;
  }>;
}

export interface ModuleState {
  topics: Record<string, TopicState>;
  burnoutRisk: number;
  focusEfficiency: number;
  updatedAt: string;
}

export interface StudySession {
  id: string;
  moduleName: string;
  topicName: string;
  startAt: string;
  endAt: string | null;
}

export interface QuizAttempt {
  id: string;
  moduleName: string;
  topicName: string;
  preScore: number;
  postScore: number;
  confidence: number;
  aiUsed: boolean;
  submittedAt: string;
  difficultySuggestion: string;
  nextQuizType: string;
}

export interface TabEvent {
  id: string;
  moduleName: string;
  topicName: string;
  url: string;
  eventType: "learning" | "help" | "distraction" | "neutral" | string;
  userLabel: string | null;
  createdAt: string;
}

export interface ExamPlan {
  examDate: string;
  totalTopics: number;
  topicsCovered: number;
  updatedAt: string;
}

export interface BackendState {
  profile: ProfileData;
  modules: Record<string, ModuleState>;
  studySessions: StudySession[];
  tabEvents: TabEvent[];
  quizAttempts: QuizAttempt[];
  examPlans: Record<string, ExamPlan>;
  createdAt: string;
  updatedAt: string;
  aiEnabled: boolean;
}

export interface ReadinessItem {
  moduleName: string;
  score: number;
  reason: string;
  examPlan: ExamPlan | null;
}

export interface InsightPayload {
  moduleName: string;
  summary: string;
  actions: string[];
}

export interface OnboardingPersonaTechnique {
  title: string;
  description: string;
}

export interface OnboardingPersonaAnalysis {
  learningStyle: string;
  rationale: string;
  studyTechniques: OnboardingPersonaTechnique[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function classifyUrl(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("netflix.com") || lower.includes("tiktok.com") || lower.includes("instagram.com")) return "distraction";
  if (lower.includes("chat.openai.com") || lower.includes("claude.ai") || lower.includes("gemini.google.com") || lower.includes("copilot.microsoft.com")) return "help";
  if (lower.includes("blackboard") || lower.includes("canvas") || lower.includes("coursera") || lower.includes("edx") || lower.includes("khanacademy")) return "learning";
  return "neutral";
}

export function fetchState() {
  return request<BackendState>("/api/state");
}

export function saveProfile(payload: ProfileData) {
  return request<{ ok: true; profile: ProfileData }>("/api/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startStudySession(moduleName: string, topicName: string) {
  return request<{ ok: true; session: StudySession }>("/api/study-session/start", {
    method: "POST",
    body: JSON.stringify({ moduleName, topicName }),
  });
}

export function stopStudySession(sessionId: string) {
  return request<{ ok: true; session: StudySession }>("/api/study-session/stop", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function logTabEvent(payload: {
  moduleName: string;
  topicName?: string;
  url: string;
  eventType?: string;
  userLabel?: string | null;
}) {
  return request<{ ok: true }>("/api/tab-event", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addTopic(payload: { moduleName: string; topicName: string }) {
  return request<{ ok: true }>("/api/topic/add", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitQuiz(payload: {
  moduleName: string;
  topicName: string;
  preScore: number;
  postScore: number;
  confidence: number;
  aiUsed: boolean;
}) {
  return request<{
    ok: true;
    attempt: QuizAttempt;
    masteryUpdate: {
      oldMastery: number;
      newMastery: number;
      gain: number;
      decay: number;
    };
  }>("/api/quiz/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchDueQuizzes() {
  return request<{ due: Array<{ moduleName: string; topicName: string; type: string }> }>("/api/quizzes/due");
}

export function updateExamPlan(payload: {
  moduleName: string;
  examDate: string;
  totalTopics: number;
  topicsCovered: number;
}) {
  return request<{ ok: true; readiness: { score: number; reason: string } }>("/api/exam-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchReadiness() {
  return request<{ readiness: ReadinessItem[] }>("/api/readiness");
}

export function generateInsights(moduleName: string) {
  return request<{ ok: true; insights: InsightPayload; aiEnabled: boolean }>("/api/insights/generate", {
    method: "POST",
    body: JSON.stringify({ moduleName }),
  });
}

export function generateOnboardingPersona(payload: {
  welcome: Record<string, unknown>;
  prefs: Record<string, unknown>;
}) {
  return request<{ ok: true; analysis: OnboardingPersonaAnalysis; aiEnabled: boolean }>("/api/onboarding/persona", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
