import { clusterFailures } from "@/lib/cluster";
import { scoreTests } from "@/lib/score";
import type { Analysis, ParsedRun, TimedAttempt } from "@/lib/types";

export function sortRuns<T extends ParsedRun>(runs: T[]): T[] {
  return runs
    .map((run, index) => ({ run, index }))
    .sort((a, b) => {
      const left = a.run.timestamp ? Date.parse(a.run.timestamp) : NaN;
      const right = b.run.timestamp ? Date.parse(b.run.timestamp) : NaN;
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
      if (Number.isFinite(left) && !Number.isFinite(right)) return -1;
      if (!Number.isFinite(left) && Number.isFinite(right)) return 1;
      if (a.run.order !== b.run.order) return a.run.order - b.run.order;
      return a.index - b.index;
    })
    .map((entry) => entry.run);
}

export function analyzeRuns(parsed: ParsedRun[]): Analysis {
  const sorted = sortRuns(parsed);
  const attempts: TimedAttempt[] = sorted.flatMap((run, chronology) =>
    run.attempts.map((attempt) => ({ ...attempt, chronology, commitSource: run.commitSource, runIdSource: run.runIdSource })),
  );
  const tests = scoreTests(attempts);
  const clusters = clusterFailures(attempts);
  const flakyFailures = tests.filter((test) => test.verdict === "flaky").reduce((sum, test) => sum + test.failures, 0);

  return {
    runs: sorted.map((run) => ({
      sourceName: run.sourceName,
      order: run.order,
      commit: run.commit,
      commitSource: run.commitSource,
      runId: run.runId,
      timestamp: run.timestamp,
      attemptCount: run.attempts.length,
      failureCount: run.attempts.filter((attempt) => attempt.status === "fail").length,
    })),
    tests,
    clusters,
    failureCount: attempts.filter((attempt) => attempt.status === "fail").length,
    rootCauseCount: clusters.length,
    flakyCount: tests.filter((test) => test.verdict === "flaky").length,
    regressionCount: tests.filter((test) => test.verdict === "regression").length,
    stableCount: tests.filter((test) => test.verdict === "stable").length,
    insufficientEvidenceCount: tests.filter((test) => test.verdict === "insufficient-evidence").length,
    flakyFailures,
  };
}
