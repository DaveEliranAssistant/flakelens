# FlakeLens

Local CI-failure triage from JUnit XML: **insufficient evidence**, observed flaky signals, persistent regression patterns, and no failures observed. Every verdict includes the runs, attempts, retry provenance, caller-supplied commit metadata, rule reasons, limitations and a suggested next investigation. Browser and CLI share the parser, classifier and native report renderers. No upload API or database.

## Review/release status

This increment is stacked on open, **unmerged** PR #7 (shared QE results), which is stacked on open PR #4 (thin CLI). Main at inspection was `c5f5d326a02f72972c9521515a65f8344f53ca6e`; #4 was `ec0969e0e2b3171f664cd351c60979b5c227fcbf`; #7 was `e0a76acf21b83a0cb4b73ee82035582ed8488e1b`. No GitHub releases existed and the npm package is private. Do not assume main, the hosted browser site, or an npm release includes these changes. No PRs were merged or closed for this increment.

## Local use

Requires Node 24 and Git. From the reviewed checkout:

```bash
npm ci --ignore-scripts
npm test
node --test qe-result*.test.mjs
npx --no-install tsc --noEmit
npm run lint
npx --no-install playwright install chromium
npm run test:e2e
npm run build
npm run dev
```

If port 3000 is already occupied, use `FLAKELENS_TEST_PORT=4327 npm run test:e2e`; the test server stays loopback-only. Browser tests compare every synthetic verdict, reason and run history with actual CLI output and check desktop/mobile accessibility.

The existing thin CLI remains the entry point:

```bash
mkdir new-reports
node --import tsx scripts/cli.ts \
  --json new-reports/flakelens.json --markdown new-reports/flakelens.md \
  tests/fixtures/evidence/run-1.xml tests/fixtures/evidence/run-2.xml \
  tests/fixtures/evidence/run-3.xml tests/fixtures/evidence/missing-metadata.xml
```

Outputs must be new distinct files in an existing directory. A `qe-result-flakelens.json` is also produced (`--qe-result` changes its path). Exit **0 means analysis completed, not a passing CI run**; exit **2** means invalid/unsafe input or a tool/I/O failure. Keep the original failing test job red. Do not quarantine or ignore failures based on these labels. See [reproducible CI quickstart](docs/CI_QUICKSTART.md).

## Evidence policy

- **Insufficient evidence:** one failure; cross-commit oscillation alone; all failures without a passing baseline; skipped-only samples; or an unqualified regression boundary. Investigate rather than suppress.
- **Flaky:** explicit retry recovery or both pass/fail outcomes at a provided commit. This is observed variation, not proof of nondeterminism or harmlessness. Inferred repeated testcase order is not advertised as a confirmed retry.
- **Regression:** a passing observation followed by two or more independent timestamp-ordered all-failing runs, with commit/run metadata and a changed commit. The first observed failing commit is not a proven causal commit. Older unrelated flaky history cannot hide this pattern.
- **Stable:** no failures observed, with at least one passing attempt. This is not a promise about future runs.

See [policy, limitations, migration, follow-ups and proposed metrics](docs/TRIAGE_POLICY.md). Shared QE result v1 is unchanged: regression → FAIL; flaky or insufficient evidence → WARN; only no observed findings → PASS. CLI analysis-only exits are unchanged.

## Reports and privacy

Expand **Why this verdict** in the browser or read native JSON/Markdown. JSON **version 2** adds evidence and abstention; `quarantine` and `actionsApplied` are always empty. Review candidates are not an executable quarantine policy. Heuristic scores are ranking signals, not probabilities; abstention scores are not computed. Message-similarity clusters are not confirmed root causes. Editable cost scenarios are not measured costs or savings and exclude regressions/insufficient evidence.

JUnit is processed locally. Browser analysis does not send selected files to a service; the synthetic demo fetches static local-origin fixtures. Existing Vercel cookieless page analytics remains disclosed on the page, separate from analysis. The optional waitlist remains localStorage plus a mailto draft, not a signup backend. No histories are automatically fetched or persisted. CI artifact uploads are explicit transport under your control: reports include names, messages and metadata, so choose visibility and retention carefully.

The CLI retains its existing bounds (100 files, 2 MiB/file, 10 MiB total, 50,000 attempts/file), final-component symlink rejection and no-overwrite outputs. Browser and CLI reject malformed XML/DTD/entities and unnamed testcases; invalid selections do not silently leave a partial clean result. Browser resource limits are not equivalent to the bounded CLI. One file must be one CI run; do not mix branches, unrelated jobs, shards or environments without reviewing identity/provenance.

## Synthetic evidence, not customers

`tests/fixtures/evidence/` defines eight explicit cases with an independent expected-verdict manifest. Public `qe-dogfood` consumes an immutable product revision; no second classifier is copied there.

The original 30-file Marigold demo and seed generator are unchanged. It seeds five intermittent/recovery cases; the conservative observed-evidence policy classifies three as flaky and abstains on two cross-commit-only cases, while preserving the one regression, 12 no-failure cases and all 32 raw failed attempts. No baselines or XML were regenerated to make checks green. See recorded before/after examples and actual verification receipts under `docs/evidence/`.

## License

See `LICENSE`. This work does not change the existing license or publish a package.
