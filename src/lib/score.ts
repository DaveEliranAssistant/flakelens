import { compareText } from "@/lib/compare";
import type { AttemptStatus, HistoryPoint, TestAnalysis, TimedAttempt, Verdict } from "@/lib/types";

/**
 * Classification, in order:
 * - regression: every final result fails, or finals switch once from pass to fail
 *   and at least two runs stay failed. Every attempt from that commit on must fail
 *   (no retry recovery), and there are no same-commit mixes anywhere.
 * - flaky: the test both passes and fails, or it fails without meeting the
 *   regression rule (for example a single trailing failure, or a pass on retry).
 * - stable: no failing attempts.
 *
 * Flakiness score uses only tests labelled flaky. Flip events are same-commit
 * pass/fail mixes, plus runs that passed on retry, plus oscillations of the
 * final result between consecutive runs. Flip rate = flip events / executions.
 * Impact = flip rate × executions.
 */
export function scoreTests(attempts: TimedAttempt[]): TestAnalysis[] {
  const byTest = new Map<string, TimedAttempt[]>();
  for (const attempt of attempts) {
    const list = byTest.get(attempt.testId) ?? [];
    list.push(attempt);
    byTest.set(attempt.testId, list);
  }

  const tests = [...byTest.entries()].map(([testId, rows]) => scoreOne(testId, rows));
  tests.sort((a, b) => {
    const rankA = verdictRank(a.verdict);
    const rankB = verdictRank(b.verdict);
    if (rankA !== rankB) return rankA - rankB;
    if (a.impact !== b.impact) return b.impact - a.impact;
    return compareText(a.testId, b.testId);
  });
  return tests;
}

function scoreOne(testId: string, rows: TimedAttempt[]): TestAnalysis {
  const ordered = [...rows].sort(compareAttempts);
  const first = ordered[0];
  const relevant = ordered.filter((attempt) => attempt.status !== "skip");
  const passes = relevant.filter((attempt) => attempt.status === "pass").length;
  const failures = relevant.filter((attempt) => attempt.status === "fail").length;
  const executions = relevant.length;

  const byRun = new Map<number, TimedAttempt[]>();
  for (const attempt of ordered) {
    const list = byRun.get(attempt.chronology) ?? [];
    list.push(attempt);
    byRun.set(attempt.chronology, list);
  }

  const history: HistoryPoint[] = [...byRun.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([chronology, runAttempts]) => {
      const sorted = [...runAttempts].sort(compareAttempts);
      const substantive = sorted.filter((attempt) => attempt.status !== "skip");
      if (substantive.length === 0) {
        const sample = sorted[0];
        if (!sample) return [];
        return [
          {
            runId: sample.runId,
            commit: sample.commit,
            timestamp: sample.timestamp,
            sourceName: sample.sourceName,
            chronology,
            finalStatus: "skip" as const,
            attemptStatuses: sorted.map((attempt) => attempt.status),
            passedOnRetry: false,
          },
        ];
      }
      const finalStatus = substantive[substantive.length - 1]?.status ?? "skip";
      return [
        {
          runId: substantive[0]?.runId ?? "",
          commit: substantive[0]?.commit ?? "",
          timestamp: substantive[0]?.timestamp ?? null,
          sourceName: substantive[0]?.sourceName ?? "",
          chronology,
          finalStatus,
          attemptStatuses: sorted.map((attempt) => attempt.status),
          passedOnRetry: passedOnRetryInRun(substantive),
        },
      ];
    });

  const finals = history.filter((point) => point.finalStatus !== "skip");
  const passedOnRetry = finals.filter((point) => point.passedOnRetry).length;

  const byCommit = new Map<string, Set<AttemptStatus>>();
  for (const attempt of relevant) {
    const statuses = byCommit.get(attempt.commit) ?? new Set<AttemptStatus>();
    statuses.add(attempt.status);
    byCommit.set(attempt.commit, statuses);
  }
  let sameCommitFlips = 0;
  for (const statuses of byCommit.values()) {
    if (statuses.has("pass") && statuses.has("fail")) sameCommitFlips += 1;
  }

  let crossRunOscillations = 0;
  for (let index = 1; index < finals.length; index += 1) {
    if (finals[index]?.finalStatus !== finals[index - 1]?.finalStatus) crossRunOscillations += 1;
  }

  const boundary = regressionBoundary(finals);
  const attemptsAfterBoundaryFail =
    boundary == null || relevant.filter((attempt) => attempt.chronology >= boundary.chronology).every((attempt) => attempt.status === "fail");
  const isRegression = boundary != null && attemptsAfterBoundaryFail && sameCommitFlips === 0 && passedOnRetry === 0;

  let verdict: Verdict;
  let introducedCommit: string | null = null;
  if (isRegression && boundary) {
    verdict = "regression";
    introducedCommit = boundary.commit;
  } else if (failures > 0) {
    verdict = "flaky";
  } else {
    verdict = "stable";
  }

  const flipEvents = verdict === "flaky" ? sameCommitFlips + passedOnRetry + crossRunOscillations : 0;
  const flipRate = executions === 0 ? 0 : flipEvents / executions;
  // flip rate × executions. Stored as the integer event count so equal rates rank stably.
  const impact = flipEvents;
  const flakinessScore = verdict === "flaky" ? Math.min(1, flipEvents / Math.max(finals.length, 1)) : 0;

  return {
    testId,
    classname: first?.classname ?? "",
    name: first?.name ?? testId,
    verdict,
    flakinessScore,
    flipRate,
    flipEvents,
    impact,
    executions,
    failures,
    passes,
    sameCommitFlips,
    passedOnRetry,
    crossRunOscillations,
    introducedCommit,
    history,
  };
}

function regressionBoundary(finals: HistoryPoint[]): { commit: string; chronology: number } | null {
  if (finals.length < 2) return null;
  if (finals.every((point) => point.finalStatus === "fail")) {
    const first = finals[0];
    if (!first) return null;
    return { commit: first.commit, chronology: first.chronology };
  }
  const firstFail = finals.findIndex((point) => point.finalStatus === "fail");
  if (firstFail <= 0) return null;
  const trailing = finals.slice(firstFail);
  if (trailing.length < 2 || !trailing.every((point) => point.finalStatus === "fail")) return null;
  if (!finals.slice(0, firstFail).every((point) => point.finalStatus === "pass")) return null;
  const introduced = trailing[0];
  if (!introduced) return null;
  return { commit: introduced.commit, chronology: introduced.chronology };
}

function passedOnRetryInRun(attempts: TimedAttempt[]): boolean {
  let sawFail = false;
  for (const attempt of attempts) {
    if (attempt.status === "fail") sawFail = true;
    else if (attempt.status === "pass" && sawFail) return true;
  }
  return false;
}

function compareAttempts(a: TimedAttempt, b: TimedAttempt): number {
  if (a.chronology !== b.chronology) return a.chronology - b.chronology;
  if (a.retryIndex !== b.retryIndex) return a.retryIndex - b.retryIndex;
  return a.sequence - b.sequence;
}

function verdictRank(verdict: Verdict): number {
  if (verdict === "regression") return 0;
  if (verdict === "flaky") return 1;
  return 2;
}
