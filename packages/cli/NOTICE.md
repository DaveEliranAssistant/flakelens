# Provenance

The CLI bundle is built from this repository's scripts/cli.ts, src/lib analysis/parser/report modules and qe-result.mjs, under the root MIT license (copied alongside the bundle). No engine changes are introduced by this package. The web application, fixtures, source maps, environment files and web dependencies are excluded.

fast-xml-parser is an external runtime dependency, pinned exactly in package.json. It and its transitive dependencies retain their respective npm license metadata and notices; no third-party parser code is inlined into the CLI bundle. esbuild is a build-only tool, not a runtime dependency.
