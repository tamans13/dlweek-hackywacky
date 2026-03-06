import { useMemo, useState, useEffect } from "react";
import clsx from "clsx";
import { useAppData } from "../state/AppDataContext";
import { brainotypeById, brainotypes } from "../lib/brainotypes";
import {
  BrainotypeResult,
  learningStyleDescriptions,
  learningStyleLabels,
  readBrainotypeResult,
} from "../lib/brainotype-scoring";
import { readOnboardingPersona } from "../lib/onboardingPersona";

const learningStyles = [
  {
    name: "Auditory",
    bullets: [
      "Learns best by listening and discussing ideas",
      "Benefits from lectures, explanations, and verbal repetition",
      "Studying out loud or teaching others helps retention",
    ],
  },
  {
    name: "Visual",
    bullets: [
      "Learns best through diagrams, charts, and written material",
      "Benefits from mind maps, notes, and visual summaries",
      "Color-coding and structured notes improve understanding",
    ],
  },
  {
    name: "Kinesthetic",
    bullets: [
      "Learns best through doing and hands-on interaction",
      "Benefits from practice problems, experiments, and movement",
      "Active engagement helps reinforce concepts",
    ],
  },
];

const formatLearningStyle = (styleId: string | null) => {
  if (!styleId) return "Learning Style not set";
  return learningStyleLabels[styleId as keyof typeof learningStyleLabels] || "Learning Style";
};

export default function BrainosaursPage() {
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

  const focusPattern = primaryBrainotype
    ? `As a ${primaryBrainotype.name}, your focus pattern favors ${primaryBrainotype.tagline.toLowerCase()}. Carve out matching sessions and keep those bursts short enough to stay sharp.`
    : "We will highlight the right focus pattern once your Brainosaur is classified.";

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
        <section className="space-y-10 rounded-[32px] border border-border bg-card px-6 py-8 shadow-xl">
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              Brainosaurs
            </p>
            <h1 className="text-3xl font-semibold text-foreground">Brainosaurs</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Use these cards to compare your calculated Brainosaur type and learning style so you can align study habits to what naturally works.
            </p>
          </header>

          {primaryBrainotype && (
            <div className="grid gap-6 md:grid-cols-[1.2fr_minmax(220px,0.8fr)] rounded-[28px] border border-border bg-background/40 p-6 shadow-sm">
              <div className="space-y-3">
                <div className="h-36 w-36 overflow-hidden rounded-3xl border border-border bg-muted/30">
                  <img
                    src={primaryBrainotype.image}
                    alt={`${primaryBrainotype.name} dinosaur`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-base font-semibold text-foreground">{primaryBrainotype.name}</div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">{primaryBrainotype.tagline}</p>
                  <p className="mt-3 text-sm text-muted-foreground">Your Brainosaur is ready to guide focus bursts and recovery pacing.</p>
                </div>
              </div>
              <div className="space-y-3">
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
                    <span className="font-semibold text-foreground">{secondaryBrainotype.name}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-6 rounded-[28px] border border-border bg-background/60 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">Personalised Feedback</p>
                <h2 className="text-2xl font-semibold text-foreground">Insights tailored to your Brainosaur + learning style</h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border bg-background/80 p-4">
                <h3 className="text-sm font-semibold text-foreground">What we notice about your study style</h3>
                <p className="text-sm text-muted-foreground">{observation}</p>
              </div>
              <div className="space-y-3 rounded-2xl border border-border bg-background/80 p-4">
                <h3 className="text-sm font-semibold text-foreground">Potential challenges</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
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
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border bg-background/80 p-4">
                <h3 className="text-sm font-semibold text-foreground">What works well for you</h3>
                <p className="text-sm text-muted-foreground">
                  {primaryBrainotype
                    ? `Your ${primaryBrainotype.name} strength is staying sharp in ${primaryBrainotype.tagline.toLowerCase()} bursts while leaning on ${learningStyleLabel.toLowerCase()}. Continue using that rhythm.`
                    : "Keep doing what gives you momentum—we will point to specifics once you finish onboarding."}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {techniqueCards.slice(0, 2).map((technique) => (
                    <li key={technique.title} className="list-disc pl-4">
                      <span className="font-semibold text-foreground">{technique.title}:</span> {technique.description}
                    </li>
                  ))}
                  {!techniqueCards.length && <li className="text-muted-foreground">AI insights are on their way.</li>}
                </ul>
              </div>
              <div className="space-y-3 rounded-2xl border border-border bg-background/80 p-4">
                <h3 className="text-sm font-semibold text-foreground">Suggestions to improve</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {techniqueCards.slice(2).map((technique) => (
                    <li key={technique.title} className="list-disc pl-4">
                      <span className="font-semibold text-foreground">{technique.title}:</span> {technique.description}
                    </li>
                  ))}
                  {!techniqueCards.slice(2).length && suggestionsFallback}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Study Techniques</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {techniqueCards.map((technique) => (
                  <div key={technique.title} className="rounded-2xl border border-border bg-card p-4">
                    <h4 className="text-sm font-semibold text-foreground">{technique.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{technique.description}</p>
                  </div>
                ))}
                {!techniqueCards.length && (
                  <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    AI suggestions will appear here once they&apos;ve been generated.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:auto-rows-fr">
              {brainotypes.map((type) => (
                <article
                  key={type.name}
                  className={clsx(
                    "flex h-full flex-col items-center gap-3 rounded-3xl border text-center p-4 transition-all duration-200",
                    primaryBrainotype?.id === type.id ? "border-primary/60 shadow-lg" : ["border-border", "hover:border-primary/30"],
                  )}
                >
                  <div className="h-40 w-full overflow-hidden rounded-3xl bg-muted/30">
                    <img
                      src={type.image}
                      alt={`${type.name} dinosaur`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {type.name}
                  </div>
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

            <div className="border-t border-border pt-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                  Learning Styles
                </p>
                <h2 className="text-2xl font-semibold text-foreground">Learning Styles</h2>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {learningStyles.map((style) => (
                  <article
                    key={style.name}
                    className="rounded-2xl border border-border bg-background/60 p-6 text-center"
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
          </div>
        </section>
      </div>
    </div>
  );
}
