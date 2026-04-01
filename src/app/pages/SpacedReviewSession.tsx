import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  completeSpacedReviewSession,
  GeneratedQuizReviewItem,
  SpacedReviewRun,
  startSpacedReviewSession,
} from "../lib/api";
import { fromSlugMatch, toSlug } from "../lib/ids";
import { useAppData } from "../state/AppDataContext";

type FlashcardRating = "again" | "hard" | "good" | "easy";

function formatClock(totalSeconds: number) {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function SpacedReviewSession() {
  const { moduleId, topicId } = useParams<{ moduleId: string; topicId: string }>();
  const navigate = useNavigate();
  const { state, loading, error, refresh } = useAppData();

  const [run, setRun] = useState<SpacedReviewRun | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [ratings, setRatings] = useState<Record<string, FlashcardRating>>({});
  const [phase, setPhase] = useState<"flashcards" | "quiz" | "result">("flashcards");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    review: GeneratedQuizReviewItem[];
    outcome: {
      score: number;
      total: number;
      percent: number;
      sessionScore: number;
      quizScore: number;
    };
    masteryUpdate: {
      mastery_after_review: number;
      decayPerDay: number;
      nextReviewAt: string;
      FES_session: number;
      LG_final: number;
    };
  } | null>(null);

  const startedAtRef = useRef<number>(Date.now());

  const moduleNames = state ? state.profile.modules : [];
  const moduleName = fromSlugMatch(moduleId || "", moduleNames || []);
  const moduleState = moduleName && state ? state.modules[moduleName] : null;
  const topicNames = moduleState ? Object.keys(moduleState.topics) : [];
  const topicName = fromSlugMatch(topicId || "", topicNames);

  const topicPath = useMemo(() => {
    if (!moduleName || !topicName) return "/dashboard/modules";
    return `/dashboard/modules/${toSlug(moduleName)}/topics/${toSlug(topicName)}`;
  }, [moduleName, topicName]);

  useEffect(() => {
    let cancelled = false;
    async function startRun() {
      if (!moduleName || !topicName) return;
      setResourceLoading(true);
      setResourceError("");
      try {
        const started = await startSpacedReviewSession({ moduleName, topicName });
        if (cancelled) return;
        setRun(started.reviewRun);
        setPhase("flashcards");
        startedAtRef.current = new Date(started.reviewRun.startedAt).getTime();
      } catch (err) {
        if (cancelled) return;
        setResourceError(err instanceof Error ? err.message : "Failed to start spaced review.");
      } finally {
        if (!cancelled) setResourceLoading(false);
      }
    }
    void startRun();
    return () => {
      cancelled = true;
    };
  }, [moduleName, topicName]);

  useEffect(() => {
    if (!run) return;
    const tick = () => {
      const durationSeconds = Math.max(60, Math.round(run.durationMinutes * 60));
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
      setSecondsLeft(Math.max(0, durationSeconds - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [run]);

  const allCardsRated = run ? run.flashcards.every((card) => Boolean(ratings[card.id])) : false;
  const currentCard = run?.flashcards[currentCardIndex] || null;

  const handleRateCard = (rating: FlashcardRating) => {
    if (!currentCard || phase !== "flashcards") return;
    setRatings((prev) => ({ ...prev, [currentCard.id]: rating }));
    setShowBack(false);
    if (run && currentCardIndex < run.flashcards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      return;
    }
    if (run && run.flashcards.every((card, idx) => idx === currentCardIndex ? true : Boolean(ratings[card.id]))) {
      setPhase("quiz");
    }
  };

  const handleSubmitReview = async () => {
    if (!run) return;
    const quizQuestions = run.miniQuiz.questions || [];
    const answers = quizQuestions.map((q) => {
      const selected = quizAnswers[q.id];
      return Number.isInteger(selected) ? selected : -1;
    });
    if (answers.some((a) => a < 0)) {
      setResourceError("Answer every mini quiz question before submitting.");
      return;
    }

    setSubmitting(true);
    setResourceError("");
    try {
      const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
      const flashcardsReviewed = Object.entries(ratings).map(([flashcardId, rating]) => ({
        flashcardId,
        rating,
      }));
      const focusedRatio =
        flashcardsReviewed.length
          ? flashcardsReviewed.reduce((sum, item) => {
            if (item.rating === "easy") return sum + 1;
            if (item.rating === "good") return sum + 0.85;
            if (item.rating === "hard") return sum + 0.65;
            return sum + 0.4;
          }, 0) / flashcardsReviewed.length
          : 0.75;

      const completed = await completeSpacedReviewSession({
        runId: run.id,
        flashcardsReviewed,
        answers,
        sessionTimeMinutes: Math.min(15, elapsedMinutes),
        focusedTimeMinutes: Math.min(15, elapsedMinutes) * focusedRatio,
        distractionEvents: 0,
        activeInteractionTimeMinutes: Math.min(15, elapsedMinutes),
      });

      setResult({
        review: completed.review,
        outcome: completed.result,
        masteryUpdate: {
          mastery_after_review: completed.masteryUpdate.mastery_after_review,
          decayPerDay: completed.masteryUpdate.decayPerDay,
          nextReviewAt: completed.masteryUpdate.nextReviewAt,
          FES_session: completed.masteryUpdate.FES_session,
          LG_final: completed.masteryUpdate.LG_final,
        },
      });
      setPhase("result");
      await refresh();
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : "Failed to complete spaced review.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !state) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

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
          <Link to={topicPath} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to {topicName}
          </Link>
          <h1 className="text-3xl font-medium text-foreground">15-Min Spaced Repetition</h1>
          <p className="text-sm text-muted-foreground mt-2">{moduleName} · {topicName}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Session flow: Flashcards first, then mini AI quiz.
          </div>
          <div className="text-lg font-medium text-primary">{formatClock(secondsLeft)}</div>
        </div>

        {resourceLoading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing flashcards and mini quiz...
          </div>
        )}

        {resourceError && <div className="text-sm text-destructive">{resourceError}</div>}

        {!resourceLoading && run && phase === "flashcards" && currentCard && (
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="text-xs text-muted-foreground">
              Flashcard {currentCardIndex + 1} / {run.flashcards.length}
            </div>
            <div className="border border-border rounded-lg p-5 min-h-[140px]">
              <div className="text-sm text-muted-foreground mb-2">Front</div>
              <div className="text-lg text-foreground">{currentCard.front}</div>
              {showBack && (
                <div className="mt-4">
                  <div className="text-sm text-muted-foreground mb-2">Back</div>
                  <div className="text-base text-foreground">{currentCard.back}</div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!showBack ? (
                <Button variant="outline" onClick={() => setShowBack(true)}>Reveal Answer</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => handleRateCard("again")}>Again</Button>
                  <Button variant="outline" onClick={() => handleRateCard("hard")}>Hard</Button>
                  <Button variant="outline" onClick={() => handleRateCard("good")}>Good</Button>
                  <Button onClick={() => handleRateCard("easy")}>Easy</Button>
                </>
              )}
            </div>

            {allCardsRated && (
              <div className="pt-2">
                <Button onClick={() => setPhase("quiz")}>Continue to Mini Quiz</Button>
              </div>
            )}
          </div>
        )}

        {!resourceLoading && run && phase === "quiz" && (
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-lg font-medium text-foreground">{run.miniQuiz.title || "Mini AI Quiz"}</h2>
            {run.miniQuiz.questions.map((question, index) => (
              <div key={question.id} className="border border-border rounded-lg p-4">
                <div className="font-medium text-foreground mb-3">{index + 1}. {question.question}</div>
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const selected = quizAnswers[question.id] === optionIndex;
                    return (
                      <label
                        key={`${question.id}-${optionIndex}`}
                        className={`flex items-center gap-3 p-2 border rounded-md cursor-pointer ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          checked={selected}
                          onChange={() => setQuizAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))}
                        />
                        <span className="text-sm text-foreground">{option}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <Button onClick={handleSubmitReview} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit 15-Min Review
              </Button>
            </div>
          </div>
        )}

        {phase === "result" && result && (
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <h2 className="text-lg font-medium text-foreground">Session Complete</h2>
            <p className="text-sm text-foreground">
              Mini quiz: {result.outcome.score}/{result.outcome.total} ({result.outcome.percent}%)
            </p>
            <Button onClick={() => navigate(topicPath)}>Back to Topic</Button>
          </div>
        )}
      </div>
    </div>
  );
}
