"use client";

import { useState } from "react";
import { rootCauseSummary } from "@/lib/cluster";
import { estimateFlakeCost } from "@/lib/impact";
import { analysisToJson, analysisToMarkdown, reviewList } from "@/lib/report";
import type { Analysis, Verdict } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function Results({ analysis, sourceLabel }: { analysis: Analysis; sourceLabel: string }) {
  const [minutes, setMinutes] = useState("15");
  const [rate, setRate] = useState("100");
  const [copyNote, setCopyNote] = useState("");
  const cost = estimateFlakeCost(analysis.flakyFailures, numberOrZero(minutes), numberOrZero(rate));
  const candidates = reviewList(analysis);
  const flaky = analysis.tests.filter((test) => test.verdict === "flaky");
  const regressions = analysis.tests.filter((test) => test.verdict === "regression");

  async function copyReview() {
    try {
      await navigator.clipboard.writeText(candidates);
      setCopyNote("Copied review candidates. No quarantine actions applied.");
    } catch {
      setCopyNote("Clipboard blocked. Copy the list from the box.");
    }
  }

  return (
    <div className="results">
      <div className="summary">
        <article className="cause">
          <span>Failure clustering</span>
          <p data-testid="root-cause-summary">{rootCauseSummary(analysis.failureCount, analysis.rootCauseCount)}</p>
        </article>
        <article>
          <span>Flaky</span>
          <strong>{analysis.flakyCount}</strong>
        </article>
        <article>
          <span>Regressions</span>
          <strong>{analysis.regressionCount}</strong>
        </article>
        <article>
          <span>No failures observed</span>
          <strong>{analysis.stableCount}</strong>
        </article>
        <article><span>Insufficient evidence</span><strong>{analysis.insufficientEvidenceCount}</strong></article>
      </div>

      <p className="hint">
        {sourceLabel}. {analysis.runs.length} runs, {analysis.tests.length} tests. Observational heuristics, not probabilities. Keep original CI failures actionable; nothing is automatically quarantined.
      </p>

      <ol className="runs" aria-label="Failures per run">
        {analysis.runs.map((run) => (
          <li key={`${run.order}-${run.sourceName}`} title={`${run.runId} ${run.commit} · ${run.failureCount} failures`}>
            <span className={run.failureCount > 0 ? "bar fail" : "bar"} style={{ height: `${8 + Math.min(run.failureCount, 12) * 4}px` }} />
            <span>{run.commit.slice(0, 4)}</span>
          </li>
        ))}
      </ol>

      {regressions.map((test) => (
        <article className="regression-banner" key={test.testId}>
          <span>Regression</span>
          <h3>{test.name}</h3>
          <p>
            First observed failing commit <code>{test.introducedCommit}</code>. Persistent regression pattern, not proof this commit caused it. Investigate; this is not counted as flakiness.
          </p>
        </article>
      ))}

      <div className="layout">
        <section className="panel">
          <h2>Top impact</h2>
          <p className="hint">Heuristic rank = flip rate × executions. Signals can overlap; this is not a probability or severity measurement.</p>
          {flaky.length === 0 ? (
            <p>No flaky tests in this history.</p>
          ) : (
            <ol className="rank">
              {flaky.map((test, index) => (
                <li key={test.testId}>
                  <span>{index + 1}</span>
                  <code className="test-id">{test.name}</code>
                  <b title={`${formatPercent(test.flipRate)} × ${test.executions} executions`}>{formatImpact(test.impact)}</b>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="cost">
          <span>Scenario cost estimate</span>
          <p className="figure">{money.format(cost.cost)}</p>
          <p>
            {cost.flakyFailures} flaky failures × {cost.minutesPerInvestigation} min × {money.format(cost.hourlyRate)}/hr.
            Regressions and insufficient evidence are excluded. Assumes one investigation per failing attempt, which may overcount. Not measured cost or savings.
          </p>
          <div className="cost-fields">
            <label>
              Minutes per investigation
              <input type="number" min={0} step={1} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
            </label>
            <label>
              Hourly rate (USD)
              <input type="number" min={0} step={1} value={rate} onChange={(event) => setRate(event.target.value)} />
            </label>
          </div>
        </section>
      </div>

      <section className="panel">
        <h2>Heuristic failure clusters</h2>
        <p className="hint">Similar messages do not prove a shared root cause.</p>
        <div className="clusters">
          {analysis.clusters.map((cluster) => (
            <article className="cluster" key={cluster.signature}>
              <span>{cluster.count} failures</span>
              <h3>{cluster.label}</h3>
              <p>{cluster.testIds.length} tests share this signature.</p>
              <ul>
                {cluster.testIds.map((id) => (
                  <li key={id}>
                    <code className="test-id">{id}</code>
                  </li>
                ))}
              </ul>
              <pre>{cluster.sample.split("\n").slice(0, 5).join("\n")}</pre>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Every test</h2>
        <div className="table-wrap">
          <table aria-label="Tests ranked with regressions first, then insufficient evidence, flaky and no observed failures.">
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Verdict</th>
                <th scope="col">Heuristic score</th>
                <th scope="col">Flip rate</th>
                <th scope="col">Executions</th>
                <th scope="col">Impact</th>
                <th scope="col">History</th>
              </tr>
            </thead>
            <tbody>
              {analysis.tests.map((test) => (
                <tr key={test.testId} data-testid="test-row" data-test-id={test.testId} data-verdict={test.verdict}>
                  <th scope="row" className="test-id">
                    <span>{test.testId}</span>
                    {test.verdict === "regression" && test.introducedCommit ? (
                      <span className="since">
                        since <code data-testid="introduced-commit">{test.introducedCommit}</code>
                      </span>
                    ) : null}
                    <details className="evidence"><summary>Why this verdict</summary>
                      <p>{test.evidence.explanation}</p>
                      <p>Reasons: {test.evidence.reasonCodes.join(", ")}</p>
                      <p>{test.evidence.runCount} runs; {test.executions} executed attempts; {test.passes} pass; {test.failures} fail; {test.passedOnRetry} explicit retry recoveries; {test.sameCommitFlips} same-commit mixes.</p>
                      <p>Chronology: {test.evidence.chronology}. Missing commit/run IDs: {test.evidence.missingCommitRuns}/{test.evidence.missingRunIdRuns}.</p>
                      <p>{test.evidence.action}</p>
                      <ul>{test.evidence.warnings.map(w=><li key={w}>{w}</li>)}</ul>
                      <ol>{test.history.map(h=><li key={h.chronology}>Run {h.runId}; commit {h.commit} ({h.commitSource}); run ID source {h.runIdSource}; time {h.timestamp??"missing"}; file {h.sourceName}; attempts {h.attemptStatuses.join(" → ")}; retry indexes {h.retryIndexes.join(", ")} ({h.retrySources.join(", ")}); final {h.finalStatus}.</li>)}</ol>
                    </details>
                  </th>
                  <td data-label="Verdict">
                    <span className={`badge badge-${test.verdict}`}>{labelFor(test.verdict)}</span>
                  </td>
                  <td data-label="Heuristic score">{test.verdict === "flaky" ? formatPercent(test.flakinessScore) : "—"}</td>
                  <td data-label="Flip rate">{test.verdict === "flaky" ? formatPercent(test.flipRate) : "—"}</td>
                  <td data-label="Executions">{test.executions}</td>
                  <td data-label="Impact">{formatImpact(test.impact)}</td>
                  <td data-label="History">
                    <span className="sr-only">
                      {test.passes} passes, {test.failures} failures
                    </span>
                    <span className="spark" aria-hidden="true">
                      {test.history.map((point) => (
                        <i
                          key={`${point.chronology}-${point.runId}`}
                          data-status={point.passedOnRetry ? "recovered" : point.finalStatus}
                          title={`${point.runId} ${point.commit.slice(0, 7)} ${point.passedOnRetry ? "passed on retry" : point.finalStatus}`}
                        />
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Export</h2>
        <div className="export">
          <button type="button" onClick={() => download("flakelens-report.json", analysisToJson(analysis, cost), "application/json")}>
            Download JSON
          </button>
          <button type="button" onClick={() => download("flakelens-report.md", analysisToMarkdown(analysis, cost), "text/markdown")}>
            Download Markdown
          </button>
          <button type="button" onClick={() => void copyReview()}>
            Copy review candidates
          </button>
        </div>
        <label htmlFor="review-list">Review candidates — not a quarantine policy</label>
        <textarea id="review-list" readOnly value={candidates} data-testid="review-list" />
        {copyNote ? <p role="status">{copyNote}</p> : null}
      </section>

      {analysis.runs.some((run) => run.commitSource !== "file") ? (
        <p className="hint">Some identifiers came from filenames or file-order fallback. Fallback labels are not verified commit/run evidence; see per-test warnings.</p>
      ) : null}
    </div>
  );
}

function labelFor(verdict: Verdict): string {
  if (verdict === "flaky") return "Flaky";
  if (verdict === "regression") return "Regression";
  if (verdict === "insufficient-evidence") return "Insufficient evidence";
  return "No failures observed";
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatImpact(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded));
  return rounded.toFixed(2);
}

function numberOrZero(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
