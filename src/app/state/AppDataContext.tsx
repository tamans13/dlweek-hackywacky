import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  BackendState,
  fetchDueQuizzes,
  fetchReadiness,
  fetchState,
  generateInsights,
  logTabEvent,
  saveProfile,
  startStudySession,
  stopStudySession,
  submitQuiz,
  updateExamPlan,
} from "../lib/api";
import { startExtensionTracking, stopExtensionTracking } from "../lib/extension";

interface AppDataContextValue {
  state: BackendState | null;
  loading: boolean;
  error: string | null;
  dueQuizzes: Array<{ moduleName: string; topicName: string; type: string }>;
  readiness: Array<{ moduleName: string; score: number; reason: string; examPlan: any }>;
  refresh: () => Promise<void>;
  saveProfileData: (payload: {
    university: string;
    yearOfStudy: string;
    courseOfStudy: string;
    modules: string[];
  }) => Promise<void>;
  startSession: (moduleName: string, topicName: string) => Promise<string>;
  stopSession: (sessionId: string) => Promise<void>;
  logTab: (payload: {
    moduleName: string;
    topicName?: string;
    url: string;
    eventType?: string;
    userLabel?: string | null;
  }) => Promise<void>;
  submitQuizAttempt: (payload: {
    moduleName: string;
    topicName: string;
    preScore: number;
    postScore: number;
    confidence: number;
    aiUsed: boolean;
  }) => Promise<{
    oldMastery: number;
    newMastery: number;
    gain: number;
    decay: number;
  }>;
  saveExamPlan: (payload: {
    moduleName: string;
    examDate: string;
    totalTopics: number;
    topicsCovered: number;
  }) => Promise<{ score: number; reason: string }>;
  runInsights: (moduleName: string) => Promise<{ summary: string; actions: string[] }>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BackendState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dueQuizzes, setDueQuizzes] = useState<Array<{ moduleName: string; topicName: string; type: string }>>([]);
  const [readiness, setReadiness] = useState<Array<{ moduleName: string; score: number; reason: string; examPlan: any }>>([]);
  const lastSyncedSessionId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextState, due, ready] = await Promise.all([fetchState(), fetchDueQuizzes(), fetchReadiness()]);
      setState(nextState);
      setDueQuizzes(due.due);
      setReadiness(ready.readiness);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep extension tracking synced to active study session state.
  useEffect(() => {
    if (!state?.studySessions) return;

    const activeSession = [...state.studySessions].reverse().find((session) => !session.endAt) || null;
    if (activeSession?.id === lastSyncedSessionId.current) return;

    if (activeSession?.id) {
      lastSyncedSessionId.current = activeSession.id;
      startExtensionTracking(activeSession.id).catch(() => { });
    } else {
      lastSyncedSessionId.current = null;
      stopExtensionTracking("no_active_study_session").catch(() => { });
    }
  }, [state]);

  // Handle telemetry + terminate events from the Chrome extension.
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== "brainosaur-extension") return;

      const payload = data.payload;

      if (payload?.event === "terminate_session" && payload.sessionId) {
        await stopStudySession(payload.sessionId);
        await refresh();
        await stopExtensionTracking(payload.reason || "terminated_from_overlay").catch(() => { });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refresh]);

  const saveProfileData = useCallback(
    async (payload: { university: string; yearOfStudy: string; courseOfStudy: string; modules: string[] }) => {
      await saveProfile(payload);
      await refresh();
    },
    [refresh],
  );

  const startSession = useCallback(
    async (moduleName: string, topicName: string) => {
      const result = await startStudySession(moduleName, topicName);
      await refresh();
      return result.session.id;
    },
    [refresh],
  );

  const stopSession = useCallback(
    async (sessionId: string) => {
      await stopStudySession(sessionId);
      await refresh();
    },
    [refresh],
  );

  const logTab = useCallback(
    async (payload: { moduleName: string; topicName?: string; url: string; eventType?: string; userLabel?: string | null }) => {
      await logTabEvent(payload);
      await refresh();
    },
    [refresh],
  );

  const submitQuizAttempt = useCallback(
    async (payload: {
      moduleName: string;
      topicName: string;
      preScore: number;
      postScore: number;
      confidence: number;
      aiUsed: boolean;
    }) => {
      const result = await submitQuiz(payload);
      await refresh();
      return result.masteryUpdate;
    },
    [refresh],
  );

  const saveExamPlan = useCallback(
    async (payload: { moduleName: string; examDate: string; totalTopics: number; topicsCovered: number }) => {
      const result = await updateExamPlan(payload);
      await refresh();
      return result.readiness;
    },
    [refresh],
  );

  const runInsights = useCallback(async (moduleName: string) => {
    const result = await generateInsights(moduleName);
    await refresh();
    return result.insights;
  }, [refresh]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      state,
      loading,
      error,
      dueQuizzes,
      readiness,
      refresh,
      saveProfileData,
      startSession,
      stopSession,
      logTab,
      submitQuizAttempt,
      saveExamPlan,
      runInsights,
    }),
    [
      state,
      loading,
      error,
      dueQuizzes,
      readiness,
      refresh,
      saveProfileData,
      startSession,
      stopSession,
      logTab,
      submitQuizAttempt,
      saveExamPlan,
      runInsights,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}
