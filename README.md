# FlakeLens

FlakeLens is a privacy-first flaky-test triage tool. You give it several JUnit XML files — one CI run each — and it separates oscillating tests from real regressions, then clusters the failures into root causes. Parsing and scoring run in the browser. There is no database and no upload API.

The sample history is synthetic: a fictional shop called Marigold, produced by a seeded generator. It is not anyone's CI.

## Run

Node 24 (see `.nvmrc`).

```bash
nvm use
npm install
npx playwright install chromium
npm test
npm run test:e2e
npm run build
npm run dev
```

`npm run build` is a standard Next.js build, suitable for Vercel with no extra config. This repo does not deploy anything.

Regenerate the committed demo fixtures after changing the seed plan:

```bash
npm run generate:demo
```

## What the demo contains

`scripts/generate-demo.ts` writes 30 JUnit files to `public/demo/`. The outcomes are fixed in `src/lib/demo-plan.ts`:

- 5 flaky tests (retry recoveries, same-commit reruns, and intermittent failures)
- 1 regression, introduced at run 18 and failed on every attempt after that
- 3 failure clusters after normalization
- 12 stable tests that always pass

Runs 1–10 look like Playwright XML, 11–20 like Jest, 21–30 like pytest. Test ids stay the same so the history joins.

## Privacy model

Dropped files are read with the File API and parsed locally. They are not sent to a server. The only network request the app makes for analysis is when you click **Load demo data**, which fetches the static synthetic XML from this same origin.

The waitlist field writes the address to `localStorage` and opens a `mailto:` draft. There is no account server and no payment.

This site uses Vercel Web Analytics (cookieless, aggregated page views, no personal profiles). Privacy questions: dave.eliran.assistant@gmail.com.

## How a verdict is chosen

- **Regression.** Final results are all failures, or they switch once from pass to fail and then at least two runs stay failed. Every attempt from that commit onward fails, including retries, and no commit contains both a pass and a fail.
- **Flaky.** The test fails without meeting that bar. A pass on retry, a same-commit rerun, or a single trailing failure all count. The flakiness score is `min(1, flip events / runs)`.
- **Stable.** No failing attempts. Skips are ignored.

Flip events are same-commit pass/fail mixes, runs that passed on retry, and oscillations of the final result between consecutive runs. Flip rate is flip events divided by executions (non-skip attempts). **Impact = flip rate × executions.** The cost estimate treats each failed attempt on a flaky test as one investigation. Regressions are listed separately and are not included. Minutes and hourly rate are editable assumptions.

Failure clustering strips line:column numbers, durations, absolute paths, hex ids, and timestamps, then groups the remaining text. The summary reads `N failures = K root causes`.

## Export

Download a JSON report, download Markdown, or copy the quarantine list (the flaky test ids, one per line).

## Limitations

- Labels are a heuristic, not a proof that a test is nondeterministic or that a break is a product bug.
- One file is one run. Retries are repeated testcase names or a numeric `retry` property.
- Same-commit detection needs a shared SHA across files, or both outcomes inside one file.
- A single trailing failure is called flaky. A test that fails in every uploaded run is a regression since the first included commit, which may be older than the underlying break.
- Normalization can merge unrelated failures when the remaining words match, and it will split one cause when the messages differ by more than the stripped tokens.
- There is no memory across reloads.

## Runner CLI (thin adapter)

The CLI uses the same `parseJUnit`, `analyzeRuns` and report renderers as the browser—no separate flakiness algorithm, server or upload API. With Node 24 and locked dependencies installed:

```bash
npm ci --ignore-scripts
node --import tsx scripts/cli.ts \
  --json /new/output/flakelens.json --markdown /new/output/flakelens.md \
  /inputs/junit-01.xml /inputs/junit-02.xml /inputs/junit-03.xml
```

Outputs must be distinct new files in existing directories. Exit `0` means analysis was produced (flakiness/regression findings are informational), and `2` means invalid input or a local tool/I/O failure. CI can append the Markdown to its job summary. Artifacts can also be loaded into the browser at <https://flakelens.vercel.app>.

The adapter limits input to 100 files, 2 MiB per file, 10 MiB total and 50,000 attempts per file; it rejects symbolic-link final components, DTD/entity declarations, invalid UTF-8 and malformed XML before calling the shared parser. This is bounded local file processing, not an OS sandbox. Reports may contain sensitive test names and failure text; choose artifact visibility accordingly. No repository/test code is executed by parsing. Five reruns of one commit can show same-commit flakiness but cannot prove a commit-regression boundary.

## Roadmap

- A dedicated GitHub Action and persisted-history integration. The thin runner CLI above does not provide these.
- A paid tier for saved history across branches and a shared quarantine list. Not built here, and this POC does not take payment.

## License

MIT. See `LICENSE`.

## CLI package (npm prerelease)

The web root stays private. See [the isolated @qe-atlas/flakelens package](packages/cli/README.md) for npm and local tarball installation and current informational exit-code limits, and [launch verification](docs/FREE-LAUNCH.md) for build/provenance/test evidence. `npm run test:pack` builds and smoke-tests the actual installed archive.
