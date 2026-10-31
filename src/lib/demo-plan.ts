/**
 * Deterministic contract for the synthetic Marigold Shop demo.
 * The generator, fixtures, unit tests, and browser demo all share this plan.
 * Marigold Shop is fictional. Nothing here is customer CI data.
 */

export const DEMO_SEED = 0x6d617269;
export const DEMO_RUN_COUNT = 30;
/** 1-based run number where the seeded regression starts failing and stays failed. */
export const REGRESSION_INTRODUCED_AT_RUN = 18;

export const REGRESSION_TEST = {
  classname: "tests/checkout.spec.ts",
  name: "promo codes do not stack GOLD with WELCOME",
} as const;

export const FLAKY_TESTS = [
  {
    key: "tax",
    classname: "tests/checkout.spec.ts",
    name: "tax rounds half away from zero on split tenders",
  },
  {
    key: "search",
    classname: "tests/search.spec.ts",
    name: "autocomplete settles after the debounce window",
  },
  {
    key: "cart",
    classname: "tests/cart.spec.ts",
    name: "concurrent quantity updates keep a single line",
  },
  {
    key: "inventory",
    classname: "tests/inventory.spec.ts",
    name: "reservation releases when the hold expires",
  },
  {
    key: "session",
    classname: "tests/auth.spec.ts",
    name: "session refresh does not drop the cart",
  },
] as const;

export const STABLE_TESTS = [
  { classname: "tests/catalog.spec.ts", name: "lists the marigold ceramic mug" },
  { classname: "tests/catalog.spec.ts", name: "pdp shows glaze variants" },
  { classname: "tests/cart.spec.ts", name: "adds a line for the selected sku" },
  { classname: "tests/cart.spec.ts", name: "removes a line and restores stock" },
  { classname: "tests/shipping.spec.ts", name: "quotes the domestic zone" },
  { classname: "tests/checkout.spec.ts", name: "accepts the visa test token" },
  { classname: "tests/checkout.spec.ts", name: "rejects an expired card" },
  { classname: "tests/account.spec.ts", name: "updates the display name" },
  { classname: "tests/search.spec.ts", name: "returns an exact sku match" },
  { classname: "tests/orders.spec.ts", name: "lists newest orders first" },
  { classname: "tests/wishlist.spec.ts", name: "saves a sku for later" },
  { classname: "tests/nav.spec.ts", name: "renders the seasonal promo bar" },
] as const;

export type FailureClusterKey = "timeout" | "detached" | "promo";

export const CLUSTER_MESSAGES: Record<FailureClusterKey, string> = {
  timeout: "Timeout exceeded while waiting for element to become visible",
  detached: "Expected node to stay attached during assertion",
  promo: "Promo code stacking rejected: GOLD cannot combine with WELCOME",
};

export function testId(classname: string, name: string): string {
  const suite = classname.trim();
  const testName = name.trim();
  return suite ? `${suite} > ${testName}` : testName;
}

export const REGRESSION_TEST_ID = testId(REGRESSION_TEST.classname, REGRESSION_TEST.name);
export const FLAKY_TEST_IDS = FLAKY_TESTS.map((test) => testId(test.classname, test.name));

export type AttemptStatus = "pass" | "fail";

export type PlannedAttempt = {
  status: AttemptStatus;
  retry: number;
  cluster: FailureClusterKey | null;
};

export type PlannedRun = {
  number: number;
  sha: string;
  runId: string;
  timestamp: string;
  filename: string;
};

export type DemoTestDef = {
  key: string;
  classname: string;
  name: string;
  kind: "flaky" | "regression" | "stable";
};

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexFromRng(rng: () => number, length: number): string {
  let out = "";
  while (out.length < length) {
    out += Math.floor(rng() * 0x100000000)
      .toString(16)
      .padStart(8, "0");
  }
  return out.slice(0, length);
}

export function demoRuns(): PlannedRun[] {
  const rng = mulberry32(DEMO_SEED);
  const runs: PlannedRun[] = [];
  let sharedSha = "";
  for (let number = 1; number <= DEMO_RUN_COUNT; number += 1) {
    let sha = hexFromRng(rng, 40);
    // Runs 9 and 10 are a rerun of one commit so same-commit flips are observable.
    if (number === 9) sharedSha = sha;
    if (number === 10) sha = sharedSha;
    const timestamp = new Date(Date.UTC(2026, 3, 1, 9, 0, 0) + (number - 1) * 8 * 60 * 60 * 1000).toISOString();
    runs.push({
      number,
      sha,
      runId: `mg-${1000 + number}`,
      timestamp,
      filename: `marigold-run-${String(number).padStart(2, "0")}-${sha.slice(0, 7)}.xml`,
    });
  }
  return runs;
}

export function demoTests(): DemoTestDef[] {
  return [
    ...STABLE_TESTS.map((test, index) => ({
      key: `stable-${index}`,
      classname: test.classname,
      name: test.name,
      kind: "stable" as const,
    })),
    ...FLAKY_TESTS.map((test) => ({
      key: test.key,
      classname: test.classname,
      name: test.name,
      kind: "flaky" as const,
    })),
    {
      key: "regression",
      classname: REGRESSION_TEST.classname,
      name: REGRESSION_TEST.name,
      kind: "regression" as const,
    },
  ];
}

const TAX_RETRY_RUNS = new Set([4, 11, 19, 27]);
const SEARCH_FAIL_RUNS = new Set([3, 8, 14, 22, 29]);
const INVENTORY_FAIL_RUNS = new Set([6, 13, 21, 28]);
const SESSION_RETRY_RUNS = new Set([5, 15, 25]);

export function attemptsForTest(testKey: string, runNumber: number): PlannedAttempt[] {
  if (testKey === "regression") {
    if (runNumber >= REGRESSION_INTRODUCED_AT_RUN) {
      return [{ status: "fail", retry: 0, cluster: "promo" }];
    }
    return [{ status: "pass", retry: 0, cluster: null }];
  }
  if (testKey === "tax") {
    if (TAX_RETRY_RUNS.has(runNumber)) {
      return [
        { status: "fail", retry: 0, cluster: "detached" },
        { status: "pass", retry: 1, cluster: null },
      ];
    }
    return [{ status: "pass", retry: 0, cluster: null }];
  }
  if (testKey === "search") {
    if (SEARCH_FAIL_RUNS.has(runNumber)) {
      return [{ status: "fail", retry: 0, cluster: "timeout" }];
    }
    return [{ status: "pass", retry: 0, cluster: null }];
  }
  if (testKey === "inventory") {
    if (INVENTORY_FAIL_RUNS.has(runNumber)) {
      return [{ status: "fail", retry: 0, cluster: "timeout" }];
    }
    return [{ status: "pass", retry: 0, cluster: null }];
  }
  if (testKey === "session") {
    if (SESSION_RETRY_RUNS.has(runNumber)) {
      return [
        { status: "fail", retry: 0, cluster: "detached" },
        { status: "pass", retry: 1, cluster: null },
      ];
    }
    return [{ status: "pass", retry: 0, cluster: null }];
  }
  if (testKey === "cart") {
    if (runNumber === 9 || runNumber === 16) {
      return [{ status: "fail", retry: 0, cluster: "detached" }];
    }
    if (runNumber === 24) {
      return [
        { status: "fail", retry: 0, cluster: "detached" },
        { status: "pass", retry: 1, cluster: null },
      ];
    }
    return [{ status: "pass", retry: 0, cluster: null }];
  }
  return [{ status: "pass", retry: 0, cluster: null }];
}
