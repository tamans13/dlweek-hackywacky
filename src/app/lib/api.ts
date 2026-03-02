export interface ProfileData {
  fullName: string;
  email: string;
  university: string;
  yearOfStudy: string;
  courseOfStudy: string;
  modules: string[];
}

export interface TopicState {
  topicName: string;
  mastery: number;
  estimatedMasteryNow?: number;
  documents?: Array<{
    id: string;
    name: string;
    path: string;
    uploadedAt: string;
  }>;
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
    oldMasteryPct?: number;
    newMasteryPct?: number;
    gainPct?: number;
    decayRatePct?: number;
    source?: string;
    difficultyTarget?: {
      currentMasteryPct: number;
      targetMasteryPct: number;
      targetPostScore: number;
      requiredGainPct: number;
      difficulty: string;
    };
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
  targetMasteryPct?: number;
  targetPostScore?: number;
  gainPct?: number;
  decayRatePct?: number;
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
  examName?: string;
  examDate: string;
  totalTopics: number;
  topicsCovered: number;
  topicsTested: string[];
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
  supabaseEnabled?: boolean;
}

export interface ReadinessItem {
  moduleName: string;
  score: number;
  reason: string;
  examPlan: ExamPlan | null;
  prediction?: {
    modelType: string;
    riskBand: "low" | "medium" | "high";
    projectedReadiness: number;
    confidence: number;
    daysToExam: number;
    untestedTopicCount: number;
    dailyTopicTarget: number;
    priorityTopics: Array<{
      topicName: string;
      masteryPct: number;
    }>;
    explanation: string;
  };
}

export interface InsightPayload {
  moduleName: string;
  summary: string;
  actions: string[];
}

export interface LearningChatMessage {
  role: "user" | "assistant";
  content: string;
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

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  createdAt: number;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface TopicDocument {
  id: string;
  moduleName: string;
  topicName: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  textExtracted: boolean;
}

export interface GeneratedQuizQuestion {
  id: string;
  question: string;
  options: string[];
  explanation: string;
}

export interface GeneratedQuizAttemptSummary {
  id: string;
  quizId: string;
  score: number;
  total: number;
  submittedAt: string;
}

export interface GeneratedQuiz {
  id: string;
  moduleName: string;
  topicName: string;
  title: string;
  questions: GeneratedQuizQuestion[];
  createdAt: string;
  sourceDocumentIds: string[];
  attempts: GeneratedQuizAttemptSummary[];
  attemptCount: number;
  lastAttempt: GeneratedQuizAttemptSummary | null;
  difficultyPlan?: {
    currentMasteryPct: number;
    targetMasteryPct: number;
    targetPostScore: number;
    requiredGainPct: number;
    difficulty: string;
  } | null;
}

export interface GeneratedQuizReviewItem {
  questionId: string;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface SpacedReviewFlashcard {
  id: string;
  front: string;
  back: string;
}

export interface SpacedReviewRun {
  id: string;
  moduleName: string;
  topicName: string;
  startedAt: string;
  durationMinutes: number;
  flashcards: SpacedReviewFlashcard[];
  miniQuiz: {
    title: string;
    questions: GeneratedQuizQuestion[];
  };
}

const SESSION_STORAGE_KEY = "brainosaur_auth_session";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStoredAuthSession(): AuthSession | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveAuthSession(session: AuthSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function hasAuthSession() {
  const session = getStoredAuthSession();
  return Boolean(session?.accessToken);
}

interface RequestOptions {
  auth?: boolean;
}

async function request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const useAuth = options?.auth !== false;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = new Headers(init?.headers || {});

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (useAuth) {
    const session = getStoredAuthSession();
    if (session?.accessToken) {
      headers.set("Authorization", `Bearer ${session.accessToken}`);
    }
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && useAuth) {
      clearAuthSession();
    }
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data as T;
}

export async function login(email: string, password: string) {
  const result = await request<{
    ok: true;
    user: AuthUser;
    session: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: string;
    };
    supabaseEnabled: boolean;
  }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { auth: false },
  );

  saveAuthSession({
    accessToken: result.session.accessToken,
    refreshToken: result.session.refreshToken,
    expiresIn: result.session.expiresIn,
    tokenType: result.session.tokenType,
    createdAt: Date.now(),
  });

  return result;
}

export async function signup(email: string, password: string) {
  const result = await request<{
    ok: true;
    user: AuthUser;
    session: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: string;
    };
    supabaseEnabled: boolean;
  }>(
    "/api/auth/signup",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { auth: false },
  );

  saveAuthSession({
    accessToken: result.session.accessToken,
    refreshToken: result.session.refreshToken,
    expiresIn: result.session.expiresIn,
    tokenType: result.session.tokenType,
    createdAt: Date.now(),
  });

  return result;
}

