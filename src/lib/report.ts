import { rootCauseSummary } from "@/lib/cluster";
import type { CostEstimate } from "@/lib/impact";
import type { Analysis, TestAnalysis } from "@/lib/types";

export function quarantineList(analysis: Analysis): string {
  return analysis.tests
    .filter((test) => test.verdict === "flaky")
    .map((test) => test.testId)
    .join("\n");
}

export function analysisToJson(analysis: Analysis, cost: CostEstimate | null): string {
  return `${JSON.stringify(
    {
      product: "flakelens",
      version: 1,
      generatedLocally: true,
      note: "Analyzed in the browser. Source files were not uploaded.",
      summary: {
        runs: analysis.runs.length,
        tests: analysis.tests.length,
        flaky: analysis.flakyCount,
        regressions: analysis.regressionCount,
        stable: analysis.stableCount,
        failures: analysis.failureCount,
        rootCauses: analysis.rootCauseCount,
        summary: rootCauseSummary(analysis.failureCount, analysis.rootCauseCount),
        flakyFailures: analysis.flakyFailures,
      },
      cost,
      quarantine: quarantineList(analysis).split("\n").filter(Boolean),
      runs: analysis.runs,
      tests: analysis.tests,
      clusters: analysis.clusters.map((cluster) => ({
        signature: cluster.signature,
        label: cluster.label,
        count: cluster.count,
        testIds: cluster.testIds,
      })),
    },
    null,
    2,
  )}\n`;
}

export function analysisToMarkdown(analysis: Analysis, cost: CostEstimate | null): string {
  const lines: string[] = [
    "# FlakeLens report",
    "",
    "Analyzed locally. Source files were not uploaded.",
    "",
    "## Summary",
    "",
    `- CI runs: ${analysis.runs.length}`,
    `- Tests: ${analysis.tests.length}`,
    `- Flaky: ${analysis.flakyCount}`,
    `- Regressions: ${analysis.regressionCount}`,
    `- Stable: ${analysis.stableCount}`,
    `- ${rootCauseSummary(analysis.failureCount, analysis.rootCauseCount)}`,
    "",
    "## Regressions",
    "",
  ];

  const regressions = analysis.tests.filter((test) => test.verdict === "regression");
  if (regressions.length === 0) {
    lines.push("None.", "");
  } else {
    for (const test of regressions) {
      lines.push(`- \`${test.testId}\` failing since \`${test.introducedCommit ?? "unknown"}\``);
    }
    lines.push("");
  }

  lines.push("## Top impact", "", "Impact = flip rate × executions.", "");
  lines.push("| Test | Score | Flip rate | Executions | Impact |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const test of analysis.tests.filter((item) => item.verdict === "flaky")) {
    lines.push(
      `| \`${test.testId}\` | ${formatNum(test.flakinessScore)} | ${formatNum(test.flipRate)} | ${test.executions} | ${formatNum(test.impact)} |`,
    );
  }
  if (analysis.flakyCount === 0) lines.push("| — |  |  |  |  |");
  lines.push("");

  lines.push("## Root causes", "");
  for (const cluster of analysis.clusters) {
    lines.push(`- ${cluster.count} × ${cluster.label}`);
    for (const testId of cluster.testIds) lines.push(`  - \`${testId}\``);
  }
  if (analysis.clusters.length === 0) lines.push("No failures.");
  lines.push("");

  lines.push("## Quarantine list", "", "```", quarantineList(analysis) || "(empty)", "```", "");

  lines.push("## Cost of flakiness", "");
  if (!cost) {
    lines.push("Not estimated.", "");
  } else {
    lines.push(
      `${cost.flakyFailures} flaky failures × ${cost.minutesPerInvestigation} minutes × ${cost.hourlyRate} per hour = ${cost.cost.toFixed(2)}.`,
    );
    lines.push("");
    lines.push("Regressions are excluded. This is an assumption, not a measured payroll cost.", "");
  }

  lines.push("## Per-test history", "");
  for (const test of analysis.tests) {
    lines.push(`### ${test.testId}`, "", `- Verdict: ${test.verdict}`, `- ${historyLine(test)}`, "");
  }

  return lines.join("\n");
}

function historyLine(test: TestAnalysis): string {
  return test.history
    .map((point) => {
      const mark = point.finalStatus === "pass" ? "P" : point.finalStatus === "fail" ? "F" : "S";
      return point.passedOnRetry ? `${mark}*` : mark;
    })
    .join(" ");
}

function formatNum(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3);
}
