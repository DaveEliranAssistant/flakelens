# FlakeLens package readiness — 2026-11-05

`packages/cli` is the isolated @qe-atlas/flakelens package. `@qe-atlas/flakelens@0.1.0-rc.1` is published on npm with dist-tags `latest` and `next` (registry readback 2026-11-06). The root remains private. `npm run build:cli` bundles repository-owned scripts/cli.ts, qe-result.mjs and the shared src/lib engine using exact esbuild 0.28.2; it resolves TypeScript path aliases and leaves fast-xml-parser external. No product behavior changes. Only dist/cli.mjs, README, LICENSE, NOTICE and package.json are packed; no Next/React, fixtures, source maps or environment files.

MIT source rights come from the existing repository LICENSE. The package lock pins fast-xml-parser 5.11.2 and eight runtime dependency packages; all list MIT licenses. esbuild is build-only and already existed transitively in the root lock; its new direct pin changes no dependency resolution. The package has public/next publish metadata. A first publish attempt on 2026-11-05 was refused with a 403 because the qe-atlas npm login had neither two-factor authentication nor a granular token with 2FA bypass; the package has since been published. `packages/cli/README.md` ships in the tarball. Maintainer commands and the npm qe-atlas identity check are in packages/cli/README.md.

The CLI reports flakiness/regressions informationally: exit 0 even for findings, exit 2 for errors. It is not the planned enforcement feature from the shared work register. No engine, scoring, parser or web feature changes were made.

## Validation

Local Node v22.22.2: npm test passed 22 tests; npm run lint passed; npm run build passed; node --test qe-result*.test.mjs passed 3 tests. npm run test:pack built the bundle, checked the exact tarball allowlist, installed it with an empty registry cache outside the repository and executed the installed CLI without tsx/source-tree access. It checked fail/pass/fail => one flaky plus one stable test, actual JSON/Markdown and shared warning verdict, non-overwrite behavior and entity refusal.

The initial npm run test:e2e could not start because 127.0.0.1:3000 was occupied. A temporary config changed only loopback port/baseURL to 31873; unchanged synthetic demo E2E passed. No existing service was stopped. Root engines requests Node >=24 and npm warned on this machine's Node 22; Node 24 validation is delegated to the added CI matrix (22/24), not claimed locally. Production audit found zero vulnerabilities; root install reported eight moderate development-tool advisories, not repaired by broad dependency changes here.

The readiness work above made no publish, production deploy, merge, account/DNS or protection changes; the npm prerelease was a separate later step. It is a prerelease, not a stable release or an enforced regression gate.
