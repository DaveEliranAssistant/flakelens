"use client";

import { useState } from "react";
import { rootCauseSummary } from "@/lib/cluster";
import { estimateFlakeCost } from "@/lib/impact";
import { analysisToJson, analysisToMarkdown, quarantineList } from "@/lib/report";
import type { Analysis, Verdict } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function Results({ analysis, sourceLabel }: { analysis: Analysis; sourceLabel: string }) {
  const [minutes, setMinutes] = useState("15");
  const [rate, setRate] = useState("100");
  const [copyNote, setCopyNote] = useState("");
  const cost = estimateFlakeCost(analysis.flakyFailures, numberOrZero(minutes), numberOrZero(rate));
  const quarantine = quarantineList(analysis);
  const flaky = analysis.tests.filter((test) => test.verdict === "flaky");
  const regressions = analysis.tests.filter((test) => test.verdict === "regression");

  async function copyQuarantine() {
    try {
      await navigator.clipboard.writeText(quarantine);
      setCopyNote("Copied the quarantine list.");
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
          <span>Stable</span>
          <strong>{analysis.stableCount}</strong>
        </article>
      </div>

      <p className="hint">
        {sourceLabel}. {analysis.runs.length} runs, {analysis.tests.length} tests. Impact = flip rate × executions.
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
            Consistently failing since <code>{test.introducedCommit}</code>. This is not counted as flakiness.
          </p>
        </article>
      ))}

      <div className="layout">
        <section className="panel">
          <h2>Top impact</h2>
          <p className="hint">Ranked by flip rate × executions. Same-commit mixes and passed-on-retry runs both count.</p>
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
          <span>Cost of flakiness</span>
          <p className="figure">{money.format(cost.cost)}</p>
          <p>
            {cost.flakyFailures} flaky failures × {cost.minutesPerInvestigation} min × {money.format(cost.hourlyRate)}/hr.
            Regressions are excluded. This is an assumption you can edit.
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
        <h2>Root causes</h2>
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
          <table aria-label="Tests ranked with regressions first, then flaky tests by impact, then stable tests.">
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Verdict</th>
                <th scope="col">Score</th>
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
                    {test.testId}
                    {test.verdict === "regression" && test.introducedCommit ? (
                      <span className="since">
                        since <code data-testid="introduced-commit">{test.introducedCommit}</code>
                      </span>
                    ) : null}
                  </th>
                  <td data-label="Verdict">
                    <span className={`badge badge-${test.verdict}`}>{labelFor(test.verdict)}</span>
                  </td>
                  <td data-label="Score">{formatPercent(test.flakinessScore)}</td>
                  <td data-label="Flip rate">{formatPercent(test.flipRate)}</td>
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
          <button type="button" onClick={() => void copyQuarantine()}>
            Copy quarantine list
          </button>
        </div>
        <label htmlFor="quarantine-list">Quarantine list</label>
        <textarea id="quarantine-list" readOnly value={quarantine} data-testid="quarantine-list" />
        {copyNote ? <p role="status">{copyNote}</p> : null}
      </section>

      {analysis.runs.some((run) => run.commitSource !== "file") ? (
        <p className="hint">Some commits were taken from the filename or from file order because the XML had no commit property.</p>
      ) : null}
    </div>
  );
}

function labelFor(verdict: Verdict): string {
  if (verdict === "flaky") return "Flaky";
  if (verdict === "regression") return "Regression";
  return "Stable";
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
