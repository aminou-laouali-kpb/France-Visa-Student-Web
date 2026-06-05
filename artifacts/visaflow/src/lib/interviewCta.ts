import type { Step } from "@/types";

export function shouldShowMotivationInterviewCta(steps: Step[]): boolean {
  return steps.some(
    (s) => s.status !== "validated" && /consulaire|consulat|entretien/i.test(s.stepName ?? ""),
  );
}
