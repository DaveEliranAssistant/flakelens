import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareText } from "@/lib/compare";
import { clusterFailures, normalizeFailure, rootCauseSummary } from "@/lib/cluster";
import { CLUSTER_MESSAGES, demoRuns, testId } from "@/lib/demo-plan";
import { demoIndex, renderRunXml } from "@/lib/render-demo-xml";
import { loadDemoAnalysis } from "../helpers/load-demo";

describe("cluster", () => {
  it("strips line:col, durations, absolute paths, hex ids, and timestamps", () => {
    const unix = normalizeFailure(
      "Timeout exceeded while waiting for element to become visible",
      [
        "Timeout exceeded while waiting for element to become visible",
        "    at /home/runner/work/marigold-shop/e2e/search.spec.ts:42:18",
        "    duration=5000ms",
        "    traceId=abc123def456",
        "    at 2026-04-01T17:00:00.000Z",
      ].join("\n"),
    );
    const windows = normalizeFailure(
      "Timeout exceeded while waiting for element to become visible",
      [
        "Timeout exceeded while waiting for element to become visible",
        "    at C:\\builds\\marigold-shop\\e2e\\inventory.spec.ts:9:2",
        "    duration=12ms",
        "    traceId=0123abcdef45",
        "    at 2026-05-02 01:02:03Z",
      ].join("\n"),
    );
    expect(unix).toBe(windows);
    expect(unix).toContain("<path>");
    expect(unix).toContain("<dur>");
    expect(unix).toContain("<hex>");
    expect(unix).toContain("<ts>");
    expect(unix).toContain(":<line>:<col>");
    expect(unix).not.toContain("42:18");
    expect(unix).not.toContain("5000");
    expect(unix).not.toContain("abc123def456");
    expect(unix).not.toContain("/home/runner");
    expect(unix).not.toContain("2026-04-01");
    expect(unix).not.toMatch(/[a-z]:\\/);

    const promo = normalizeFailure(
      "Promo code stacking rejected: GOLD cannot combine with WELCOME",
      "at /tmp/shop/promo.spec.ts:3:1\nruleSet=deadbeefdeadbeef",
    );
    expect(promo).not.toBe(unix);
    expect(promo).toContain("gold cannot combine with welcome");

    const timed = normalizeFailure(
      "boom",
      "took 3 seconds and 1.25s id 123e4567-e89b-12d3-a456-426614174000 line 14 column 2",
    );
    expect(timed).not.toMatch(/3 seconds|1\.25s|123e4567/);
    expect(timed).toContain("<dur>");
    expect(timed).toContain("<uuid>");
    expect(timed).toContain("line <n>");
    expect(timed).toContain("col <n>");

    const pytest = normalizeFailure("AssertionError", "tests/test_checkout.py:10: AssertionError");
    expect(pytest).toContain(":<line>");
    expect(pytest).not.toContain(":10:");
  });

  it("collapses the seeded history into exactly three heuristic clusters", () => {
    const analysis = loadDemoAnalysis();
    const searchId = testId("tests/search.spec.ts", "autocomplete settles after the debounce window");
    const inventoryId = testId("tests/inventory.spec.ts", "reservation releases when the hold expires");
    const taxId = testId("tests/checkout.spec.ts", "tax rounds half away from zero on split tenders");
    const cartId = testId("tests/cart.spec.ts", "concurrent quantity updates keep a single line");
    const sessionId = testId("tests/auth.spec.ts", "session refresh does not drop the cart");
    const regressionId = testId("tests/checkout.spec.ts", "promo codes do not stack GOLD with WELCOME");

    expect(analysis.clusters).toHaveLength(3);
    expect(analysis.rootCauseCount).toBe(3);
    expect(analysis.failureCount).toBe(32);
    expect(rootCauseSummary(analysis.failureCount, analysis.rootCauseCount)).toBe("32 failed attempts · 3 heuristic message clusters (not confirmed root causes)");
    expect([...analysis.clusters.map((cluster) => cluster.count)].sort((a, b) => a - b)).toEqual([9, 10, 13]);

    const byLabel = new Map(analysis.clusters.map((cluster) => [cluster.label, cluster]));
    expect(byLabel.get(CLUSTER_MESSAGES.timeout)?.testIds).toEqual([inventoryId, searchId].sort(compareText));
    expect(byLabel.get(CLUSTER_MESSAGES.timeout)?.count).toBe(9);
    expect(byLabel.get(CLUSTER_MESSAGES.detached)?.testIds).toEqual([sessionId, cartId, taxId].sort(compareText));
    expect(byLabel.get(CLUSTER_MESSAGES.detached)?.count).toBe(10);
    expect(byLabel.get(CLUSTER_MESSAGES.promo)?.testIds).toEqual([regressionId]);
    expect(byLabel.get(CLUSTER_MESSAGES.promo)?.count).toBe(13);

    for (const cluster of analysis.clusters) {
      expect(cluster.signature).not.toMatch(/2026-\d{2}-\d{2}/);
      expect(cluster.signature).not.toMatch(/\/home\/runner|\/opt\/ci|\/users\/ci/);
      expect(cluster.signature).not.toMatch(/\b[0-9a-f]{8,}\b/);
      expect(cluster.signature).not.toMatch(/\d+ms/);
    }

    expect(clusterFailures([])).toEqual([]);
    expect(rootCauseSummary(1, 1)).toBe("1 failed attempt · 1 heuristic message cluster (not confirmed root causes)");
  });

  it("keeps committed fixtures identical to the generator", () => {
    const directory = path.join(process.cwd(), "public", "demo");
    const runs = demoRuns();
    expect(runs).toHaveLength(30);
    expect(new Set(runs.map((run) => run.sha)).size).toBe(29);
    expect(runs[8]?.sha).toBe(runs[9]?.sha);
    for (const run of runs) {
      expect(readFileSync(path.join(directory, run.filename), "utf8")).toBe(renderRunXml(run));
    }
    expect(readFileSync(path.join(directory, "index.json"), "utf8")).toBe(`${JSON.stringify(demoIndex(runs), null, 2)}\n`);
  });
});
