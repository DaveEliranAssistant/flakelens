import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeRuns } from "../../src/lib/analyze";
import { demoRuns } from "../../src/lib/demo-plan";
import { parseJUnit } from "../../src/lib/parse-junit";
import type { Analysis, ParsedRun } from "../../src/lib/types";

export function loadDemoParsed(): ParsedRun[] {
  const directory = path.join(process.cwd(), "public", "demo");
  return demoRuns().map((run, index) => {
    const text = readFileSync(path.join(directory, run.filename), "utf8");
    return parseJUnit(text, run.filename, index);
  });
}

export function loadDemoAnalysis(): Analysis {
  return analyzeRuns(loadDemoParsed());
}
