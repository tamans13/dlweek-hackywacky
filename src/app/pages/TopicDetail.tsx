import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Calendar,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Upload,
  Trash2,
  FileText,
  Sparkles,
  Loader2,
  Play,
  Square,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAppData } from "../state/AppDataContext";
import { fromSlugMatch, toSlug } from "../lib/ids";
import { Button } from "../components/ui/button";
import {
  GeneratedQuiz,
  TopicDocument,
  fetchTopicFiles,
  fetchTopicQuizzes,
  fetchTopicWeaknesses,
  generateTopicQuiz,
  uploadTopicFiles,
} from "../lib/api";

function toPct(value: number) {
  return Math.round((value / 10) * 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDifficultyLabel(difficulty?: string | null) {
  const value = String(difficulty || "medium").trim().toLowerCase();
  if (value === "easy" || value === "medium" || value === "hard") {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
  }
  return "Medium";
}

function nextDifficultyFromCompletedCount(completedCount: number) {
  if (completedCount <= 0) return "Easy";
  if (completedCount === 1) return "Medium";
  return "Hard";
}

export default function TopicDetail() {
  const { moduleId, topicId } = useParams<{ moduleId: string; topicId: string }>();
  const navigate = useNavigate();
  const { state, loading, error, deleteTopicData, startSession, stopSession } = useAppData();

  const [documents, setDocuments] = useState<TopicDocument[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [weaknesses, setWeaknesses] = useState<string[]>(["No quiz attempts yet for this topic."]);
  const [weaknessesLoading, setWeaknessesLoading] = useState(false);

  const [quizzes, setQuizzes] = useState<GeneratedQuiz[]>([]);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizStatusMessage, setQuizStatusMessage] = useState("");

  const [sessionStatusMessage, setSessionStatusMessage] = useState("");
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const moduleNames = state ? state.profile.modules : [];
  const moduleName = fromSlugMatch(moduleId || "", moduleNames || []);
  const moduleState = moduleName && state ? state.modules[moduleName] : null;

  const topicNames = moduleState ? Object.keys(moduleState.topics) : [];
  const topicName = fromSlugMatch(topicId || "", topicNames);
  const topic = topicName && moduleState ? moduleState.topics[topicName] : null;

  const attempts = useMemo(() => {
    if (!state || !moduleName || !topicName) return [];
    return state.quizAttempts
      .filter((q) => q.moduleName === moduleName && q.topicName === topicName)
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  }, [state, moduleName, topicName]);

  const masteryTrend = useMemo(() => {
    if (!topic) return [];
    if (!attempts.length) {
      return [
        {
          date: new Date(topic.lastInteractionAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          mastery: 0,
        },
      ];
    }
    const historyPoints = topic.history.map((h) => ({
      date: new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      mastery: toPct(h.newMastery),
    }));
    return historyPoints;
  }, [topic, attempts.length]);

  const studySessions = useMemo(() => {
    if (!state || !moduleName || !topicName) return [];
    return state.studySessions
      .filter((s) => s.moduleName === moduleName && s.topicName === topicName && s.endAt)
      .slice(-6)
      .map((s) => {
        const mins = Math.max(1, Math.round((new Date(s.endAt as string).getTime() - new Date(s.startAt).getTime()) / 60000));
        return {
          date: new Date(s.startAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          duration: `${mins} min`,
        };
      });
  }, [state, moduleName, topicName]);

  const masteryProjection = useMemo(() => {
    if (!topic) return [];

    const rawCurrent = Number(topic.estimatedMasteryNow ?? topic.mastery ?? 0);
    const currentMasteryPct = clamp(rawCurrent <= 10 ? rawCurrent * 10 : rawCurrent, 0, 100);

    // --- Forgetting curve parameters (separated from scheduling) ---
    // baseDecayRate controls how quickly an unreviewed memory fades.
    // memoryStrength scales that decay – higher strength = slower forgetting.
    const horizonDays = 30;
    const baseDecayRate = 0.22; // per-day baseline decay
    const maxStrength = 4.0;

    // Derive an initial memory strength and review count from quiz history.
    const reviewCount = attempts.length;
    const baseMemoryStrength = clamp(1 + reviewCount * 0.25, 1, maxStrength);

    const applyForgetting = (
      mastery: number,
      decayRate: number,
      memoryStrength: number,
      days: number,
    ) => {
      const effectiveLambda = decayRate / Math.max(0.5, memoryStrength);
      return clamp(mastery * Math.exp(-effectiveLambda * days), 0, 100);
    };

    // --- Spaced review scheduling logic (no UI, pure data) ---
    interface SimulationResult {
      rows: Array<{
        date: string;
        noReview: number;
        withSpacedReview: number;
      }>;
      reviewDays: number[];
      totalReviews: number;
    }

    const simulateSpacedReviews = (): SimulationResult => {
      const today = startOfDay(new Date());
      const rows: Array<{
        date: string;
        noReview: number;
        withSpacedReview: number;
      }> = [];

      // No‑review path: same forgetting curve, but without any boosts.
      let noReviewMastery = currentMasteryPct;
      const noReviewMemoryStrength = baseMemoryStrength;

      // Spaced‑review path state.
      let spacedMastery = currentMasteryPct;
      let spacedMemoryStrength = baseMemoryStrength;
      const reviewDays: number[] = [];
      let lastReviewDay = -Infinity;

      for (let day = 0; day <= horizonDays; day += 1) {
        const at = addDays(today, day);

        // --- No‑review forecast for this day ---
        if (day > 0) {
          noReviewMastery = applyForgetting(
            noReviewMastery,
            baseDecayRate,
            noReviewMemoryStrength,
            1,
          );
        }

        // --- Spaced‑review forecast for this day ---
        if (day > 0) {
          // Natural decay from yesterday to today.
          spacedMastery = applyForgetting(
            spacedMastery,
            baseDecayRate,
            spacedMemoryStrength,
            1,
          );
        }

        // Predict what tomorrow would look like *without* an extra review.
        const predictedTomorrow = applyForgetting(
          spacedMastery,
          baseDecayRate,
          spacedMemoryStrength,
          1,
        );

        const canReviewToday = day - lastReviewDay >= 1;
        const needsReviewToBeatThreshold = predictedTomorrow < 75;

        if (canReviewToday && needsReviewToBeatThreshold) {
          // --- Review update rules (single review per day, min spacing 1 day) ---
          const reviewBoost = 12 + (100 - spacedMastery) * 0.35;
          spacedMastery = clamp(spacedMastery + reviewBoost, 0, 100);
          spacedMemoryStrength = Math.min(maxStrength, spacedMemoryStrength * 1.18);
          lastReviewDay = day;
          reviewDays.push(day);
        }

        rows.push({
          date: dateLabel(at),
          noReview: Math.round(noReviewMastery),
          withSpacedReview: Math.round(spacedMastery),
        });
      }

      return {
        rows,
        reviewDays,
        totalReviews: reviewDays.length,
      };
    };

    const { rows } = simulateSpacedReviews();
    return rows;
  }, [topic, attempts]);

  const activeSession = useMemo(() => {
    if (!state) return null;
    return [...state.studySessions].reverse().find((session) => !session.endAt) || null;
  }, [state]);

  const activeTopicSession = useMemo(() => {
    if (!activeSession || !moduleName || !topicName) return null;
    if (activeSession.moduleName !== moduleName || activeSession.topicName !== topicName) return null;
    return activeSession;
  }, [activeSession, moduleName, topicName]);

  const hasStartedTopicSession = useMemo(() => {
    if (!state || !moduleName || !topicName) return false;
    return state.studySessions.some((session) => session.moduleName === moduleName && session.topicName === topicName);
  }, [state, moduleName, topicName]);
  const hasCompletedTopicSession = useMemo(() => {
    if (!state || !moduleName || !topicName) return false;
    return state.studySessions.some((session) => session.moduleName === moduleName && session.topicName === topicName && Boolean(session.endAt));
  }, [state, moduleName, topicName]);
  const weaknessRefreshKey = useMemo(() => {
    if (!attempts.length) return "none";
    const lastAttempt = attempts[attempts.length - 1];
    return `${attempts.length}:${lastAttempt.id}:${lastAttempt.submittedAt}:${lastAttempt.postScore}`;
  }, [attempts]);

  useEffect(() => {
    if (!activeTopicSession) {
      setSessionSeconds(0);
      return;
    }

    const tick = () => {
      const secs = Math.max(0, Math.floor((Date.now() - new Date(activeTopicSession.startAt).getTime()) / 1000));
      setSessionSeconds(secs);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTopicSession]);

  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      if (!moduleName || !topicName) return;
      setResourceLoading(true);
      setResourceError("");
      try {
        const [docs, quizList] = await Promise.all([fetchTopicFiles(moduleName, topicName), fetchTopicQuizzes(moduleName, topicName)]);

        if (cancelled) return;

        setDocuments(docs.documents);
        setQuizzes(quizList.quizzes);
      } catch (err) {
        if (cancelled) return;
        setResourceError(err instanceof Error ? err.message : "Failed to load topic resources.");
      } finally {
        if (!cancelled) setResourceLoading(false);
      }
    }

    void loadResources();

    return () => {
      cancelled = true;
    };
  }, [moduleName, topicName]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeaknesses() {
      if (!moduleName || !topicName) return;
      setWeaknessesLoading(true);
      try {
        const report = await fetchTopicWeaknesses(moduleName, topicName);
        if (cancelled) return;
        const next = Array.isArray(report.weaknesses)
          ? report.weaknesses.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
        setWeaknesses(next.length ? next : ["No specific weakness signals yet for this topic."]);
      } catch {
        if (cancelled) return;
        setWeaknesses(["Unable to load AI weakness analysis right now."]);
      } finally {
        if (!cancelled) setWeaknessesLoading(false);
      }
    }

    void loadWeaknesses();

    return () => {
      cancelled = true;
    };
  }, [moduleName, topicName, weaknessRefreshKey]);

  const handleStartTopicSession = async () => {
    if (!moduleName || !topicName) return;

    setSessionStatusMessage("");
    setResourceError("");

    if (activeSession && !activeTopicSession) {
      setResourceError(`A study session is already active for ${activeSession.moduleName} - ${activeSession.topicName}. End it before starting this topic session.`);
      return;
    }

    try {
      await startSession(moduleName, topicName);
      setSessionStatusMessage("Study session started.");
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "Failed to start study session.");
    }
  };

  const handleEndTopicSession = async () => {
    if (!activeTopicSession) return;
    setSessionStatusMessage("");
    setResourceError("");

    try {
      await stopSession(activeTopicSession.id);
      setSessionStatusMessage("Study session ended. AI quiz generation is now unlocked for this topic.");
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "Failed to end study session.");
    }
  };

  const handleDeleteTopic = async () => {
    if (!moduleName || !topicName) return;
    if (!window.confirm(`Delete topic "${topicName}" from ${moduleName}? This will remove related quiz/study/tab records.`)) return;
    await deleteTopicData({ moduleName, topicName });
    navigate(`/dashboard/modules/${toSlug(moduleName)}`);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!moduleName || !topicName) return;

    const fileList = Array.from(event.target.files || []);
    if (!fileList.length) return;

    setUploadingFiles(true);
    setUploadMessage("");
    setResourceError("");

    try {
      const result = await uploadTopicFiles({ moduleName, topicName, files: fileList });
      setDocuments(result.documents);
      const uploadedCount = result.uploaded.length;
      const skippedCount = Array.isArray(result.skipped) ? result.skipped.length : 0;
      if (uploadedCount > 0 && skippedCount > 0) {
        setUploadMessage(`${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded, ${skippedCount} duplicate file${skippedCount === 1 ? "" : "s"} skipped.`);
      } else if (uploadedCount > 0) {
        setUploadMessage(`${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded.`);
      } else if (skippedCount > 0) {
        setUploadMessage(`No new files uploaded. ${skippedCount} duplicate file${skippedCount === 1 ? "" : "s"} skipped.`);
      } else {
        setUploadMessage("No files were uploaded.");
      }
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      setUploadingFiles(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleGenerateQuiz = async () => {
    if (!moduleName || !topicName) return;

    if (!hasCompletedTopicSession) {
      setResourceError("Complete a study session for this topic before generating an AI quiz.");
      return;
    }
    const pendingQuiz = quizzes.find((quiz) => quiz.attemptCount === 0);
    if (pendingQuiz) {
      setQuizStatusMessage("Complete your current quiz to unlock the next higher-difficulty quiz.");
      return;
    }

    setGeneratingQuiz(true);
    setQuizStatusMessage("");
    setResourceError("");

    try {
      const generated = await generateTopicQuiz({ moduleName, topicName });

      setQuizStatusMessage(
        `Generated ${generated.quiz.questions.length} questions from ${generated.sourceDocumentCount} uploaded file${generated.sourceDocumentCount === 1 ? "" : "s"}.`,
      );

      const latest = await fetchTopicQuizzes(moduleName, topicName);
      setQuizzes(latest.quizzes);
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "Failed to generate quiz.");
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleTakeQuiz = (quiz: GeneratedQuiz) => {
    if (!moduleName || !topicName) return;
    navigate(`/dashboard/modules/${toSlug(moduleName)}/topics/${toSlug(topicName)}/quizzes/${encodeURIComponent(quiz.id)}`);
  };

  const handleStartSpacedReview = () => {
    if (!moduleName || !topicName) return;
    if (!hasStartedTopicSession) {
      setResourceError("Start a study session timer for this topic before starting spaced repetition revision.");
      return;
    }
    navigate(`/dashboard/modules/${toSlug(moduleName)}/topics/${toSlug(topicName)}/spaced-review`);
  };

  if (loading && !state) {
    return <div className="p-8 text-muted-foreground">Loading topic...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  if (!topic || !moduleName || !moduleState || !topicName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-medium text-foreground mb-2">Topic not found</h2>
          <Link to="/dashboard" className="text-primary hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const masteryNow = attempts.length ? (topic.estimatedMasteryNow ?? topic.mastery) : 0;
  const masteryPct = toPct(masteryNow);
  const retentionDecay = attempts.length ? Math.max(0, Math.round((topic.mastery - masteryNow) * 10)) : 0;
  const risk = retentionDecay > 30 ? "high" : retentionDecay > 12 ? "medium" : "low";
  const pendingGeneratedQuiz = quizzes.find((quiz) => quiz.attemptCount === 0) || null;
  const completedGeneratedQuizCount = quizzes.filter((quiz) => quiz.attemptCount > 0).length;
  const nextQuizDifficulty = nextDifficultyFromCompletedCount(completedGeneratedQuizCount);
  const quizGenerationLocked = Boolean(pendingGeneratedQuiz);

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link
            to={`/dashboard/modules/${toSlug(moduleName)}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {moduleName}
          </Link>
          <h1 className="text-3xl font-medium text-foreground">{topicName}</h1>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mastery:</span>
              <span className="text-lg font-medium text-foreground">{masteryPct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Decay:</span>
              <span className={`text-lg font-medium ${risk === "high" ? "text-destructive" : risk === "medium" ? "text-warning" : "text-success"}`}>
                {retentionDecay}%
              </span>
            </div>
            <span className={`text-xs px-3 py-1.5 rounded ${risk === "high" ? "bg-destructive/10 text-destructive" : risk === "medium" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
              {risk === "high" ? "High Risk" : risk === "medium" ? "Medium Risk" : "Low Risk"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h3 className="font-medium text-foreground text-lg">Topic Study Session</h3>
            {!activeTopicSession ? (
              <Button onClick={handleStartTopicSession} disabled={Boolean(activeSession && !activeTopicSession)}>
                <Play className="w-4 h-4 mr-2" />
                Start Study Session
              </Button>
            ) : (
              <Button variant="outline" onClick={handleEndTopicSession}>
                <Square className="w-4 h-4 mr-2" />
                End Session
              </Button>
            )}
          </div>

          {activeTopicSession ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="text-sm text-muted-foreground">Session in progress for this topic</div>
              <div className="text-2xl font-medium text-primary mt-1">{formatDuration(sessionSeconds)}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {activeSession
                ? `Another topic session is active: ${activeSession.moduleName} - ${activeSession.topicName}.`
                : hasCompletedTopicSession
                  ? "You have completed at least one session for this topic. AI quiz access is unlocked."
                  : "Start the topic timer to unlock AI quiz generation and attempts for this topic."}
            </div>
          )}

          {sessionStatusMessage && <p className="text-sm text-primary mt-3">{sessionStatusMessage}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground text-lg">Topic Documents</h3>
            </div>

            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />

            <div className="flex items-center gap-3 mb-4">
              <Button variant="outline" disabled={uploadingFiles} onClick={() => fileInputRef.current?.click()}>
                {uploadingFiles ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploadingFiles ? "Uploading..." : "Upload Documents"}
              </Button>
              <span className="text-xs text-muted-foreground">Supports PDF, DOCX, PPTX, TXT, MD, CSV, and code files for AI quiz generation.</span>
            </div>

            {uploadMessage && <p className="text-sm text-primary mb-3">{uploadMessage}</p>}

            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {resourceLoading && <div className="text-sm text-muted-foreground">Loading documents...</div>}
              {!resourceLoading && !documents.length && <div className="text-sm text-muted-foreground">No uploaded documents for this topic yet.</div>}
              {documents.map((doc) => (
                <div key={doc.id} className="border border-border rounded-lg p-3">
                  <div className="font-medium text-sm text-foreground truncate">{doc.fileName}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {doc.mimeType}
                  </div>
                  <div className="text-xs mt-1 text-muted-foreground">
                    {doc.textExtracted ? "Text extracted for quiz generation" : "No text extraction available"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-medium text-foreground text-lg">Spaced Repetition Revision</h3>
              </div>

              <Button variant="outline" onClick={handleStartSpacedReview} disabled={!hasStartedTopicSession}>
                Start Spaced Repetition Revision
              </Button>

              {!hasStartedTopicSession && (
                <p className="text-xs text-muted-foreground mt-3">Start the topic study session timer to unlock spaced repetition revision.</p>
              )}
            </div>

            {hasCompletedTopicSession && (
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="font-medium text-foreground text-lg">AI Quiz Generator</h3>
                </div>

                <div className="flex items-end gap-3 mb-4">
                  <Button onClick={handleGenerateQuiz} disabled={generatingQuiz || !documents.length || quizGenerationLocked}>
                    {generatingQuiz ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {generatingQuiz ? "Generating..." : quizGenerationLocked ? "Complete Current Quiz" : "Generate Quiz"}
                  </Button>
                  <span className="text-xs text-muted-foreground">Next quiz difficulty: {nextQuizDifficulty} (AI decides question count, max 10).</span>
                </div>

                {quizGenerationLocked && (
                  <p className="text-xs text-muted-foreground mb-3">Finish your current quiz attempt to unlock generation of the next higher-difficulty quiz.</p>
                )}
                {quizStatusMessage && <p className="text-sm text-primary mb-3">{quizStatusMessage}</p>}

                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {!quizzes.length && <div className="text-sm text-muted-foreground">No generated quizzes yet.</div>}
                  {quizzes.map((quiz) => {
                    const completed = quiz.attemptCount > 0;
                    const difficulty = formatDifficultyLabel(quiz.difficultyPlan?.difficulty);
                    return (
                      <div key={quiz.id} className="w-full border rounded-lg p-3 border-border">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-sm text-foreground truncate">{quiz.title}</div>
                          <span className="text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground whitespace-nowrap">Difficulty: {difficulty}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {quiz.questions.length} questions · created {new Date(quiz.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Attempts: {quiz.attemptCount}
                          {quiz.lastAttempt ? ` · latest ${quiz.lastAttempt.score}/${quiz.lastAttempt.total}` : ""}
                        </div>
                        {quiz.attempts.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {quiz.attempts.slice(0, 5).map((attempt) => {
                              const percent = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
                              return (
                                <div key={attempt.id} className="text-[11px] text-muted-foreground">
                                  {new Date(attempt.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}: {attempt.score}/{attempt.total} ({percent}%)
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTakeQuiz(quiz)}
                          >
                            {completed ? "Reattempt Quiz" : "Take Quiz"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {resourceError && <div className="text-sm text-destructive">{resourceError}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground text-lg">Mastery Trend</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={masteryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.5rem",
                  }}
                />
                <Line type="monotone" dataKey="mastery" stroke="var(--color-primary)" strokeWidth={2} dot={{ fill: "var(--color-primary)", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground text-lg">1-Month Predicted Mastery</h3>
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              Projection compares natural decay vs doing spaced repetition on assigned review days.
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={masteryProjection}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} domain={[0, 100]} />
                <Legend />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.5rem",
                  }}
                />
                <Line type="monotone" dataKey="noReview" name="No Review" stroke="#DC2626" strokeDasharray="6 4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="withSpacedReview" name="With Spaced Review" stroke="#2563EB" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground text-lg">Specific Weaknesses</h3>
            </div>
            <div className="space-y-3">
              {weaknessesLoading ? (
                <div className="text-sm text-muted-foreground">Analyzing quiz mistakes...</div>
              ) : (
                weaknesses.map((weakness, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                    <p className="text-sm text-foreground">{weakness}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground text-lg">Quiz Performance History</h3>
          </div>
          <div className="space-y-3">
            {!attempts.length && <div className="text-sm text-muted-foreground">No quiz attempts yet for this topic.</div>}
            {attempts.map((quiz) => (
              <div key={quiz.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-foreground">{topicName} Quiz</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(quiz.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-medium text-foreground">{quiz.postScore}%</span>
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`${quiz.postScore >= 80 ? "bg-success" : quiz.postScore >= 60 ? "bg-warning" : "bg-destructive"} h-full`} style={{ width: `${quiz.postScore}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground text-lg">Topic Schedule</h3>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Upcoming Reviews</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                <div className="text-sm font-medium text-muted-foreground w-24 flex-shrink-0">
                  {new Date(topic.nextReviewAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
                <div className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                <div className="font-medium text-foreground">Reminder to do your flashcards!</div>
              </div>
              {state?.examPlans[moduleName] && (
                <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <div className="text-sm font-medium text-muted-foreground w-24 flex-shrink-0">
                    {new Date(state.examPlans[moduleName].examDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                  <div className="font-medium text-foreground">Module Exam</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Past Study Sessions</h4>
            <div className="space-y-2">
              {!studySessions.length && <div className="text-sm text-muted-foreground">No completed study sessions yet.</div>}
              {studySessions.map((session, index) => (
                <div key={`${session.date}-${index}`} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="text-sm font-medium text-foreground">{session.date}</div>
                  <div className="text-sm text-muted-foreground">{session.duration}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="destructive" onClick={handleDeleteTopic}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Topic
          </Button>
        </div>
      </div>
    </div>
  );
}
