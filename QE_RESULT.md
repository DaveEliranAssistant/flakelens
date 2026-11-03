# Shared QE Atlas result

FlakeLens emits schemaVersion 1 alongside its native reports as `qe-result-flakelens.json`. Native outputs and exit semantics are unchanged. The CLI accepts --qe-result PATH to override the default.

Contract: https://github.com/DaveEliranAssistant/qe-atlas-report/pull/1 . The reporter discovers producers dynamically. Findings are capped at 100; totals and complete native reports are retained. Run provenance comes from GITHUB_REPOSITORY/GITHUB_RUN_ID; outside Actions the fallback URL ends in /actions/runs/0 and is not evidence of a real run.

FlakeLens PASS means analysis completed, not flake-free; flaky counts and scores remain visible.

Operational failures may leave no shared file when input/path validation fails before output acquisition. Configure expected-files in the reporter so this is an explicit ERROR, never a silent omission.

Tests: `node --test qe-result.test.mjs`. No baseline or assertion changes.
