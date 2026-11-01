export type AttemptStatus = "pass" | "fail" | "skip";
export type Verdict = "flaky" | "regression" | "stable";
export type CommitSource = "file" | "filename" | "order";
export type RunIdSource = "file" | "filename" | "order";

export type Attempt = {
  testId: string;
  classname: string;
  name: string;
  status: AttemptStatus;
  durationMs: number | null;
  message: string;
  details: string;
  retryIndex: number;
  sequence: number;
  commit: string;
  runId: string;
  timestamp: string | null;
  sourceName: string;
  fileOrder: number;
};

export type TimedAttempt = Attempt & {
  chronology: number;
};

export type ParsedRun = {
  sourceName: string;
  order: number;
  commit: string;
  commitSource: CommitSource;
  runId: string;
  runIdSource: RunIdSource;
  timestamp: string | null;
  attempts: Attempt[];
  warnings: string[];
};

export type HistoryPoint = {
  runId: string;
  commit: string;
  timestamp: string | null;
  sourceName: string;
  chronology: number;
  finalStatus: AttemptStatus;
  attemptStatuses: AttemptStatus[];
  passedOnRetry: boolean;
};

export type TestAnalysis = {
  testId: string;
  classname: string;
  name: string;
  verdict: Verdict;
  flakinessScore: number;
  flipRate: number;
  flipEvents: number;
  impact: number;
  executions: number;
  failures: number;
  passes: number;
  sameCommitFlips: number;
  passedOnRetry: number;
  crossRunOscillations: number;
  introducedCommit: string | null;
  history: HistoryPoint[];
};

export type Cluster = {
  signature: string;
  label: string;
  count: number;
  testIds: string[];
  sample: string;
};

export type RunSummary = {
  sourceName: string;
  order: number;
  commit: string;
  commitSource: CommitSource;
  runId: string;
  timestamp: string | null;
  attemptCount: number;
  failureCount: number;
};

export type Analysis = {
  runs: RunSummary[];
  tests: TestAnalysis[];
  clusters: Cluster[];
  failureCount: number;
  rootCauseCount: number;
  flakyCount: number;
  regressionCount: number;
  stableCount: number;
  flakyFailures: number;
};
