import { compareText } from "@/lib/compare";
import type { AttemptStatus, HistoryPoint, TestAnalysis, TimedAttempt, Verdict } from "@/lib/types";

/** Observational heuristics, not causal diagnosis, probability, or a quarantine policy. */
export function scoreTests(attempts: TimedAttempt[]): TestAnalysis[] {
  const byTest = new Map<string, TimedAttempt[]>();
  for (const a of attempts) { const rows = byTest.get(a.testId) ?? []; rows.push(a); byTest.set(a.testId, rows); }
  return [...byTest].map(([id, rows]) => scoreOne(id, rows)).sort((a, b) =>
    rank(a.verdict) - rank(b.verdict) || b.impact - a.impact || compareText(a.testId, b.testId));
}

function scoreOne(testId: string, rows: TimedAttempt[]): TestAnalysis {
  const ordered = [...rows].sort(compareAttempts);
  const first = ordered[0]!;
  const relevant = ordered.filter(a => a.status !== "skip");
  const passes = relevant.filter(a => a.status === "pass").length;
  const failures = relevant.filter(a => a.status === "fail").length;
  const byRun = new Map<number, TimedAttempt[]>();
  for (const a of ordered) { const list = byRun.get(a.chronology) ?? []; list.push(a); byRun.set(a.chronology, list); }
  const history: HistoryPoint[] = [...byRun].sort((a,b)=>a[0]-b[0]).map(([chronology, attempts]) => {
    const sorted = [...attempts].sort(compareAttempts);
    const substantive = sorted.filter(a=>a.status!=="skip");
    const sample = sorted[0]!;
    let failedIndex = -1;
    const recovered = substantive.some(a => {
      if (a.status === "fail") failedIndex = Math.max(failedIndex, a.retryIndex);
      return a.status === "pass" && a.retrySource === "property" && a.retryIndex > 0 && failedIndex >= 0 && a.retryIndex > failedIndex;
    });
    return {runId:sample.runId,commit:sample.commit,timestamp:sample.timestamp,sourceName:sample.sourceName,
      chronology,finalStatus:substantive.at(-1)?.status ?? "skip",attemptStatuses:sorted.map(a=>a.status),
      passedOnRetry:recovered,retryIndexes:sorted.map(a=>a.retryIndex),retrySources:sorted.map(a=>a.retrySource??"sequence"),
      commitSource:sample.commitSource??"order",runIdSource:sample.runIdSource??"order"};
  });
  const finals = history.filter(h=>h.finalStatus!=="skip");
  const passedOnRetry = finals.filter(h=>h.passedOnRetry).length;
  const commits = new Map<string,Set<AttemptStatus>>();
  for (const a of relevant) {
    if (!a.commitSource || a.commitSource === "order") continue;
    const statuses = commits.get(a.commit)??new Set<AttemptStatus>(); statuses.add(a.status); commits.set(a.commit,statuses);
  }
  const sameCommitFlips = [...commits.values()].filter(s=>s.has("pass")&&s.has("fail")).length;
  const crossRunOscillations = finals.slice(1).filter((h,i)=>h.finalStatus!==finals[i]?.finalStatus).length;
  const missingCommitRuns = history.filter(h=>h.commitSource==="order").length;
  const missingRunIdRuns = history.filter(h=>h.runIdSource==="order").length;
  const stamps = history.map(h=>h.timestamp ? Date.parse(h.timestamp) : NaN);
  const orderedTimes = stamps.every((s,i)=>Number.isFinite(s)&&(i===0||s>stamps[i-1]!));
  const duplicateRun = new Set(history.filter(h=>h.runIdSource!=="order").map(h=>h.runId)).size < history.filter(h=>h.runIdSource!=="order").length;
  const inferredRetryAttempts = ordered.filter(a=>a.sequence>0 && a.retrySource!=="property").length;
  const reasonCodes: string[] = [];
  const warnings: string[] = ["Commit/run metadata is caller supplied; branch, ancestry, environment and test identity are not verified."];
  if (missingCommitRuns) warnings.push(`${missingCommitRuns} run(s) have no commit metadata; order labels are not commits.`);
  if (missingRunIdRuns) warnings.push(`${missingRunIdRuns} run(s) have no run identity; generated labels are not independent CI runs.`);
  if (!orderedTimes) warnings.push("Whole-history strict timestamp chronology is unavailable. Regression qualification requires its own ordered candidate window; file order alone is never proof.");
  if (duplicateRun) { warnings.push("Repeated run identity: files may be duplicate reports or shards, not independent runs."); reasonCodes.push("duplicate-run-identity"); }
  if (inferredRetryAttempts) { warnings.push("Repeated testcase order is inferred, not confirmed retry metadata."); reasonCodes.push("retry-inferred"); }

  const lastPass = finals.findLastIndex(h=>h.finalStatus==="pass");
  const trailing = finals.slice(lastPass+1);
  const baseline = finals[lastPass];
  const boundary = trailing[0];
  // Qualify the candidate window, retaining intervening skipped runs. Older
  // observations need not qualify, but must be provably older, not undated.
  const windowStart = baseline ? history.indexOf(baseline) : history.length;
  const window = history.slice(windowStart);
  const windowStamps = stamps.slice(windowStart);
  const qualifiedWindow = window.length > 0
    && windowStamps.every((s,i)=>Number.isFinite(s)&&(i===0||s>windowStamps[i-1]!))
    && stamps.slice(0,windowStart).every(s=>Number.isFinite(s)&&s<windowStamps[0]!)
    && window.every(h=>h.commitSource!=="order" && h.runIdSource!=="order")
    && new Set(window.map(h=>h.runId)).size===window.length;
  const persistent = baseline && boundary && trailing.length>=2 && trailing.every(h=>h.finalStatus==="fail" && !h.passedOnRetry && h.attemptStatuses.every(s=>s==="fail"))
    && qualifiedWindow
    && baseline.commit!==boundary.commit && trailing.every(h=>!commits.get(h.commit)?.has("pass"));
  let verdict: Verdict;
  let introducedCommit: string|null = null;
  let explanation: string;
  let action: string;
  if (persistent && boundary) {
    verdict="regression";introducedCommit=boundary.commit;reasonCodes.unshift("persistent-failure-after-pass");
    explanation=`${trailing.length} independent timestamp-ordered failing runs after a passing observation; first observed failing commit ${boundary.commit}. This is a regression pattern, not proof of causal commit.`;
    action="Investigate the persistent failure and compare the observed boundary; retain the original CI failure.";
  } else if (passedOnRetry || sameCommitFlips) {
    verdict="flaky";
    if(passedOnRetry) reasonCodes.unshift("retry-recovery");
    if(sameCommitFlips) reasonCodes.push("same-commit-outcomes");
    explanation=`${passedOnRetry} explicit retry recovery run(s), ${sameCommitFlips} provided commit(s) with both pass and fail attempts. Outcomes vary; the failure is not harmless.`;
    action="Investigate the differing outcomes and retry logs; do not ignore, quarantine, or turn CI green automatically.";
  } else if (failures===0 && passes>0) {
    verdict="stable";reasonCodes.unshift("no-failures-observed");
    explanation=`${passes} passing attempt(s), no failures observed. This does not establish future stability.`;
    action="No observed failure in this sample; retain normal CI gates.";
  } else {
    verdict="insufficient-evidence";
    if (!relevant.length) reasonCodes.unshift("no-executed-attempts");
    else if (relevant.length===1 && failures===1) reasonCodes.unshift("single-failure");
    else if (!passes) reasonCodes.unshift("no-passing-baseline");
    else if (crossRunOscillations) reasonCodes.unshift("cross-commit-only");
    else reasonCodes.unshift("no-confirmed-flake-signal");
    if (missingCommitRuns) reasonCodes.push("missing-commit-metadata");
    if (missingRunIdRuns) reasonCodes.push("missing-run-metadata");
    if (!orderedTimes) reasonCodes.push("unverified-history-order");
    explanation=`${history.length} observed run(s), ${passes} passing and ${failures} failing attempt(s). No confirmed retry/same-commit variation or qualified persistent regression boundary; abstaining.`;
    action="Investigate the current failure; collect independent runs, explicit retries, commit/run IDs and timestamps. Do not suppress the failure.";
  }
  // Legacy score is a ranking heuristic only. It is not computed for abstentions.
  const flipEvents = verdict==="flaky" ? sameCommitFlips+passedOnRetry+crossRunOscillations : 0;
  return {testId,classname:first.classname,name:first.name,verdict,
    flakinessScore:verdict==="flaky"?Math.min(1,flipEvents/Math.max(finals.length,1)):0,
    flipRate:relevant.length?flipEvents/relevant.length:0,flipEvents,impact:flipEvents,executions:relevant.length,
    failures,passes,sameCommitFlips,passedOnRetry,crossRunOscillations,introducedCommit,history,
    evidence:{policy:"flakelens.evidence/1",heuristic:true,reasonCodes,explanation,runCount:history.length,
      missingCommitRuns,missingRunIdRuns,inferredRetryAttempts,chronology:orderedTimes?"timestamp":"file-order",warnings,action}};
}
function compareAttempts(a:TimedAttempt,b:TimedAttempt):number { return a.chronology-b.chronology || a.retryIndex-b.retryIndex || a.sequence-b.sequence; }
function rank(v:Verdict):number { return v==="regression"?0:v==="insufficient-evidence"?1:v==="flaky"?2:3; }
