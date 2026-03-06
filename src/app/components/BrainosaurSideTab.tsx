import { useEffect, useState } from "react";
import clsx from "clsx";
import { BrainotypeId, brainotypes } from "../lib/brainotypes";
import { readBrainotypeResult } from "../lib/brainotype-scoring";

type BrainosaurSideTabProps = {
  className?: string;
  sticky?: boolean;
};

export default function BrainosaurSideTab({ className, sticky = true }: BrainosaurSideTabProps) {
  const [primaryType, setPrimaryType] = useState<BrainotypeId | null>(null);

  useEffect(() => {
    const result = readBrainotypeResult();
    if (result) {
      setPrimaryType(result.primary);
    }
  }, []);

  return (
    <aside className={clsx("w-full max-w-[360px] flex-shrink-0", className)}>
      <div className={clsx("space-y-4", sticky && "sticky top-6")}>
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
          <div className="text-[11px] tracking-[0.2em] uppercase font-semibold text-muted-foreground mb-3">
            Brainosaur Brainotypes
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brainotypes.map((type) => (
              <article
                key={type.name}
                className={clsx(
                  "flex flex-col items-center text-center gap-2 rounded-2xl border p-4 transition-all duration-150",
                  primaryType === type.id ? "border-primary/60 shadow-lg" : "border-border",
                )}
              >
                <div className="h-32 w-32 overflow-hidden rounded-2xl border border-border bg-muted/30">
                  <img
                    src={type.image}
                    alt={`${type.name} dinosaur`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="text-sm font-semibold text-foreground">{type.name}</div>
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside leading-snug">
                  {type.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
