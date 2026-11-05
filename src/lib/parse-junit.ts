import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Attempt, AttemptStatus, CommitSource, ParsedRun, RunIdSource } from "@/lib/types";

export class JUnitParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JUnitParseError";
  }
}

const COMMIT_KEYS = ["commit", "sha", "git_sha", "git.sha", "revision", "github.sha", "ci.commit_sha", "commit_sha"];
const RUN_KEYS = ["ci.run_id", "run_id", "runid", "github.run_id", "build_id", "pipeline_id", "build"];
const TIME_KEYS = ["ci.timestamp", "timestamp", "date", "ci.time"];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreDeclaration: true,
  isArray: (name) => ["testsuite", "testcase", "property", "failure", "error", "skipped"].includes(name),
});

export function metadataFromFilename(filename: string): {
  commit?: string;
  runId?: string;
  timestamp?: string;
} {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const result: { commit?: string; runId?: string; timestamp?: string } = {};

  const labeledCommit = base.match(/(?:commit|sha|rev)[-_]?([0-9a-f]{7,40})(?![0-9a-f])/i);
  if (labeledCommit?.[1]) {
    result.commit = labeledCommit[1].toLowerCase();
  } else {
    const loose = base.match(/[-_]([0-9a-f]{7,40})(?=\.[^.]+$|$)/i);
    if (loose?.[1]) result.commit = loose[1].toLowerCase();
  }

  const run = base.match(/(?:run|build|pipeline)[-_]([A-Za-z0-9]+)/i);
  if (run?.[1]) result.runId = run[1];

  const compact = base.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/i);
  if (compact) {
    result.timestamp = `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`;
  } else {
    const day = base.match(/(\d{4}-\d{2}-\d{2})/);
    if (day?.[1]) result.timestamp = day[1];
  }

  return result;
}

export function parseJUnit(xml: string, filename: string, order: number): ParsedRun {
  const cleaned = xml.replace(/^\uFEFF/, "").trim();
  if (!cleaned) {
    throw new JUnitParseError(`${filename} is empty.`);
  }

  if (/<!DOCTYPE|<!ENTITY|\u0000/i.test(cleaned) || XMLValidator.validate(cleaned) !== true) {
    throw new JUnitParseError(`${filename} is malformed or contains unsupported XML declarations.`);
  }
  let raw: unknown;
  try {
    raw = parser.parse(cleaned) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid XML";
    throw new JUnitParseError(`${filename} is not valid JUnit XML (${detail}).`);
  }

  if (!raw || typeof raw !== "object") {
    throw new JUnitParseError(`${filename} did not contain a JUnit document.`);
  }

  const root = raw as Record<string, unknown>;
  const fromName = metadataFromFilename(filename);
  const rootProps = readProperties(asRecord(root.testsuites));
  const suites = collectSuites(root);
  if (suites.length === 0) {
    throw new JUnitParseError(`${filename} has no testsuite element.`);
  }

  const suiteProps = suites.map((suite) => readProperties(suite));
  const commitFromFile = firstValue(rootProps, COMMIT_KEYS) ?? firstDefined(suiteProps.map((props) => firstValue(props, COMMIT_KEYS)));
  const runFromFile = firstValue(rootProps, RUN_KEYS) ?? firstDefined(suiteProps.map((props) => firstValue(props, RUN_KEYS)));
  const timeFromProps = firstTimestamp(rootProps) ?? firstDefined(suiteProps.map((props) => firstTimestamp(props)));
  const timeFromAttr = firstDefined(suites.map((suite) => stringAttr(suite, "@_timestamp")));

  const commitSource: CommitSource = commitFromFile ? "file" : fromName.commit ? "filename" : "order";
  const commit = commitFromFile ?? fromName.commit ?? `order-${order}`;
  const runIdSource: RunIdSource = runFromFile ? "file" : fromName.runId ? "filename" : "order";
  const runId = runFromFile ?? fromName.runId ?? `file-${order}`;
  const timestamp = timeFromAttr ?? timeFromProps ?? fromName.timestamp ?? null;

  const warnings: string[] = [];
  if (commitSource === "order") warnings.push("No commit SHA found; this run is ordered by file position.");
  if (runIdSource === "order") warnings.push("No run id found; a file-order id was assigned.");

  const attempts: Attempt[] = [];
  const seen = new Map<string, number>();

  for (const suite of suites) {
    for (const testcase of asArray(suite.testcase)) {
      const node = asRecord(testcase);
      if (!node) continue;
      const name = stringAttr(node, "@_name");
      if (!name) {
        throw new JUnitParseError(`${filename} contains an unnamed testcase; partial analysis is refused.`);
      }
      const classname = stringAttr(node, "@_classname") || stringAttr(node, "@_file") || stringAttr(suite, "@_name");
      const id = classname ? `${classname} > ${name}` : name;
      const sequence = seen.get(id) ?? 0;
      seen.set(id, sequence + 1);
      const caseProps = readProperties(node);
      const explicitRetry = caseProps.retry ?? caseProps["flaky.retry"] ?? caseProps.attempt;
      const retryIndex = explicitRetry != null && /^\d+$/.test(explicitRetry) ? Number(explicitRetry) : sequence;
      const failure = readFailure(node);
      const status = statusOf(node, failure.present);
      attempts.push({
        testId: id,
        classname,
        name,
        status,
        durationMs: readDuration(node),
        message: failure.message,
        details: failure.details,
        retryIndex,
        retrySource: explicitRetry != null && /^\d+$/.test(explicitRetry) && Number.isSafeInteger(Number(explicitRetry)) ? "property" : "sequence",
        sequence,
        commit,
        runId,
        timestamp,
        sourceName: filename,
        fileOrder: order,
      });
    }
  }

  if (attempts.length === 0) {
    throw new JUnitParseError(`${filename} did not contain any named testcase elements.`);
  }

  return {
    sourceName: filename,
    order,
    commit,
    commitSource,
    runId,
    runIdSource,
    timestamp,
    attempts,
    warnings,
  };
}