export function fetchSessionUser() {
  return request<{ ok: true; user: AuthUser; supabaseEnabled: boolean }>("/api/auth/session");
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

export function saveProfile(payload: {
  fullName?: string;
  email?: string;
  university: string;
  yearOfStudy: string;
  courseOfStudy: string;
  modules: string[];
}) {
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

export function deleteTopic(payload: { moduleName: string; topicName: string }) {
  return request<{ ok: true }>("/api/topic/delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadTopicFiles(payload: {
  moduleName: string;
  topicName: string;
  files: File[];
}) {
  const form = new FormData();
  form.append("moduleName", payload.moduleName);
  form.append("topicName", payload.topicName);
  for (const file of payload.files) {
    form.append("files", file, file.name);
  }

  return request<{
    ok: true;
    uploaded: Array<{ id: string; fileName: string; mimeType: string; uploadedAt: string }>;
    skipped?: string[];
    documents: TopicDocument[];
  }>("/api/topic/files/upload", {
    method: "POST",
    body: form,
  });
}

export function fetchTopicFiles(moduleName: string, topicName: string) {
  const query = new URLSearchParams({ moduleName, topicName }).toString();
  return request<{ documents: TopicDocument[] }>(`/api/topic/files?${query}`);
}

export function generateTopicQuiz(payload: {
  moduleName: string;
  topicName: string;
}) {
  return request<{
    ok: true;
    quiz: GeneratedQuiz;
    generator: string;
    sourceDocumentCount: number;
    aiEnabled: boolean;
    difficultyPlan?: GeneratedQuiz["difficultyPlan"];
  }>("/api/topic/quiz/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchTopicQuizzes(moduleName: string, topicName: string) {
  const query = new URLSearchParams({ moduleName, topicName }).toString();
  return request<{ quizzes: GeneratedQuiz[] }>(`/api/topic/quizzes?${query}`);
}

export function submitTopicQuiz(payload: {
  quizId: string;
  answers: number[];
}) {
  return request<{
    ok: true;
    attempt: GeneratedQuizAttemptSummary & { percent: number };
    review: GeneratedQuizReviewItem[];
    masteryUpdate?: {
      oldMastery: number;
      newMastery: number;
      oldMasteryPct: number;
      newMasteryPct: number;
      gain: number;
      gainPct: number;
      decay: number;
      decayRatePct: number;
      difficultyPlan: {
        currentMasteryPct: number;
        targetMasteryPct: number;
        targetPostScore: number;
        requiredGainPct: number;
        difficulty: string;
      };
    };
  }>("/api/topic/quiz/submit", {
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
      oldMasteryPct?: number;
      newMasteryPct?: number;
      gainPct?: number;
      decayRatePct?: number;
      difficultyPlan?: {
        currentMasteryPct: number;
        targetMasteryPct: number;
        targetPostScore: number;
        requiredGainPct: number;
        difficulty: string;
      };
    };
  }>("/api/quiz/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchDueQuizzes() {
  return request<{ due: Array<{ moduleName: string; topicName: string; type: string }> }>("/api/quizzes/due");
}

export function startSpacedReviewSession(payload: {
  moduleName: string;
  topicName: string;
}) {
  return request<{ ok: true; reviewRun: SpacedReviewRun }>("/api/topic/spaced-review/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeSpacedReviewSession(payload: {
  runId: string;
  flashcardsReviewed: Array<{ flashcardId: string; rating: "again" | "hard" | "good" | "easy" }>;
  answers: number[];
  sessionTimeMinutes?: number;
  focusedTimeMinutes?: number;
  distractionEvents?: number;
  activeInteractionTimeMinutes?: number;
}) {
  return request<{
    ok: true;
    runId: string;
    review: GeneratedQuizReviewItem[];
    result: {
      score: number;
      total: number;
      percent: number;
      sessionScore: number;
      quizScore: number;
    };
    masteryUpdate: {
      oldMastery: number;
      newMastery: number;
      oldMasteryPct: number;
      newMasteryPct: number;
      mastery_after_review: number;
      decayPerDay: number;
      lastReviewedAt: string;
      nextReviewAt: string;
      FES_session: number;
      LG_final: number;
    };
  }>("/api/topic/spaced-review/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateExamPlan(payload: {
  moduleName: string;
  examName?: string;
  examDate: string;
  topicsTested: string[];
}) {
  return request<{ ok: true; readiness: { score: number; reason: string } }>("/api/exam-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchReadiness() {
  return request<{ readiness: ReadinessItem[] }>("/api/readiness");
}

export function generateInsights(moduleName?: string) {
  return request<{ ok: true; insights: InsightPayload; aiEnabled: boolean }>("/api/insights/generate", {
    method: "POST",
    body: JSON.stringify(moduleName ? { moduleName } : {}),
  });
}

export function sendLearningChat(payload: {
  message: string;
  history?: LearningChatMessage[];
}) {
  return request<{ ok: true; reply: string; aiEnabled: boolean }>("/api/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function generateOnboardingPersona(payload: {
  welcome: Record<string, unknown>;
  prefs: Record<string, unknown>;
}) {
  return request<{ ok: true; analysis: OnboardingPersonaAnalysis; aiEnabled: boolean }>(
    "/api/onboarding/persona",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: false },
  );
}

export function uploadTopicDocuments(payload: {
  moduleName: string;
  topicName: string;
  files: File[];
}) {
  const form = new FormData();
  form.append("moduleName", payload.moduleName);
  form.append("topicName", payload.topicName);
  for (const file of payload.files) {
    form.append("files", file);
  }
  return request<{
    ok: true;
    documents: Array<{ id: string; name: string; path: string; uploadedAt: string }>;
  }>("/api/topic/upload", {
    method: "POST",
    body: form,
  });
}
