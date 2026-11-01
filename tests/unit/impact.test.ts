import { describe, expect, it } from "vitest";
import { estimateFlakeCost } from "@/lib/impact";
import { analysisToMarkdown, quarantineList } from "@/lib/report";
import { FLAKY_TEST_IDS, REGRESSION_TEST_ID } from "@/lib/demo-plan";
import { loadDemoAnalysis } from "../helpers/load-demo";

describe("impact and export", () => {
  it("prices investigations from minutes and an hourly rate", () => {
    expect(estimateFlakeCost(19, 15, 100)).toMatchObject({ hours: 4.75, cost: 475 });
    expect(estimateFlakeCost(1, 60, 50).cost).toBe(50);
    expect(estimateFlakeCost(4, 0, 100).cost).toBe(0);
    expect(estimateFlakeCost(4, 15, -5).cost).toBe(0);
    expect(estimateFlakeCost(Number.NaN, 15, 100).cost).toBe(0);
  });

  it("exports a local report and the flaky quarantine list", () => {
    const analysis = loadDemoAnalysis();
    const markdown = analysisToMarkdown(analysis, estimateFlakeCost(analysis.flakyFailures, 15, 100));
    const list = quarantineList(analysis).split("\n");
    expect(markdown).toContain("Source files were not uploaded.");
    expect(markdown).toContain(REGRESSION_TEST_ID);
    expect(markdown).toContain("32 failures = 3 root causes");
    expect(list).toEqual([FLAKY_TEST_IDS[1], FLAKY_TEST_IDS[0], FLAKY_TEST_IDS[3], FLAKY_TEST_IDS[2], FLAKY_TEST_IDS[4]]);
    expect(list).not.toContain(REGRESSION_TEST_ID);
    expect(markdown).toContain("475.00");
  });
});