function collectSuites(root: Record<string, unknown>): Record<string, unknown>[] {
  const suites: Record<string, unknown>[] = [];
  const testsuites = asRecord(root.testsuites);
  if (testsuites) suites.push(...asRecords(testsuites.testsuite));
  suites.push(...asRecords(root.testsuite));
  return suites;
}

function statusOf(node: Record<string, unknown>, hasFailure: boolean): AttemptStatus {
  const skipped = asArray(node.skipped);
  const attr = stringAttr(node, "@_status").toLowerCase();
  if (skipped.length > 0 || attr === "skipped" || attr === "skip") return "skip";
  if (hasFailure || attr === "failed" || attr === "failure" || attr === "error") return "fail";
  return "pass";
}

function readFailure(node: Record<string, unknown>): { present: boolean; message: string; details: string } {
  const nodes = [...asArray(node.failure), ...asArray(node.error)];
  if (nodes.length === 0) return { present: false, message: "", details: "" };
  const messages: string[] = [];
  const bodies: string[] = [];
  for (const entry of nodes) {
    if (typeof entry === "string" || typeof entry === "number") {
      bodies.push(String(entry).trim());
      continue;
    }
    const record = asRecord(entry);
    if (!record) continue;
    const message = stringAttr(record, "@_message");
    const text = stringAttr(record, "#text");
    if (message) messages.push(message);
    if (text) bodies.push(text);
  }
  const details = bodies.join("\n").trim();
  const message = (messages[0] ?? details.split("\n")[0] ?? "").trim();
  return { present: true, message, details };
}

function readDuration(node: Record<string, unknown>): number | null {
  const raw = stringAttr(node, "@_time") || stringAttr(node, "@_duration");
  if (!raw) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds)) return null;
  return Math.round(seconds * 1000);
}

function readProperties(node: Record<string, unknown> | null): Record<string, string> {
  if (!node) return {};
  const properties = asRecord(node.properties);
  const list = properties ? asArray(properties.property) : [];
  const out: Record<string, string> = {};
  for (const entry of list) {
    const record = asRecord(entry);
    if (!record) continue;
    const name = stringAttr(record, "@_name").trim().toLowerCase();
    const value = (stringAttr(record, "@_value") || stringAttr(record, "#text")).trim();
    if (name) out[name] = value;
  }
  return out;
}

function firstValue(props: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key];
    if (value) return value;
  }
  return undefined;
}

function firstTimestamp(props: Record<string, string>): string | undefined {
  for (const key of TIME_KEYS) {
    const value = props[key];
    if (value && looksLikeTimestamp(value)) return value;
  }
  return undefined;
}

function looksLikeTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{8}T\d{6}/.test(value);
}

function firstDefined(values: Array<string | undefined>): string | undefined {
  return values.find((value) => value != null && value !== "");
}

function stringAttr(node: Record<string, unknown>, key: string): string {
  const value = node[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    return record ? [record] : [];
  });
}
