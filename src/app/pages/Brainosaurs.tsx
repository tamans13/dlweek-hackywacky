import { useMemo, useState, useEffect } from "react";
import { useAppData } from "../state/AppDataContext";
import { brainotypeById, brainotypes } from "../lib/brainotypes";
import {
  BrainotypeResult,
  learningStyleDescriptions,
  learningStyleLabels,
  readBrainotypeResult,
} from "../lib/brainotype-scoring";
import { readOnboardingPersona } from "../lib/onboardingPersona";

const varkStyles = [
  {
    name: "Visual",
    bullets: [
      "Learns best using diagrams, charts, and visual summaries",
      "Benefits from mind maps and structured notes",
      "Color-coding helps understanding",
    ],
  },
  {
    name: "Auditory",
    bullets: [
      "Learns best through listening and discussion",
      "Benefits from lectures and verbal explanation",
      "Explaining ideas aloud improves retention",
    ],
  },
  {
    name: "Reading/Writing",
    bullets: [
      "Learns best through text-based input and output",
      "Benefits from reading explanations and writing summaries",
      "Rewriting notes improves understanding",
    ],
  },
  {
    name: "Kinesthetic",
    bullets: [
      "Learns best through doing and hands-on interaction",
      "Benefits from practice questions and experiments",
      "Active engagement improves retention",
    ],
  },
];

const formatLearningStyle = (styleId: string | null) => {
  if (!styleId) return "Learning Style not set";
  return learningStyleLabels[styleId as keyof typeof learningStyleLabels] || "Learning Style";
};

