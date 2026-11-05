# Reproducible CI quickstart — existing CLI

Node 24, Git and npm. The package is private/unreleased; there is no promised `npx flakelens` install. This consumes the public review code from PR #9, stacked on #7 and #4. Runtime pin: `647f7d83b36b6f4d0878611078fea28e0babc583`. This is a review revision, not a release tag. No credentials or remote history are needed.

## Run the eight-case synthetic proof locally

Use a new output directory; existing reports are intentionally not overwritten:

```bash
git clone https://github.com/DaveEliranAssistant/flakelens.git flakelens-review
cd flakelens-review
git checkout --detach 647f7d83b36b6f4d0878611078fea28e0babc583
npm ci --ignore-scripts
mkdir triage-output
node --import tsx scripts/cli.ts \
  --json triage-output/flakelens.json --markdown triage-output/flakelens.md \
  --qe-result triage-output/qe-result-flakelens.json \
  tests/fixtures/evidence/run-1.xml tests/fixtures/evidence/run-2.xml \
  tests/fixtures/evidence/run-3.xml tests/fixtures/evidence/missing-metadata.xml
```

Expected on these **synthetic inputs only**: 4 files, 8 tests; 1 flaky (explicit recovery), 1 regression pattern, 5 insufficient evidence and 1 no-failures-observed case. All 9 failed attempts stay visible. The shared result is **FAIL** for the seeded regression. The CLI exits **0 because analysis completed**, not because test failures should be ignored. Operational/input errors exit **2**. See `tests/fixtures/evidence/expected.json` for the independently declared cases.

For a real input set, replace only the four XML paths with explicitly selected files; preserve the code pin and new output paths. Each file must represent one comparable CI run. Prefer properties `commit`, `run_id` and timezone-qualified `timestamp`; explicit numeric `retry` indexes identify reported retry attempts. Missing metadata is displayed, not fabricated. A single current failure can legitimately yield insufficient evidence; investigate it rather than suppress it.

## CI example actually exercised in qe-dogfood

The full [synthetic consumer workflow](https://github.com/DaveEliranAssistant/qe-dogfood/blob/demo/flakelens-evidence-triage/.github/workflows/flakelens-triage.yml) checks out this exact public FlakeLens revision, installs locked dependencies with `--ignore-scripts`, calls **the same existing CLI**, validates the independent fixture oracle and retains only the synthetic inputs/reports. It uses immutable Action revisions and read-only contents permission, no secrets, no `pull_request_target` and no comment/deployment permissions. See the consumer PR and its Actions run for exact remote evidence; the before/after files are recorded actual CLI output, not customer results.

A green fixture-proof job means the classifier matched this intentionally failing fixture. It does **not** mean a real application CI job is healthy. Existing qe-dogfood gates, frozen baselines and demo PR A/B are not changed by this proof. The optional shared reporter can consume `qe-result-flakelens.json` unchanged; unknown/flaky WARN and known regressions FAIL.

## Add triage to your own CI without laundering failures

Keep your existing test job, command, assertions and exit behavior unchanged. Add local CLI analysis after JUnit is produced (`if: always()`), or in a separate `needs: [your-test-job]` job with `if: always() && !cancelled()` that downloads your explicitly retained JUnit. The latter must not replace or become a substitute required check for the original test job. Your test command and artifact/job names depend on your runner; this integration outline is not a verified customer workflow.

Use trusted pinned analysis tooling separate from untrusted application execution, read-only permissions and disabled checkout credential persistence. Call the CLI exactly as above against local files. Do not add `continue-on-error`, `|| true`, auto-reruns, generated quarantine lists or exclusions to make test failures green. Analysis exit 0 is not an enforcement decision. Treat exit 2 and missing/partial reports as operational errors, not clean reports. Retain both the original job's failure and triage output.

Uploads are not required by FlakeLens. If you choose your CI's artifact transport, review privacy, access and retention: names, failure messages and caller metadata can be sensitive. The synthetic example's 14-day GitHub artifacts can expire and require authentication. Local browser import/export works without a FlakeLens backend; the reviewed browser build must be used for the new policy, not assumed deployed at the old hosted URL.

Owner/expiry quarantine and customer-controlled history selection/comparison remain separate proposals in [TRIAGE_POLICY.md](TRIAGE_POLICY.md). No customer setup/triage-time or correction-rate results have been measured.
