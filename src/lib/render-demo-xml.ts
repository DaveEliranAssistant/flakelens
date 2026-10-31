import { compareText } from "@/lib/compare";
import {
  CLUSTER_MESSAGES,
  DEMO_SEED,
  type DemoTestDef,
  type FailureClusterKey,
  type PlannedRun,
  attemptsForTest,
  demoTests,
  hexFromRng,
  mulberry32,
  testId,
} from "@/lib/demo-plan";

export type XmlStyle = "playwright" | "jest" | "pytest";

export function xmlStyleForRun(runNumber: number): XmlStyle {
  if (runNumber <= 10) return "playwright";
  if (runNumber <= 20) return "jest";
  return "pytest";
}

export function demoIndex(runs: PlannedRun[]): { synthetic: true; description: string; files: string[] } {
  return {
    synthetic: true,
    description:
      "Synthetic Marigold Shop CI runs from scripts/generate-demo.ts. Fictional tests, not a customer's data.",
    files: runs.map((run) => run.filename),
  };
}

export function renderRunXml(run: PlannedRun): string {
  const style = xmlStyleForRun(run.number);
  const rng = mulberry32((DEMO_SEED ^ 0x51ed) + run.number * 997);
  const tests = [...demoTests()].sort((a, b) => compareText(testId(a.classname, a.name), testId(b.classname, b.name)));
  const rendered: RenderedCase[] = [];

  for (const test of tests) {
    for (const attempt of attemptsForTest(test.key, run.number)) {
      const seconds = 0.04 + rng() * 1.6;
      const failed = attempt.status === "fail" && attempt.cluster != null;
      const body = failed && attempt.cluster ? failureBody(attempt.cluster, run, test, rng) : "";
      const message = failed && attempt.cluster ? CLUSTER_MESSAGES[attempt.cluster] : "";
      rendered.push({
        classname: test.classname,
        name: test.name,
        seconds,
        failed,
        xml: renderTestcase({
          style,
          classname: test.classname,
          name: test.name,
          seconds,
          retry: attempt.retry,
          failed,
          message,
          body,
        }),
      });
    }
  }

  const failures = rendered.filter((item) => item.failed).length;
  const totalTime = rendered.reduce((sum, item) => sum + item.seconds, 0).toFixed(3);
  const properties = renderProperties(run);

  if (style === "jest") {
    const groups = new Map<string, RenderedCase[]>();
    for (const item of rendered) {
      const list = groups.get(item.classname) ?? [];
      list.push(item);
      groups.set(item.classname, list);
    }
    const suites = [...groups.entries()]
      .sort((a, b) => compareText(a[0], b[0]))
      .map(([classname, items]) => {
        const suiteFailures = items.filter((item) => item.failed).length;
        const suiteTime = items.reduce((sum, item) => sum + item.seconds, 0).toFixed(3);
        return [
          `  <testsuite name="${escapeXml(classname)}" tests="${items.length}" failures="${suiteFailures}" time="${suiteTime}">`,
          properties,
          ...items.map((item) => item.xml),
          "  </testsuite>",
        ].join("\n");
      });
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<!-- Synthetic Marigold Shop fixture. Not real CI output. -->`,
      `<testsuites name="jest tests" tests="${rendered.length}" failures="${failures}">`,
      ...suites,
      `</testsuites>`,
      ``,
    ].join("\n");
  }

  const suiteOpen =
    style === "playwright"
      ? `<testsuite name="marigold-shop" hostname="ci-local" tests="${rendered.length}" failures="${failures}" skipped="0" time="${totalTime}" timestamp="${escapeXml(run.timestamp)}">`
      : `<testsuite name="pytest" tests="${rendered.length}" failures="0" errors="${failures}" skipped="0" time="${totalTime}" timestamp="${escapeXml(run.timestamp)}">`;

  const body = [suiteOpen, properties, ...rendered.map((item) => item.xml), `</testsuite>`];
  if (style === "playwright") {
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<!-- Synthetic Marigold Shop fixture. Not real CI output. -->`,
      `<testsuites name="marigold-playwright" tests="${rendered.length}" failures="${failures}">`,
      ...body.map((line) => (line.startsWith("<") ? `  ${line}` : line)),
      `</testsuites>`,
      ``,
    ].join("\n");
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- Synthetic Marigold Shop fixture. Not real CI output. -->`,
    ...body,
    ``,
  ].join("\n");
}

type RenderedCase = {
  classname: string;
  name: string;
  seconds: number;
  failed: boolean;
  xml: string;
};

function renderProperties(run: PlannedRun): string {
  return [
    `    <properties>`,
    `      <property name="commit" value="${escapeXml(run.sha)}"/>`,
    `      <property name="ci.run_id" value="${escapeXml(run.runId)}"/>`,
    `      <property name="ci.timestamp" value="${escapeXml(run.timestamp)}"/>`,
    `    </properties>`,
  ].join("\n");
}

function renderTestcase(input: {
  style: XmlStyle;
  classname: string;
  name: string;
  seconds: number;
  retry: number;
  failed: boolean;
  message: string;
  body: string;
}): string {
  const timeAttr = input.style === "jest" ? "duration" : "time";
  const open = `    <testcase classname="${escapeXml(input.classname)}" name="${escapeXml(input.name)}" ${timeAttr}="${input.seconds.toFixed(3)}">`;
  const chunks = [open];
  if (input.style === "playwright") {
    chunks.push(`      <properties><property name="retry" value="${input.retry}"/></properties>`);
  }
  if (input.failed) {
    const escapedBody = escapeXml(input.body);
    if (input.style === "pytest") {
      chunks.push(`      <error message="${escapeXml(input.message)}">${escapedBody}</error>`);
    } else if (input.style === "jest") {
      chunks.push(`      <failure>${escapedBody}</failure>`);
    } else {
      chunks.push(`      <failure message="${escapeXml(input.message)}" type="Error">${escapedBody}</failure>`);
    }
  }
  chunks.push(`    </testcase>`);
  return chunks.join("\n");
}

function failureBody(cluster: FailureClusterKey, run: PlannedRun, test: DemoTestDef, rng: () => number): string {
  const line = 8 + Math.floor(rng() * 240);
  const column = 1 + Math.floor(rng() * 60);
  const duration = 250 + Math.floor(rng() * 8000);
  const hex = hexFromRng(rng, 12);
  const file = test.classname.replace(/^tests\//, "");
  const prefixes = [
    "/home/runner/work/marigold-shop/e2e",
    "/opt/ci/workspace/marigold-shop/e2e",
    "/Users/ci/builds/marigold-shop/e2e",
  ];
  const unix = `${prefixes[run.number % prefixes.length]}/${file}:${line}:${column}`;
  const windows = `C:\\builds\\marigold-shop\\e2e\\${file}:${line}:${column}`;
  const at = run.number % 5 === 0 ? windows : unix;
  const message = CLUSTER_MESSAGES[cluster];
  if (cluster === "timeout") {
    return `${message}\n    at ${at}\n    duration=${duration}ms\n    traceId=${hex}\n    at ${run.timestamp}`;
  }
  if (cluster === "detached") {
    return `${message}\n    at ${at}\n    elapsed ${duration}ms\n    request 0x${hex}\n    observed ${run.timestamp}`;
  }
  return `${message}\n    at ${at}\n    ruleSet=${hex}\n    evaluated at ${run.timestamp}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
