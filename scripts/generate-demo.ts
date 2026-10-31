/**
 * Writes the committed Marigold Shop fixtures.
 * Seed and outcomes live in src/lib/demo-plan.ts:
 * 30 CI runs, 5 flaky tests, 1 regression introduced at run 18, 3 failure clusters.
 * The shop and its CI history are fictional.
 */
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { demoRuns } from "../src/lib/demo-plan";
import { demoIndex, renderRunXml } from "../src/lib/render-demo-xml";

const outDir = path.join(process.cwd(), "public", "demo");
mkdirSync(outDir, { recursive: true });

const runs = demoRuns();
const expected = new Set(runs.map((run) => run.filename));

for (const entry of readdirSync(outDir)) {
  if (entry.endsWith(".xml") && !expected.has(entry)) {
    unlinkSync(path.join(outDir, entry));
  }
}

for (const run of runs) {
  writeFileSync(path.join(outDir, run.filename), renderRunXml(run), "utf8");
}

writeFileSync(path.join(outDir, "index.json"), `${JSON.stringify(demoIndex(runs), null, 2)}\n`, "utf8");
console.log(`Wrote ${runs.length} synthetic JUnit files to ${outDir}`);
