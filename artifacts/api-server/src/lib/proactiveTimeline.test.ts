import { describe, expect, it } from "vitest";
import { milestonesToNextActionItems, type ProactiveMilestone } from "./proactiveTimeline";

describe("milestonesToNextActionItems", () => {
  const milestone = (
    partial: Partial<ProactiveMilestone> & Pick<ProactiveMilestone, "id" | "label" | "status">,
  ): ProactiveMilestone => ({
    dueDate: null,
    href: "/student/steps",
    urgency: "medium",
    kind: "step",
    ...partial,
  });

  it("includes overdue and blocked milestones with href", () => {
    const items = milestonesToNextActionItems([
      milestone({ id: "a", label: "Retard", status: "overdue", urgency: "high" }),
      milestone({ id: "b", label: "Bloqué", status: "blocked", href: "/student/documents" }),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]?.label).toBe("Retard");
  });

  it("skips low-urgency upcoming milestones", () => {
    const items = milestonesToNextActionItems([
      milestone({ id: "c", label: "Plus tard", status: "upcoming", urgency: "low" }),
    ]);
    expect(items).toHaveLength(0);
  });

  it("deduplicates by href and label", () => {
    const items = milestonesToNextActionItems([
      milestone({ id: "1", label: "Same", status: "overdue" }),
      milestone({ id: "2", label: "Same", status: "blocked" }),
    ]);
    expect(items).toHaveLength(1);
  });
});
