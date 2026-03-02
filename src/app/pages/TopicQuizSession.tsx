import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { fetchTopicQuizzes, GeneratedQuiz, GeneratedQuizReviewItem, submitTopicQuiz } from "../lib/api";
import { fromSlugMatch, toSlug } from "../lib/ids";
import { useAppData } from "../state/AppDataContext";

interface QuizResultState {
  score: number;
  total: number;
  percent: number;
  review: GeneratedQuizReviewItem[];
}

export default function TopicQuizSession() {
  const { moduleId, topicId, quizId } = useParams<{ moduleId: string; topicId: string; quizId: string }>();
  const navigate = useNavigate();
  const { state, loading, error, refresh } = useAppData();

  const [quiz, setQuiz] = useState<GeneratedQuiz | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResultState | null>(null);
  const [attemptLocked, setAttemptLocked] = useState(false);

  const moduleNames = state ? state.profile.modules : [];
  const moduleName = fromSlugMatch(moduleId || "", moduleNames || []);
  const moduleState = moduleName && state ? state.modules[moduleName] : null;
  const topicNames = moduleState ? Object.keys(moduleState.topics) : [];
  const topicName = fromSlugMatch(topicId || "", topicNames);

  const topicPath = useMemo(() => {
    if (!moduleName || !topicName) return "/dashboard/modules";
    return `/dashboard/modules/${toSlug(moduleName)}/topics/${toSlug(topicName)}`;
  }, [moduleName, topicName]);

  const hasStartedTopicSession = useMemo(() => {
    if (!state || !moduleName || !topicName) return false;
    return state.studySessions.some((session) => session.moduleName === moduleName && session.topicName === topicName);
  }, [state, moduleName, topicName]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuiz() {
      if (!moduleName || !topicName || !quizId) return;
      setResourceLoading(true);
      setResourceError("");
      try {
        const quizList = await fetchTopicQuizzes(moduleName, topicName);
        if (cancelled) return;
        const found = quizList.quizzes.find((item) => item.id === quizId) || null;
        if (!found) {
          setQuiz(null);
          setAttemptLocked(false);
          setResourceError("Quiz not found for this topic.");
          return;
        }
        setQuiz(found);
        setAttemptLocked(found.attemptCount > 0);
      } catch (err) {
        if (cancelled) return;
        setQuiz(null);
        setAttemptLocked(false);
        setResourceError(err instanceof Error ? err.message : "Failed to load quiz.");
      } finally {
        if (!cancelled) setResourceLoading(false);
      }
    }

    void loadQuiz();
    return () => {
      cancelled = true;
    };
  }, [moduleName, topicName, quizId]);

  const handleAnswerChange = (questionId: string, optionIndex: number) => {
    if (quizResult || attemptLocked) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmitQuiz = async () => {
    if (!quiz || !hasStartedTopicSession || attemptLocked) return;

    const answers = quiz.questions.map((question) => {
      const selected = selectedAnswers[question.id];
      return Number.isInteger(selected) ? selected : -1;
    });

    if (answers.some((answer) => answer < 0)) {
      setResourceError("Please answer every question before submitting the quiz.");
      return;
    }

    setSubmittingQuiz(true);
    setResourceError("");

    try {
      const result = await submitTopicQuiz({ quizId: quiz.id, answers });
      setQuizResult({
        score: result.attempt.score,
        total: result.attempt.total,
        percent: result.attempt.percent,
        review: result.review,
      });
      setAttemptLocked(true);
      await refresh();
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "Failed to submit quiz.");
    } finally {
      setSubmittingQuiz(false);
    }
  };

  if (loading && !state) {
    return <div className="p-8 text-muted-foreground">Loading quiz...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  if (!moduleName || !topicName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-medium text-foreground mb-2">Topic not found</h2>
          <Link to="/dashboard/modules" className="text-primary hover:underline">
            Back to modules
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Link to={topicPath} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="w-4 h-4" />
            Back to {topicName}
          </Link>
          <h1 className="text-3xl font-medium text-foreground">Topic Quiz</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {moduleName} · {topicName}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {resourceLoading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading quiz...
          </div>
        )}

        {resourceError && <div className="text-sm text-destructive">{resourceError}</div>}

        {!resourceLoading && !hasStartedTopicSession && (
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-sm text-foreground mb-4">Start a study session on this topic before taking its AI quiz.</p>
            <Button variant="outline" onClick={() => navigate(topicPath)}>
              Return to Topic
            </Button>
          </div>
        )}

        {!resourceLoading && quiz && hasStartedTopicSession && (
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-foreground">{quiz.title}</h2>
            </div>

            {attemptLocked && !quizResult && (
              <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3 text-sm text-foreground">
                This quiz has already been attempted and cannot be taken again.
              </div>
            )}

            <div className="space-y-5">
              {quiz.questions.map((question, index) => {
                const review = quizResult?.review.find((item) => item.questionId === question.id);
                return (
                  <div key={question.id} className="border border-border rounded-lg p-4">
                    <div className="font-medium text-foreground mb-3">
                      {index + 1}. {question.question}
                    </div>

                    <div className="space-y-2">
                      {question.options.map((option, optionIndex) => {
                        const selected = selectedAnswers[question.id] === optionIndex;
                        const isCorrect = review?.correctIndex === optionIndex;
                        const isWrongSelected = Boolean(review && selected && !review.isCorrect);
                        return (
                          <label
                            key={`${question.id}-${optionIndex}`}
                            className={`flex items-center gap-3 p-2 border rounded-md ${
                              selected ? "border-primary bg-primary/5" : "border-border"
                            } ${isCorrect ? "border-success bg-success/10" : ""} ${isWrongSelected ? "border-destructive bg-destructive/10" : ""} ${
                              attemptLocked ? "cursor-default" : "cursor-pointer"
                            }`}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              checked={selected}
                              onChange={() => handleAnswerChange(question.id, optionIndex)}
                              disabled={attemptLocked || Boolean(quizResult)}
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

            {!attemptLocked && !quizResult && (
              <div className="mt-5">
                <Button onClick={handleSubmitQuiz} disabled={submittingQuiz}>
                  {submittingQuiz ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Submit Quiz
                </Button>
              </div>
            )}

            {quizResult && (
              <div className="mt-4 p-4 border border-border rounded-lg bg-muted/20">
                <div className="text-sm font-medium text-foreground mb-3">
                  Score: {quizResult.score}/{quizResult.total} ({quizResult.percent}%)
                </div>
                <Button onClick={() => navigate(topicPath)}>End Quiz</Button>
              </div>
            )}

            {attemptLocked && !quizResult && (
              <div className="mt-4">
                <Button onClick={() => navigate(topicPath)}>End Quiz</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
