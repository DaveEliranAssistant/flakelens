# Recorded synthetic before/after

These are actual executions of the existing thin CLI, not customer outcomes. The eight-case XML and independent expected verdicts were written before implementation. Old code: PR #7 head `e0a76acf21b83a0cb4b73ee82035582ed8488e1b`. New code uses the same parser/scorer/report entry points with policy `flakelens.evidence/1`. Input hashes and full classifications are in `synthetic-before-after.json`.

- Isolated failure: **flaky → insufficient-evidence**, reason `single-failure`. One failure does not demonstrate varying outcomes.
- Always failing, no passing baseline: **regression → insufficient-evidence**, reason `no-passing-baseline`. Persistent failure is visible but the observed history cannot establish a regression boundary.
- Pass/fail/pass on different commits: **flaky → insufficient-evidence**, reason `cross-commit-only`. Legitimate fixes/rebreaks remain possible.
- Missing metadata and one failure: **flaky → insufficient-evidence**; missing commit/run IDs and file-order chronology are explicit.
- Explicit retry failure/recovery: **flaky → flaky**, now with retry indexes/provenance, attempted statuses, run and commit metadata and investigation guidance.
- Passing run followed by two independently identified, timestamp-ordered all-failing runs at changed commits: **regression → regression**, now explaining the first observed failure boundary without claiming causal proof.
- Skipped-only: **stable → insufficient-evidence**, reason `no-executed-attempts`.
- Passing-only: **stable → stable**, visibly labeled no failures observed rather than promised future stability.

Actual totals on this fixture: before 4 flaky / 2 regression / 2 stable; after 1 flaky / 1 regression / 5 insufficient evidence / 1 no failures observed. All 9 raw failed attempts remain present. Native JSON version is now 2; shared QE v1 is unchanged and this aggregate remains FAIL due to the seeded regression. Passing fixture assertions means the classifier matched the declared synthetic oracle, not that the seeded CI failures are harmless.

The original 30-file Marigold XML and seed generator were not regenerated. Assertions that contradicted abstention, retry provenance, heuristic cluster naming and no-quarantine behavior were explicitly updated; frozen raw counts and generator-equality assertions remain.

No setup-time, triage-time, customer accuracy or savings claims follow from this fixture. Customer metrics and separate proposed increments are defined in `../TRIAGE_POLICY.md`.
