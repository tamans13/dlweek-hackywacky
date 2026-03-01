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
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAppData } from "../state/AppDataContext";
import { fromSlugMatch, toSlug } from "../lib/ids";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  GeneratedQuiz,
  GeneratedQuizReviewItem,
  TopicDocument,
  fetchTopicFiles,
  fetchTopicQuizzes,
  generateTopicQuiz,
  submitTopicQuiz,
  uploadTopicFiles,
} from "../lib/api";

function toPct(value: number) {
  return Math.round((value / 10) * 100);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function TopicDetail() {
  const { moduleId, topicId } = useParams<{ moduleId: string; topicId: string }>();
  const navigate = useNavigate();
  const { state, loading, error, submitQuizAttempt, deleteTopicData } = useAppData();

  const [form, setForm] = useState({ preScore: "", postScore: "", confidence: "3", aiUsed: false });
  const [resultMessage, setResultMessage] = useState("");

  const [documents, setDocuments] = useState<TopicDocument[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");

  const [quizzes, setQuizzes] = useState<GeneratedQuiz[]>([]);
  const [questionCount, setQuestionCount] = useState("5");
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittingGeneratedQuiz, setSubmittingGeneratedQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    score: number;
    total: number;
    percent: number;
    review: GeneratedQuizReviewItem[];
  } | null>(null);
  const [quizStatusMessage, setQuizStatusMessage] = useState("");

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

  const weaknesses = useMemo(() => {
    if (!topic || !attempts.length) return ["No quiz attempts yet for this topic."];
    const recentAttempts = attempts.slice(-5);
    const lowConfidence = recentAttempts.filter((a) => a.confidence <= 2).length;
    const dropCount = recentAttempts.filter((a) => a.postScore < a.preScore).length;
    const aiUsage = recentAttempts.filter((a) => a.aiUsed).length;
    const list: string[] = [];

    if (lowConfidence >= 2) list.push("Confidence is consistently low. Review core definitions before timed practice.");
    if (dropCount >= 1) list.push("Recent quizzes show regression; prioritize targeted remediation questions.");
    if (aiUsage >= 3) list.push("High AI-assist ratio detected. Add one no-assistance quiz to validate true mastery.");
    if (!list.length) list.push("No major weakness signal yet. Keep spaced repetition cadence.");
    return list;
  }, [attempts, topic]);

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

  const activeQuiz = useMemo(() => {
    if (!activeQuizId) return null;
    return quizzes.find((quiz) => quiz.id === activeQuizId) || null;
  }, [activeQuizId, quizzes]);

  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      if (!moduleName || !topicName) return;
      setResourceLoading(true);
      setResourceError("");
      try {
        const [docs, quizList] = await Promise.all([
          fetchTopicFiles(moduleName, topicName),
          fetchTopicQuizzes(moduleName, topicName),
        ]);

        if (cancelled) return;

        setDocuments(docs.documents);
        setQuizzes(quizList.quizzes);

        if (quizList.quizzes.length) {
          setActiveQuizId((prev) => prev || quizList.quizzes[0].id);
        } else {
          setActiveQuizId("");
        }
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

  const handleQuizSubmit = async () => {
    if (!moduleName || !topicName) return;
    const pre = Number(form.preScore);
    const post = Number(form.postScore);
    const confidence = Number(form.confidence);
    if (Number.isNaN(pre) || Number.isNaN(post)) return;

    const result = await submitQuizAttempt({
      moduleName,
      topicName,
      preScore: pre,
      postScore: post,
      confidence,
      aiUsed: form.aiUsed,
    });

    setResultMessage(
      `Mastery updated ${result.oldMastery.toFixed(2)} -> ${result.newMastery.toFixed(2)} (gain ${result.gain.toFixed(2)}, decay ${result.decay.toFixed(2)})`,
    );
    setForm({ preScore: "", postScore: "", confidence: "3", aiUsed: false });
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
      const files = await Promise.all(
        fileList.map(async (file) => ({
          name: file.name,
          type: file.type || "application/octet-stream",
          dataBase64: await readFileAsBase64(file),
        })),
      );

      const result = await uploadTopicFiles({ moduleName, topicName, files });
      setDocuments(result.documents);
      setUploadMessage(`${result.uploaded.length} file${result.uploaded.length === 1 ? "" : "s"} uploaded.`);
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      setUploadingFiles(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleGenerateQuiz = async () => {
    if (!moduleName || !topicName) return;

    setGeneratingQuiz(true);
    setQuizStatusMessage("");
    setQuizResult(null);
    setResourceError("");

    try {
      const count = Math.max(3, Math.min(10, Number(questionCount || 5)));
      const generated = await generateTopicQuiz({ moduleName, topicName, questionCount: count });

      setQuizStatusMessage(
        `Generated ${generated.quiz.questions.length} questions from ${generated.sourceDocumentCount} uploaded file${generated.sourceDocumentCount === 1 ? "" : "s"}.`,
      );

      const latest = await fetchTopicQuizzes(moduleName, topicName);
      setQuizzes(latest.quizzes);
      setActiveQuizId(generated.quiz.id);
      setSelectedAnswers({});
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "Failed to generate quiz.");
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleAnswerChange = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmitGeneratedQuiz = async () => {
    if (!activeQuiz || !moduleName || !topicName) return;

    const answers = activeQuiz.questions.map((question) => {
      const answer = selectedAnswers[question.id];
      return Number.isInteger(answer) ? answer : -1;
    });

    if (answers.some((answer) => answer < 0)) {
      setResourceError("Please answer every question before submitting the quiz.");
      return;
    }

    setSubmittingGeneratedQuiz(true);
    setResourceError("");

    try {
      const result = await submitTopicQuiz({ quizId: activeQuiz.id, answers });
      setQuizResult({
        score: result.attempt.score,
        total: result.attempt.total,
        percent: result.attempt.percent,
        review: result.review,
      });
      setQuizStatusMessage(`Quiz submitted. Score: ${result.attempt.score}/${result.attempt.total} (${result.attempt.percent}%).`);

      const latest = await fetchTopicQuizzes(moduleName, topicName);
      setQuizzes(latest.quizzes);
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "Failed to submit generated quiz.");
    } finally {
      setSubmittingGeneratedQuiz(false);
    }
  };

  const loadQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
    setSelectedAnswers({});
    setQuizResult(null);
    setQuizStatusMessage("");
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
              <span className="text-xs text-muted-foreground">Supports text files best for AI quiz generation.</span>
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

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground text-lg">AI Quiz Generator</h3>
            </div>

            <div className="flex items-end gap-3 mb-4">
              <div className="w-24">
                <Label>Questions</Label>
                <Input
                  type="number"
                  min="3"
                  max="10"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerateQuiz} disabled={generatingQuiz || !documents.length}>
                {generatingQuiz ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {generatingQuiz ? "Generating..." : "Generate Quiz"}
              </Button>
            </div>

            {quizStatusMessage && <p className="text-sm text-primary mb-3">{quizStatusMessage}</p>}

            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {!quizzes.length && <div className="text-sm text-muted-foreground">No generated quizzes yet.</div>}
              {quizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  type="button"
                  onClick={() => loadQuiz(quiz.id)}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    activeQuizId === quiz.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="font-medium text-sm text-foreground truncate">{quiz.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {quiz.questions.length} questions · created {new Date(quiz.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Attempts: {quiz.attemptCount}
                    {quiz.lastAttempt ? ` · latest ${quiz.lastAttempt.score}/${quiz.lastAttempt.total}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {resourceError && <div className="text-sm text-destructive">{resourceError}</div>}

        {activeQuiz && (
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-medium text-foreground text-lg">{activeQuiz.title}</h3>
              <Button onClick={handleSubmitGeneratedQuiz} disabled={submittingGeneratedQuiz}>
                {submittingGeneratedQuiz ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit AI Quiz
              </Button>
            </div>

            <div className="space-y-5">
              {activeQuiz.questions.map((question, index) => {
                const review = quizResult?.review.find((r) => r.questionId === question.id);
                return (
                  <div key={question.id} className="border border-border rounded-lg p-4">
                    <div className="font-medium text-foreground mb-3">
                      {index + 1}. {question.question}
                    </div>

                    <div className="space-y-2">
                      {question.options.map((option, optionIndex) => {
                        const selected = selectedAnswers[question.id] === optionIndex;
                        const isCorrect = review?.correctIndex === optionIndex;
                        const isWrongSelected = review && selected && !review.isCorrect;

                        return (
                          <label
                            key={`${question.id}-${optionIndex}`}
                            className={`flex items-center gap-3 p-2 border rounded-md cursor-pointer ${
                              selected ? "border-primary bg-primary/5" : "border-border"
                            } ${isCorrect ? "border-success bg-success/10" : ""} ${isWrongSelected ? "border-destructive bg-destructive/10" : ""}`}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              checked={selected}
                              onChange={() => handleAnswerChange(question.id, optionIndex)}
                              disabled={Boolean(quizResult)}
                            />
                            <span className="text-sm text-foreground">{option}</span>
                          </label>
                        );
                      })}
                    </div>

                    {review && (
                      <div className={`mt-3 text-xs ${review.isCorrect ? "text-success" : "text-destructive"}`}>
                        {review.isCorrect ? "Correct." : "Incorrect."}
                        {review.explanation ? ` ${review.explanation}` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {quizResult && (
              <div className="mt-4 p-4 border border-border rounded-lg bg-muted/20">
                <div className="text-sm font-medium text-foreground">
                  Score: {quizResult.score}/{quizResult.total} ({quizResult.percent}%)
                </div>
              </div>
            )}
          </div>
        )}

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
              <AlertCircle className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground text-lg">Specific Weaknesses</h3>
            </div>
            <div className="space-y-3">
              {weaknesses.map((weakness, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                  <p className="text-sm text-foreground">{weakness}</p>
                </div>
              ))}
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
                  <div className="font-medium text-foreground">{quiz.nextQuizType}</div>
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
                <div className="font-medium text-foreground">Spaced Repetition Review</div>
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
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => void handleUploadChange(e)} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Documents
          </Button>
          <Button variant="destructive" onClick={handleDeleteTopic}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Topic
          </Button>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-medium text-foreground text-lg mb-3">Uploaded Documents</h3>
          <div className="space-y-2">
            {!topic.documents?.length && <div className="text-sm text-muted-foreground">No uploaded documents yet.</div>}
            {(topic.documents || []).map((doc) => (
              <a
                key={doc.id}
                href={doc.path}
                target="_blank"
                rel="noreferrer"
                className="block p-3 border border-border rounded-lg text-sm text-foreground hover:bg-muted/40 transition-colors"
              >
                {doc.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
