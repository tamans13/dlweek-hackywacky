import type { OnboardingPersonaAnalysis } from "./api";

const STORAGE_KEY = "onboarding_persona";

export function storeOnboardingPersona(analysis: OnboardingPersonaAnalysis) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(analysis));
  } catch {
    // ignore
  }
}

export function readOnboardingPersona(): OnboardingPersonaAnalysis | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingPersonaAnalysis;
  } catch {
    return null;
  }
}
