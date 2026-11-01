import { expect, test } from "@playwright/test";
import { FLAKY_TEST_IDS, REGRESSION_INTRODUCED_AT_RUN, REGRESSION_TEST_ID, demoRuns } from "../../src/lib/demo-plan";

test("loads the synthetic demo and shows flaky and regression verdicts", async ({ page }) => {
  const introduced = demoRuns()[REGRESSION_INTRODUCED_AT_RUN - 1]?.sha;
  if (!introduced) throw new Error("Seeded regression commit is missing.");

  await page.goto("/");
  await expect(page.getByText("Your files never leave your browser")).toBeVisible();
  await expect(page.getByText("Demo data is synthetic.")).toBeVisible();
  await expect(
    page.getByText(
      "This site uses Vercel Web Analytics (cookieless, aggregated page views, no personal profiles).",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "dave.eliran.assistant@gmail.com" })).toHaveAttribute(
    "href",
    "mailto:dave.eliran.assistant@gmail.com",
  );
  await expect(page.locator('script[src*="va.vercel-scripts.com"], script[src="/_vercel/insights/script.js"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Load demo data" }).click();
  await expect(page.getByTestId("root-cause-summary")).toHaveText("32 failures = 3 root causes");
  await expect(page.getByTestId("test-row")).toHaveCount(18);

  const rows = await page.getByTestId("test-row").evaluateAll((elements) =>
    elements.map((element) => ({
      id: element.getAttribute("data-test-id"),
      verdict: element.getAttribute("data-verdict"),
    })),
  );
  const flaky = rows.flatMap((row) => (row.verdict === "flaky" && row.id ? [row.id] : [])).sort();
  const regressions = rows.filter((row) => row.verdict === "regression");

  expect(flaky).toEqual([...FLAKY_TEST_IDS].sort());
  expect(regressions).toEqual([{ id: REGRESSION_TEST_ID, verdict: "regression" }]);
  expect(flaky).not.toContain(REGRESSION_TEST_ID);

  const regressionRow = page.locator('[data-testid="test-row"][data-verdict="regression"]');
  await expect(regressionRow).toHaveCount(1);
  await expect(regressionRow.locator('[data-testid="introduced-commit"]')).toHaveText(introduced);

  // Impact order: search 10, tax 8, inventory 8, cart 7, session 6.
  // Tax precedes inventory when the product ties because its id sorts first.
  const quarantine = [FLAKY_TEST_IDS[1], FLAKY_TEST_IDS[0], FLAKY_TEST_IDS[3], FLAKY_TEST_IDS[2], FLAKY_TEST_IDS[4]];
  await expect(page.getByTestId("quarantine-list")).toHaveValue(quarantine.join("\n"));
  await expect(page.getByTestId("waitlist-form")).not.toHaveAttribute("action");
});
