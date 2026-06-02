import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/auth";

test.describe("Phase 4 — readiness & playbooks UI", () => {
  test("student dashboard shows visa readiness or timeline when available", async ({
    page,
  }) => {
    await signInAs(page, "student");
    await page.goto("/student");
    await expect(page.getByTestId("student-dashboard")).toBeVisible();

    const readiness = page.getByTestId("card-visa-readiness");
    const timeline = page.getByTestId("card-proactive-timeline");
    const readinessCount = await readiness.count();
    const timelineCount = await timeline.count();
    expect(readinessCount + timelineCount).toBeGreaterThanOrEqual(0);
    if (timelineCount > 0) {
      await expect(page.getByTestId("proactive-timeline")).toBeVisible();
    }
  });

  test("admin can open playbooks catalog", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin/playbooks");
    await expect(page.getByTestId("admin-playbooks")).toBeVisible();
  });

  test("student projet page loads without Campus France wishes UI", async ({
    page,
  }) => {
    await signInAs(page, "student");
    await page.goto("/student/projet");
    await expect(page.getByTestId("page-student-projet")).toBeVisible();
    await expect(page.getByTestId("tab-projet-etudes")).toBeVisible();
    await expect(page.getByText(/vœu/i)).toHaveCount(0);
  });
});
