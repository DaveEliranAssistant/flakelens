# @qe-atlas/flakelens

Local JUnit flaky-test triage using the same parser/scorer as FlakeLens. Prerelease **0.1.0-rc.1** on the npm `next` tag. Node 22+; Linux/macOS targeted. Windows is not qualified (`O_NOFOLLOW` file handling is platform dependent).

## Use

```sh
npm exec --package=@qe-atlas/flakelens@0.1.0-rc.1 -- flakelens --help
npm exec --package=@qe-atlas/flakelens@0.1.0-rc.1 -- flakelens \
  --json report.json --markdown report.md run-1.xml run-2.xml run-3.xml
```

To install from a reviewed local tarball instead:

```sh
npm install --ignore-scripts --prefix ./isolated-cli /absolute/path/qe-atlas-flakelens-0.1.0-rc.1.tgz
./isolated-cli/node_modules/.bin/flakelens --help
```

Both --json and --markdown are required, outputs must be new and distinct. A third shared-contract JSON file defaults to qe-result-flakelens.json beside the JSON report; override with --qe-result NEW.json. Inputs remain local, with no upload/model call. Report paths, failure text and identifiers can be sensitive: review before sharing. Registry installation is a separate network step.

Exit **0** means a report was produced, even when regressions/flakiness are found. Exit **2** means invalid arguments, unsafe/oversized XML or local I/O failure. This version is informational, not an enforced regression exit-code gate. Shared-contract verdicts may say fail/warn while process status remains 0. Heuristic clusters are suggestions, not proven root causes. Chronology uses metadata where available, otherwise input order. Missing history limits inference. No auto-quarantine, history backend or paid service is included.

Inputs: at most 100 unique regular files, 2 MiB each and 10 MiB total; DTD/entities and malformed XML refused. Existing files are not overwritten. A later I/O failure can leave earlier outputs: inspect/remove partial outputs manually and retry with new paths. Local file limits are not an OS sandbox.

## Maintainer release checklist

From a clean checkout:

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm run build
npm run test:pack # builds runtime; installs tarball outside repo; checks real reports/refusals
npm whoami # must print qe-atlas
cd packages/cli
npm pack --dry-run
npm publish --dry-run --access public --tag next
npm publish --access public --tag next
```

Keep the web root private. Root build tooling is needed only to create the bundle; installed users require neither tsx, TypeScript, Next nor the source checkout. The allowlist ships only the CLI bundle, metadata and licensing/docs. No npm publish occurs in CI.
