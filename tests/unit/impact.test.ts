import { describe, expect, it } from "vitest";
import { estimateFlakeCost } from "@/lib/impact";
import { analysisToMarkdown, analysisToJson, reviewList, quarantineList } from "@/lib/report";
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

  it("exports honest local evidence and review candidates without a quarantine policy", () => {
    const analysis = loadDemoAnalysis();
    const markdown = analysisToMarkdown(analysis, estimateFlakeCost(analysis.flakyFailures, 15, 100));
    const list = reviewList(analysis).split("\n");
    const json = JSON.parse(analysisToJson(analysis, null));
    expect(quarantineList()).toBe("");
    expect(json.quarantine).toEqual([]);
    expect(json.actionsApplied).toEqual([]);
    expect(markdown).toContain("Source files were not uploaded.");
    expect(markdown).toContain(REGRESSION_TEST_ID.replace(">", "\\>"));
    expect(markdown).toContain("32 failed attempts · 3 heuristic message clusters (not confirmed root causes)");
    expect(list).toEqual([REGRESSION_TEST_ID, FLAKY_TEST_IDS[3], FLAKY_TEST_IDS[1], FLAKY_TEST_IDS[2], FLAKY_TEST_IDS[0], FLAKY_TEST_IDS[4]]);
    expect(json.reviewCandidates).toEqual(list);
    expect(markdown).toContain("Not measured cost or savings.");
    expect(markdown).toContain("250.00");
  });
});
