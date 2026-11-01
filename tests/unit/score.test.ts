import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeRuns } from "@/lib/analyze";
import { compareText } from "@/lib/compare";
import {
  FLAKY_TEST_IDS,
  REGRESSION_INTRODUCED_AT_RUN,
  REGRESSION_TEST_ID,
  demoRuns,
  testId,
} from "@/lib/demo-plan";
import { estimateFlakeCost } from "@/lib/impact";
import { parseJUnit } from "@/lib/parse-junit";
import type { TestAnalysis } from "@/lib/types";
import { loadDemoAnalysis, loadDemoParsed } from "../helpers/load-demo";

const searchId = testId("tests/search.spec.ts", "autocomplete settles after the debounce window");
const inventoryId = testId("tests/inventory.spec.ts", "reservation releases when the hold expires");
const taxId = testId("tests/checkout.spec.ts", "tax rounds half away from zero on split tenders");
const cartId = testId("tests/cart.spec.ts", "concurrent quantity updates keep a single line");
const sessionId = testId("tests/auth.spec.ts", "session refresh does not drop the cart");

describe("score", () => {
  it("labels a clean pass-to-fail boundary as a regression and a single trailing failure as flaky", () => {
    const boundary = analyzeRuns([
      xmlRun("pass", 0),
      xmlRun("pass", 1),
      xmlRun("fail", 2),
      xmlRun("fail", 3),
    ]).tests[0];
    expect(boundary?.verdict).toBe("regression");
    expect(boundary?.introducedCommit).toBe("order-2");
    expect(boundary?.flakinessScore).toBe(0);
    expect(boundary?.impact).toBe(0);

    const trailing = analyzeRuns([xmlRun("pass", 0), xmlRun("pass", 1), xmlRun("fail", 2)]).tests[0];
    expect(trailing?.verdict).toBe("flaky");
    expect(trailing?.verdict).not.toBe("regression");

    const always = analyzeRuns([xmlRun("fail", 0), xmlRun("fail", 1)]).tests[0];
    expect(always?.verdict).toBe("regression");
    expect(always?.introducedCommit).toBe("order-0");

    const calm = analyzeRuns([xmlRun("pass", 0), xmlRun("pass", 1)]).tests[0];
    expect(calm?.verdict).toBe("stable");
  });

  it("flags a pass on retry and a same-commit rerun as flaky even when later finals are green", () => {
    const retry = parseJUnit(
      `<testsuite name="t">
        <properties><property name="commit" value="sha-retry"/></properties>
        <testcase classname="tests/a.spec.ts" name="recovers">
          <properties><property name="retry" value="0"/></properties>
          <failure message="boom">boom</failure>
        </testcase>
        <testcase classname="tests/a.spec.ts" name="recovers">
          <properties><property name="retry" value="1"/></properties>
        </testcase>
      </testsuite>`,
      "retry.xml",
      0,
    );
    const retried = analyzeRuns([retry]).tests[0];
    expect(retried?.verdict).toBe("flaky");
    expect(retried?.passedOnRetry).toBe(1);
    expect(retried?.sameCommitFlips).toBe(1);
    expect(retried?.flakinessScore).toBeGreaterThan(0);

    const shared = ["red.xml", "green.xml"].map((name, index) =>
      parseJUnit(
        `<testsuite name="t">
          <properties><property name="commit" value="same-sha"/><property name="run_id" value="run-${index}"/></properties>
          <testcase classname="tests/a.spec.ts" name="rerun">${index === 0 ? "<failure message=\"boom\">boom</failure>" : ""}</testcase>
        </testsuite>`,
        name,
        index,
      ),
    );
    const rerun = analyzeRuns(shared).tests[0];
    expect(rerun?.verdict).toBe("flaky");
    expect(rerun?.sameCommitFlips).toBe(1);
    expect(rerun?.impact).toBeCloseTo((rerun?.flipRate ?? 0) * (rerun?.executions ?? 0), 8);
  });

  it("keeps skips from creating a flake", () => {
    const run = analyzeRuns([
      parseJUnit(
        `<testsuite name="t"><testcase classname="tests/a.spec.ts" name="quiet"><skipped/></testcase></testsuite>`,
        "skip.xml",
        0,
      ),
      xmlRun("pass", 1),
    ]).tests[0];
    expect(run?.verdict).toBe("stable");
    expect(run?.failures).toBe(0);
  });

  it("labels the seeded regression as regression, and flags exactly the five seeded flaky tests", () => {
    const analysis = loadDemoAnalysis();
    const runs = demoRuns();
    const byId = new Map(analysis.tests.map((test) => [test.testId, test]));
    const regression = byId.get(REGRESSION_TEST_ID);
    const flaky = analysis.tests.filter((test) => test.verdict === "flaky").map((test) => test.testId);

    expect(analysis.runs.map((run) => run.commit)).toEqual(runs.map((run) => run.sha));
    expect(analysis.tests).toHaveLength(18);
    expect(regression?.verdict).toBe("regression");
    expect(regression?.verdict).not.toBe("flaky");
    expect(regression?.introducedCommit).toBe(runs[REGRESSION_INTRODUCED_AT_RUN - 1]?.sha);
    expect(regression?.failures).toBe(13);
    expect(regression?.flakinessScore).toBe(0);
    expect(regression?.impact).toBe(0);
    expect(flaky).not.toContain(REGRESSION_TEST_ID);
    expect([...flaky].sort(compareText)).toEqual([...FLAKY_TEST_IDS].sort(compareText));
    expect(analysis.stableCount).toBe(12);
    expect(analysis.flakyCount).toBe(5);
    expect(analysis.regressionCount).toBe(1);

    expect(flipFacts(byId, searchId)).toEqual({ failures: 5, executions: 30, flipEvents: 10 });
    expect(flipFacts(byId, inventoryId)).toEqual({ failures: 4, executions: 30, flipEvents: 8 });
    expect(flipFacts(byId, taxId)).toEqual({ failures: 4, executions: 34, flipEvents: 8 });
    expect(flipFacts(byId, sessionId)).toEqual({ failures: 3, executions: 33, flipEvents: 6 });
    expect(flipFacts(byId, cartId)).toEqual({ failures: 3, executions: 31, flipEvents: 7 });

    for (const test of analysis.tests) {
      expect(test.impact).toBeCloseTo(test.flipRate * test.executions, 8);
      if (test.verdict !== "flaky") {
        expect(test.flakinessScore).toBe(0);
        expect(test.impact).toBe(0);
      } else {
        expect(test.flakinessScore).toBeGreaterThan(0);
      }
    }

    expect(analysis.flakyFailures).toBe(19);
    expect(analysis.failureCount).toBe(32);
    expect(estimateFlakeCost(analysis.flakyFailures, 15, 100).cost).toBe(475);
  });

  it("sorts seeded runs by timestamp when the files are handed over in reverse", () => {
    const runs = [...demoRuns()].reverse();
    const directory = path.join(process.cwd(), "public", "demo");
    const parsed = runs.map((run, index) => parseJUnit(readFileSync(path.join(directory, run.filename), "utf8"), run.filename, index));
    const analysis = analyzeRuns(parsed);
    expect(analysis.runs.map((run) => run.commit)).toEqual(demoRuns().map((run) => run.sha));
    expect(analysis.tests.find((test) => test.testId === REGRESSION_TEST_ID)?.verdict).toBe("regression");
    expect(loadDemoParsed()).toHaveLength(30);
  });
});

function flipFacts(byId: Map<string, TestAnalysis>, id: string) {
  const test = byId.get(id);
  return {
    failures: test?.failures,
    executions: test?.executions,
    flipEvents: test?.flipEvents,
  };
}

function xmlRun(status: "pass" | "fail", order: number) {
  const failure = status === "fail" ? `<failure message="nope">nope</failure>` : "";
  return parseJUnit(
    `<testsuite name="t"><testcase classname="tests/order.spec.ts" name="keeps the total">${failure}</testcase></testsuite>`,
    `case-${order}.xml`,
    order,
  );
}
