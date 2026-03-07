export function derivePersonaFromSummary(summary: string) {
  const normalized = summary.toLowerCase();
  if (normalized.includes("burnout")) return "Recovery-Oriented Learner";
  if (normalized.includes("weak")) return "Targeted Remediation Learner";
  return "Analytical Burst Learner";
}

export function getPersonaStorageKeys(email?: string | null) {
  const scope = email || "anonymous";
  return {
    currentKey: `brainosaur.persona.current.${scope}`,
    seenKey: `brainosaur.persona.seen.${scope}`,
  };
}

export const PROFILE_FLASH_KEY = "brainosaur.profile.flash_persona_card";
