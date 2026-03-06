import { Button } from "./ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  illustration?: "book" | "brain" | "dino" | "chart";
}

function BookIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-primary/20"
    >
      <rect x="20" y="25" width="80" height="70" rx="4" fill="currentColor" />
      <rect x="25" y="30" width="70" height="60" rx="2" fill="var(--color-card)" stroke="currentColor" strokeWidth="2" />
      <line x1="60" y1="32" x2="60" y2="88" stroke="currentColor" strokeWidth="2" />
      <line x1="32" y1="42" x2="52" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="52" x2="50" y2="52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="62" x2="48" y2="62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="68" y1="42" x2="88" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="68" y1="52" x2="85" y2="52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="68" y1="62" x2="82" y2="62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BrainIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-primary/20"
    >
      <ellipse cx="60" cy="60" rx="35" ry="40" fill="currentColor" />
      <path
        d="M45 35 Q35 50 45 65 Q55 80 45 95"
        stroke="var(--color-card)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M60 25 Q60 50 60 75"
        stroke="var(--color-card)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M75 35 Q85 50 75 65 Q65 80 75 95"
        stroke="var(--color-card)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DinoIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-primary/20"
    >
      <ellipse cx="60" cy="70" rx="30" ry="25" fill="currentColor" />
      <circle cx="60" cy="40" r="20" fill="currentColor" />
      <circle cx="52" cy="35" r="4" fill="var(--color-card)" />
      <circle cx="68" cy="35" r="4" fill="var(--color-card)" />
      <path d="M55 48 Q60 52 65 48" stroke="var(--color-card)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="45" y="88" width="8" height="12" rx="2" fill="currentColor" />
      <rect x="67" y="88" width="8" height="12" rx="2" fill="currentColor" />
      <path d="M85 65 Q95 60 90 70 Q100 65 95 75" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="45" cy="25" r="5" fill="currentColor" />
      <circle cx="55" cy="22" r="4" fill="currentColor" />
      <circle cx="65" cy="22" r="4" fill="currentColor" />
      <circle cx="75" cy="25" r="5" fill="currentColor" />
    </svg>
  );
}

function ChartIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-primary/20"
    >
      <rect x="20" y="85" width="80" height="3" fill="currentColor" rx="1" />
      <rect x="20" y="25" width="3" height="63" fill="currentColor" rx="1" />
      <rect x="30" y="55" width="12" height="30" rx="2" fill="currentColor" />
      <rect x="48" y="40" width="12" height="45" rx="2" fill="currentColor" />
      <rect x="66" y="50" width="12" height="35" rx="2" fill="currentColor" />
      <rect x="84" y="30" width="12" height="55" rx="2" fill="currentColor" />
      <circle cx="36" cy="48" r="3" fill="currentColor" />
      <circle cx="54" cy="33" r="3" fill="currentColor" />
      <circle cx="72" cy="43" r="3" fill="currentColor" />
      <circle cx="90" cy="23" r="3" fill="currentColor" />
      <path d="M36 48 L54 33 L72 43 L90 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const illustrations = {
  book: BookIllustration,
  brain: BrainIllustration,
  dino: DinoIllustration,
  chart: ChartIllustration,
};

export function EmptyState({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  illustration = "dino",
}: EmptyStateProps) {
  const IllustrationComponent = illustrations[illustration];

  return (
    <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center text-center">
      <div className="mb-6">
        <IllustrationComponent />
      </div>
      <h2 className="text-xl font-medium text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>
      <div className="flex items-center gap-3">
        {primaryActionLabel && onPrimaryAction && (
          <Button onClick={onPrimaryAction} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {primaryActionLabel}
          </Button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <Button variant="outline" onClick={onSecondaryAction}>
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
