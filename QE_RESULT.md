# Shared QE Atlas result

FlakeLens emits schemaVersion 1 alongside its native reports as `qe-result-flakelens.json`. Native outputs and exit semantics are unchanged. The CLI accepts --qe-result PATH to override the default.

Contract: https://github.com/DaveEliranAssistant/qe-atlas-report/pull/1 . The reporter discovers producers dynamically. Findings are capped at 100; totals and complete native reports are retained. Run provenance comes from GITHUB_REPOSITORY/GITHUB_RUN_ID; outside Actions the fallback URL ends in /actions/runs/0 and is not evidence of a real run.

Shared verdicts: `fail` when regressions > 0; `warn` when flaky > 0 without regressions; `pass` only when both are zero. Native CLI exit semantics are unchanged. WARN stays visible and non-blocking by default; the reporter can opt into fail-on-warn in enforce mode.

Operational failures may leave no shared file when input/path validation fails before output acquisition. Configure expected-files in the reporter so this is an explicit ERROR, never a silent omission.

Tests: `node --test qe-result.test.mjs`. No baseline or assertion changes.
