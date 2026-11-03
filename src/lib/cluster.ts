import { compareText } from "@/lib/compare";
import type { Cluster, TimedAttempt } from "@/lib/types";

/**
 * Collapse a failure message and stack into a signature.
 * Strips line:col numbers, durations, absolute paths, hex ids, and timestamps.
 * Other words stay, so distinct errors do not merge just because they contain digits.
 */
export function normalizeFailure(message: string, details: string): string {
  let text = `${message}\n${details}`;
  text = text.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, "<ts>");
  text = text.replace(/\b\d{4}\/\d{2}\/\d{2}\b/g, "<ts>");
  text = text.replace(/\d+(?:\.\d+)?\s*(?:milliseconds|millisecond|seconds|second|secs|sec|ms|s)\b/gi, "<dur>");
  text = text.replace(/[A-Za-z]:\\(?:[^\\\s:]+\\)*[^\\\s:]+/g, "<path>");
  text = text.replace(/(?:\/(?:[\w.-]+)){2,}/g, "<path>");
  text = text.replace(/:\d+:\d+\b/g, ":<line>:<col>");
  text = text.replace(/:\d+(?=:\s)/g, ":<line>");
  text = text.replace(/\bline\s+\d+\b/gi, "line <n>");
  text = text.replace(/\bcol(?:umn)?\s+\d+\b/gi, "col <n>");
  text = text.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>");
  text = text.replace(/\b0x[0-9a-f]+\b/gi, "<hex>");
  text = text.replace(/\b[0-9a-f]{8,}\b/gi, "<hex>");
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function clusterFailures(attempts: TimedAttempt[]): Cluster[] {
  const groups = new Map<string, Cluster>();
  for (const attempt of attempts) {
    if (attempt.status !== "fail") continue;
    const signature = normalizeFailure(attempt.message, attempt.details);
    const existing = groups.get(signature);
    if (!existing) {
      const label = (attempt.message || attempt.details).split("\n")[0]?.trim() || signature;
      groups.set(signature, {
        signature,
        label,
        count: 1,
        testIds: [attempt.testId],
        sample: (attempt.details || attempt.message).trim(),
      });
      continue;
    }
    existing.count += 1;
    if (!existing.testIds.includes(attempt.testId)) existing.testIds.push(attempt.testId);
  }

  return [...groups.values()]
    .map((cluster) => ({
      ...cluster,
      testIds: [...cluster.testIds].sort(compareText),
    }))
    .sort((a, b) => b.count - a.count || compareText(a.signature, b.signature));
}

export function rootCauseSummary(failureCount: number, rootCauseCount: number): string {
  const attempts = failureCount === 1 ? "failed attempt" : "failed attempts";
  const clusters = rootCauseCount === 1 ? "heuristic message cluster" : "heuristic message clusters";
  return `${failureCount} ${attempts} · ${rootCauseCount} ${clusters} (not confirmed root causes)`;
}