export default function BrainotypePage() {
  const { state } = useAppData();
  const [brainotypeResult, setBrainotypeResult] = useState<BrainotypeResult | null>(null);

  useEffect(() => {
    setBrainotypeResult(readBrainotypeResult());
  }, []);

  const primaryBrainotype = useMemo(() => {
    if (!brainotypeResult) return null;
    return brainotypeById[brainotypeResult.primary];
  }, [brainotypeResult]);

  const secondaryBrainotype = useMemo(() => {
    if (!brainotypeResult) return null;
    return brainotypeById[brainotypeResult.secondary];
  }, [brainotypeResult]);

  const learningStyleLabel = formatLearningStyle(brainotypeResult?.learningStyle || null);
  const learningStyleDescription = brainotypeResult?.learningStyle
    ? learningStyleDescriptions[brainotypeResult.learningStyle]
    : null;

  const personaAnalysis = useMemo(() => {
    return (
      state?.personaProfile || state?.onboardingPersona || readOnboardingPersona()
    );
  }, [state]);

  const techniqueCards = personaAnalysis?.studyTechniques || [];
  const observation = personaAnalysis?.rationale || "AI is still analysing your responses and will share updates shortly.";
  const suggestionsFallback = "AI suggestions will appear here once they've been generated.";
  const highlightTechniques = techniqueCards.slice(0, 2);
  const suggestionTechniques = techniqueCards.slice(2);

  const focusPattern = primaryBrainotype
    ? `As a ${primaryBrainotype.name}, your focus pattern favors ${primaryBrainotype.tagline.toLowerCase()}. Carve out matching sessions and keep those bursts short enough to stay sharp.`
    : "We will highlight the right focus pattern once your Brainotype is classified.";

  const breakBehaviour = brainotypeResult?.learningStyle
    ? `Your ${learningStyleLabel.toLowerCase()} energy means breaks centered on ${learningStyleDescriptions[brainotypeResult.learningStyle].toLowerCase()} will keep momentum high.`
    : "Take breaks where you feel recharged, then return with intention.";

  const fatigueSignals = personaAnalysis
    ? `AI noticed: ${observation}`
    : "Watch for signs of mental fatigue after longer sessions and adjust pace as needed.";

  const schedulingPatterns = primaryBrainotype
    ? `Use blocks that balance ${primaryBrainotype.tagline.toLowerCase()} with your ${learningStyleLabel.toLowerCase()}. That dual focus keeps both energy and retention aligned.`
    : "Stick to a schedule that alternates focus and recovery until patterns emerge.";

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-6xl">
        <section className="space-y-8 rounded-[32px] border border-border bg-card px-6 py-8 shadow-xl">
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              Brainotype
            </p>
            <h1 className="text-3xl font-semibold text-foreground">Brainotype Profile</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              See your calculated dinosaur type, learning style, and the insights AI generates from both.
            </p>
          </header>

          {primaryBrainotype ? (
            <div className="overflow-hidden rounded-[28px] border border-border bg-background/40 shadow-sm">
              <div className="grid md:grid-cols-[1fr_1fr]">
                <div className="min-h-[280px]">
                  <img
                    src={primaryBrainotype.image}
                    alt={`${primaryBrainotype.name} dinosaur`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-between gap-4 p-6">
                  <div>
                    <div className="text-3xl font-semibold text-foreground">{primaryBrainotype.name}</div>
                    <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">{primaryBrainotype.tagline}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {primaryBrainotype.bullets[0]} {primaryBrainotype.bullets[1]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">Learning Style</p>
                    <div className="text-lg font-semibold text-foreground">{learningStyleLabel}</div>
                    {learningStyleDescription && (
                      <p className="text-sm text-muted-foreground">{learningStyleDescription}</p>
                    )}
                  </div>
                  {secondaryBrainotype && (
                    <p className="text-sm text-muted-foreground">
                      Secondary tendency:&nbsp;
                      <span className="font-semibold text-foreground">{secondaryBrainotype.name}</span> — {secondaryBrainotype.tagline}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-border bg-background/60 p-10 text-center text-sm text-muted-foreground">
              Complete the onboarding preferences to unlock your Brainotype and learning style.
            </div>
          )}

          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                Personalised Summary
              </p>
              <h2 className="text-2xl font-semibold text-foreground">Insights tailored to your Brainotype + learning style</h2>
              <p className="text-sm text-muted-foreground">
                These takeaways combine your questionnaire answers, calculated dinosaur type, and chosen VARK style.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-border bg-background/60 p-6 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] hover:border-primary/40 transition-all duration-200 cursor-default">
                <h3 className="text-sm font-semibold text-foreground">What we notice about your study style</h3>
                <p className="mt-3 text-sm text-muted-foreground">{observation}</p>
              </article>
              <article className="rounded-2xl border border-border bg-background/60 p-6 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] hover:border-primary/40 transition-all duration-200 cursor-default">
                <h3 className="text-sm font-semibold text-foreground">What works well for you</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {primaryBrainotype
                    ? `You lean on ${primaryBrainotype.tagline.toLowerCase()} energy with ${learningStyleLabel.toLowerCase()} clarity.`
                    : "We will surface your strengths once classification completes."}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {highlightTechniques.map((technique) => (
                    <li key={technique.title} className="list-disc pl-4">
                      <span className="font-semibold text-foreground">{technique.title}:</span> {technique.description}
                    </li>
                  ))}
                  {!highlightTechniques.length && (
                    <li className="text-muted-foreground">AI insights are still arriving.</li>
                  )}
                </ul>
              </article>
              <article className="rounded-2xl border border-border bg-background/60 p-6 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] hover:border-primary/40 transition-all duration-200 cursor-default">
                <h3 className="text-sm font-semibold text-foreground">Potential challenges</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <span className="font-semibold text-foreground">Focus pattern:</span> {focusPattern}
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Break behaviour:</span> {breakBehaviour}
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Fatigue signals:</span> {fatigueSignals}
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Study scheduling:</span> {schedulingPatterns}
                  </li>
                </ul>
              </article>
              <article className="rounded-2xl border border-border bg-background/60 p-6 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] hover:border-primary/40 transition-all duration-200 cursor-default">
                <h3 className="text-sm font-semibold text-foreground">Suggestions to improve</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {suggestionTechniques.map((technique) => (
                    <li key={technique.title} className="list-disc pl-4">
                      <span className="font-semibold text-foreground">{technique.title}:</span> {technique.description}
                    </li>
                  ))}
                  {!suggestionTechniques.length && (
                    <li className="text-muted-foreground">{suggestionsFallback}</li>
                  )}
                </ul>
              </article>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Brainotype guide</p>
              <h2 className="text-2xl font-semibold text-foreground">All Brainotypes</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:auto-rows-fr">
              {brainotypes.map((type) => (
                <article
                  key={type.name}
                  className={`flex h-full flex-col items-center gap-3 rounded-3xl border text-center p-4 transition-all duration-200 ${primaryBrainotype?.id === type.id
                      ? "border-primary/60 shadow-lg hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]"
                      : "border-border hover:border-primary/40 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]"
                    }`}
                >
                  <div className="h-40 w-full overflow-hidden rounded-3xl bg-muted/30">
                    <img
                      src={type.image}
                      alt={`${type.name} dinosaur`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{type.name}</div>
                  <ul className="mt-2 space-y-1 text-left text-sm leading-relaxed text-muted-foreground">
                    {type.bullets.map((bullet) => (
                      <li key={`${type.name}-${bullet}`} className="list-disc pl-4">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                Learning Styles (VARK)
              </p>
              <h2 className="text-2xl font-semibold text-foreground">Understanding the full framework</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {varkStyles.map((style) => (
                <article
                  key={style.name}
                  className="rounded-2xl border border-border bg-background/60 p-6 text-center hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] hover:border-primary/40 transition-all duration-200 cursor-default"
                >
                  <div className="text-lg font-semibold text-foreground">{style.name}</div>
                  <ul className="mt-3 mx-auto max-w-[220px] space-y-2 text-left text-sm text-muted-foreground">
                    {style.bullets.map((bullet) => (
                      <li key={`${style.name}-${bullet}`} className="list-disc pl-4">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
