# Evidence policy and next increments

## Rules and provenance

Policy identifier: `flakelens.evidence/1`. All classifications are observational heuristics. No numeric confidence or causal diagnosis is claimed. Metadata comes from file properties, then filename inference; order-only labels are explicitly missing metadata, not real commits or independent run IDs. Timestamps are sorted by actual parsed time. Missing, invalid, tied or non-ordered timestamps cannot establish a regression boundary.

A qualified regression takes priority over earlier flaky history: a passing final result, then at least two distinct run identities with all attempts failing after the boundary; strict timestamps, supplied commit/run IDs, a changed boundary commit, and no observed passing result at those failing commits. Duplicate run identities do not count as independent runs. Otherwise, an explicit numeric retry recovering after a failure or a provided same-commit pass/fail mix is a flaky signal. A passing-only sample is no failures observed. Everything else abstains with `insufficient-evidence` and machine-readable reason codes.

`history` retains source file, run ID, commit, timestamp, metadata source, attempted statuses, retry indexes/sources and final status. `evidence` carries the explanation, counts, policy, rule codes, warnings and next action. Data are shared by browser/CLI; browser estimates use editable assumptions while CLI cost is not estimated. `crossRunOscillations` remains an observed count even when classification abstains. Ranking scores only apply to flaky cases; zero-valued legacy score fields on other verdicts mean not computed, not zero risk.

Repeated testcase names can be shards/parameterized identity collisions rather than retries. Caller metadata is not authenticated Git ancestry. Branch, workflow, platform, environment, test identity, reporter completeness and selective uploads are not verified. Do not combine unrelated histories. Two failures after a pass is a triage threshold, not a statistical or causal proof. Same-commit variation can still be a serious product bug. No test execution, issue filing, quarantine or rerun is triggered by analysis.

Malformed XML, DTD/entity declarations and unnamed testcases are refused rather than omitted. Browser selections containing an invalid file clear analysis; the CLI exits 2. The existing CLI bounds and output safeguards remain. Browser ingestion is not an OS sandbox or an equivalent resource-bound CLI. Supported JUnit dialect subsets remain the original Playwright/Jest/pytest-style direct suites; this is not exhaustive JUnit-standard support.

## Report migration

Native JSON version changes from 1 to **2**: new verdict/evidence, `summary.insufficientEvidence`, `summary.heuristicClusters` instead of the misleading root-causes label, review candidates, and explicit empty quarantine/actions arrays. Update native consumers to handle abstentions and the new version; never map an unknown enum to PASS. Internal `rootCauseCount`/`rootCauseSummary` identifiers are retained as legacy names, not confirmed diagnoses. Deprecated `quarantineList()` returns an empty string.

Shared **qe-result v1 is not changed**. Findings encode reason summaries in existing fields, full typed evidence stays native. Known regressions remain FAIL even with unknowns; unknown-only and flaky-only reports WARN. Existing CLI exits remain 0 for completed analysis and 2 for operational/input errors. Preserve the originating test job's exit; no continue-on-error or quarantine policy is added to application gates.

## Why some existing assertions change

The old contract explicitly called isolated failures flaky and all-failing histories regression, treated inferred duplicate names as retries, generated quarantine IDs, and claimed normalized clusters were root causes. Those assertions contradict the requested behavior. They are replaced with explicit abstention/provenance/no-quarantine expectations, not removed or broadened. Original generated XML, seed plan, raw failure/execution counts, normalization group membership and fixture/generator equality tests remain intact. Separate new test-first cases define the desired rules, including a qualified regression and an older-flake/new-regression history.

## Separate proposal A — owner/expiry quarantine

Not implemented. Require a customer-reviewed policy entry with test identity/scope, accountable owner, reason, linked issue, creation time, expiry, approval and an audit trail. Default off; reject missing owner/expiry, expired entries, scope mismatches and unapproved changes. Expiry returns failures to normal enforcement. Keep quarantined failures visible, retain original outcomes and report policy application separately from classification. No automatic entries from suspected flakes; no blanket green, deletion or silent exclusion. Validate expired/missing-owner cases and prove the original gate remains strict before any rollout.

## Separate proposal B — customer-controlled history

Not implemented. Customer chooses storage (local/CI artifacts or their own repository), baseline/candidate refs, branch/job/platform/environment filters, window and retention. No automatic hosted upload or history fetch. Show both selected windows and excluded/missing data; detect duplicate run IDs, reporter/retry-policy and identity changes. Comparisons must report uncertainty, not mix branches into false regressions. Begin with explicit import/export and customer approval, then validate on one authorized real service. No private customer records are needed for this synthetic increment.

## Proposed metrics — no customer results collected

- **Setup time:** elapsed time from starting the documented setup to the first valid local report for the chosen input set. Record environment, missing prerequisites and failed attempts. A report containing abstentions is still valid analysis, not evidence of CI health. Report median/range only after actual opt-in observations.
- **Triage time:** time from opening a failure report to a developer-recorded disposition and next action. Compare paired tasks with/without evidence explanations; record interruptions and unresolved cases, not only quick successes.
- **Classification corrections:** human-reviewed old verdict → corrected verdict, reason, evidence window and reviewer. Rate = corrected classifications / all reviewed classifications, accompanied by reviewed count and abstention count. An abstention is not automatically a wrong classification; disposition and truth labels require review. Zero reviewed cases means not measured, not 0%.

Use a private customer-controlled worksheet with start/end timestamps, tool revision, run/window identifiers, original/reviewed verdict, correction reason and reviewer. No telemetry is introduced. Synthetic oracle agreement and local/CI test timings are engineering checks, not customer accuracy, adoption, savings or productivity outcomes.
