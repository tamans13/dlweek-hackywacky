import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  BackendState,
  deleteTopic,
  fetchDueQuizzes,
  fetchReadiness,
  fetchState,
  generateInsights,
  logTabEvent,
  saveProfile,
  startStudySession,
  stopStudySession,
  submitQuiz,
  uploadTopicDocuments,
  updateExamPlan,
} from "../lib/api";

interface AppDataContextValue {
  state: BackendState | null;
  loading: boolean;
  error: string | null;
  dueQuizzes: Array<{ moduleName: string; topicName: string; type: string }>;
  readiness: Array<{ moduleName: string; score: number; reason: string; examPlan: any }>;
  refresh: () => Promise<void>;
  saveProfileData: (payload: {
    fullName?: string;
    email?: string;
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
    topicsTested: string[];
  }) => Promise<{ score: number; reason: string }>;
  uploadTopicFiles: (payload: { moduleName: string; topicName: string; files: File[] }) => Promise<void>;
  deleteTopicData: (payload: { moduleName: string; topicName: string }) => Promise<void>;
  runInsights: (moduleName?: string) => Promise<{ summary: string; actions: string[] }>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BackendState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dueQuizzes, setDueQuizzes] = useState<Array<{ moduleName: string; topicName: string; type: string }>>([]);
  const [readiness, setReadiness] = useState<Array<{ moduleName: string; score: number; reason: string; examPlan: any }>>([]);

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

  const saveProfileData = useCallback(
    async (payload: { fullName?: string; email?: string; university: string; yearOfStudy: string; courseOfStudy: string; modules: string[] }) => {
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
    async (payload: { moduleName: string; examDate: string; totalTopics: number; topicsCovered: number; topicsTested: string[] }) => {
      const result = await updateExamPlan(payload);
      await refresh();
      return result.readiness;
    },
    [refresh],
  );

  const deleteTopicData = useCallback(
    async (payload: { moduleName: string; topicName: string }) => {
      await deleteTopic(payload);
      await refresh();
    },
    [refresh],
  );

  const uploadTopicFiles = useCallback(
    async (payload: { moduleName: string; topicName: string; files: File[] }) => {
      await uploadTopicDocuments(payload);
      await refresh();
    },
    [refresh],
  );

  const runInsights = useCallback(async (moduleName?: string) => {
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
      uploadTopicFiles,
      deleteTopicData,
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
      uploadTopicFiles,
      deleteTopicData,
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
