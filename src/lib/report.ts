import { rootCauseSummary } from "@/lib/cluster";
import type { CostEstimate } from "@/lib/impact";
import type { Analysis } from "@/lib/types";

export function reviewList(analysis: Analysis): string {
  return analysis.tests.filter(t=>t.verdict!=="stable").map(t=>t.testId).join("\n");
}
/** @deprecated Classifications never authorize quarantine. */
export function quarantineList(): string { return ""; }

export function analysisToJson(analysis: Analysis, cost: CostEstimate | null): string {
  return JSON.stringify({product:"flakelens",version:2,generatedLocally:true,
    note:"Processed locally. No source upload. Observational heuristics; retain original CI failures. No automatic quarantine.",
    summary:{runs:analysis.runs.length,tests:analysis.tests.length,flaky:analysis.flakyCount,
      regressions:analysis.regressionCount,stable:analysis.stableCount,insufficientEvidence:analysis.insufficientEvidenceCount,
      failures:analysis.failureCount,heuristicClusters:analysis.rootCauseCount,
      summary:rootCauseSummary(analysis.failureCount,analysis.rootCauseCount),flakyFailures:analysis.flakyFailures},
    cost:cost?{...cost,label:"Scenario estimate, not measured cost or savings",assumptions:"One investigation per failing attempt on tests classified flaky. Regressions and insufficient evidence excluded; duplicate investigations may overcount."}:null,
    quarantine:[],actionsApplied:[],reviewCandidates:reviewList(analysis).split("\n").filter(Boolean),
    runs:analysis.runs,tests:analysis.tests,
    clusters:analysis.clusters.map(({signature,label,count,testIds})=>({signature,label,count,testIds,kind:"heuristic-message-similarity",confirmedRootCause:false}))
  },null,2)+"\n";
}

// User-provided names/messages are data, not Markdown/HTML instructions.
const text=(s:string)=>s.replace(/[\r\n]/g," ").replace(/[\\`*_{}[\]()<>|#!]/g,"\\$&");
export function analysisToMarkdown(analysis: Analysis, cost: CostEstimate | null): string {
  const lines=["# FlakeLens report","","Processed locally. Source files were not uploaded. All classifications are observational heuristics, not causal proof. Retain original CI failures; no automatic quarantine.","",
    "## Summary","",`- CI runs: ${analysis.runs.length}`,`- Tests: ${analysis.tests.length}`,
    `- Flaky: ${analysis.flakyCount}`,`- Regressions: ${analysis.regressionCount}`,
    `- Insufficient evidence: ${analysis.insufficientEvidenceCount}`,`- No failures observed (stable): ${analysis.stableCount}`,
    `- ${rootCauseSummary(analysis.failureCount,analysis.rootCauseCount)}`,"",
    "## Evidence and recommended review",""];
  for (const t of analysis.tests) {
    lines.push(`### ${text(t.testId)}`,"",`- Verdict: ${t.verdict}`,`- Reasons: ${t.evidence.reasonCodes.join(", ")}`,
      `- ${text(t.evidence.explanation)}`,`- Observations: ${t.evidence.runCount} runs, ${t.executions} executed attempts, ${t.passes} pass, ${t.failures} fail; ${t.passedOnRetry} explicit retry recoveries; ${t.sameCommitFlips} same-commit mixes.`,
      `- Chronology: ${t.evidence.chronology}; missing commit: ${t.evidence.missingCommitRuns}; missing run ID: ${t.evidence.missingRunIdRuns}.`,
      `- Next: ${text(t.evidence.action)}`);
    for(const w of t.evidence.warnings) lines.push(`- Limitation: ${text(w)}`);
    for(const h of t.history) lines.push(`- Run ${text(h.runId)}; commit ${text(h.commit)} (${h.commitSource}); run ID source ${h.runIdSource}; time ${text(h.timestamp??"missing")}; file ${text(h.sourceName)}; attempts ${h.attemptStatuses.join(" → ")}; retry indexes ${h.retryIndexes.join(", ")} (${h.retrySources.join(", ")}); final ${h.finalStatus}.`);
    lines.push("");
  }
  lines.push("## Heuristic failure clusters","","Message similarity is not a confirmed shared root cause.");
  for(const c of analysis.clusters) lines.push(`- ${c.count} failed attempts: ${text(c.label)} (${c.testIds.map(text).join(", ")})`);
  if(!analysis.clusters.length) lines.push("No failures observed.");
  lines.push("","## Heuristic ranking","","Impact = flip rate × executions; overlapping signals may double-count. Scores are not probabilities and are not computed for abstentions.");
  for(const t of analysis.tests.filter(t=>t.verdict==="flaky")) lines.push(`- ${text(t.testId)}: score ${t.flakinessScore.toFixed(3)}, flip rate ${t.flipRate.toFixed(3)}, executions ${t.executions}, impact ${t.impact}.`);
  lines.push("","## Scenario cost estimate","");
  if(cost) lines.push(`${cost.flakyFailures} failed attempts on tests classified flaky × ${cost.minutesPerInvestigation} assumed minutes × ${cost.hourlyRate}/hour = ${cost.cost.toFixed(2)}. Not measured cost or savings. Regressions and insufficient evidence excluded. Repeated attempts may not require separate investigations.`);
  else lines.push("Not estimated. No measured customer cost or savings.");
  lines.push("","## Review candidates — not a quarantine policy","",...analysis.tests.filter(t=>t.verdict!=="stable").map(t=>`- ${text(t.testId)} (${t.verdict})`),"","No quarantine entries or actions are generated.","");
  return lines.join("\n");
}
