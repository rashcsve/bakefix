import { expect, test } from "@playwright/test";

const mockDiagnosis = {
  headline: "Butter was too warm before baking",
  explanation: "Softened butter spreads before the dough sets.",
  confidence: "medium",
  causes: ["Butter was too warm when the dough was mixed."],
  rescueSteps: ["Chill the remaining dough before baking the next batch."],
  nextTime: ["Chill the dough for at least 30 minutes before baking."],
  missingInformation: ["Oven temperature"],
  safetyNote: null,
};

test("completes the diagnosis flow with a mocked API using only the keyboard", async ({
  page,
}) => {
  await page.route("**/api/diagnose", async (route) => {
    // A small delay keeps the loading state observable instead of racing it.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, diagnosis: mockDiagnosis }),
    });
  });

  await page.goto("/");

  const cookiesChip = page.getByRole("radio", { name: "Cookies" });
  await cookiesChip.focus();
  await page.keyboard.press("Space");
  await expect(cookiesChip).toBeChecked();

  const problemField = page.getByLabel("Describe what went wrong");
  await problemField.focus();
  await problemField.fill(
    "My cookies spread into thin, flat puddles in the oven every time.",
  );

  const dairyFreeChip = page.getByRole("checkbox", { name: "Dairy-free" });
  await dairyFreeChip.focus();
  await page.keyboard.press("Space");
  await expect(dairyFreeChip).toBeChecked();

  const submitButton = page.getByRole("button", { name: /diagnose my bake/i });
  await submitButton.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("status", { name: /generating diagnosis/i }),
  ).toBeVisible();

  const diagnosisHeading = page.getByRole("heading", {
    name: "Chef's diagnosis",
  });
  await expect(diagnosisHeading).toBeVisible();
  await expect(diagnosisHeading).toBeFocused();

  await expect(
    page.getByRole("heading", { name: mockDiagnosis.headline }),
  ).toBeVisible();
  await expect(page.getByText(mockDiagnosis.causes[0])).toBeVisible();
  await expect(page.getByText(mockDiagnosis.rescueSteps[0])).toBeVisible();
  await expect(page.getByText(mockDiagnosis.nextTime[0])).toBeVisible();
  await expect(
    page.getByText(mockDiagnosis.missingInformation[0]),
  ).toBeVisible();
});

test("has no horizontal overflow on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});
