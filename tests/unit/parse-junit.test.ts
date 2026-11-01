import { describe, expect, it } from "vitest";
import { JUnitParseError, metadataFromFilename, parseJUnit } from "@/lib/parse-junit";

describe("parseJUnit", () => {
  it("reads Playwright properties, retries, and failure text", () => {
    const xml = `<?xml version="1.0"?>
      <testsuites>
        <testsuite name="checkout.spec.ts" timestamp="2026-04-01T09:00:00.000Z">
          <properties>
            <property name="commit" value="aaaabbbbccccddddeeeeffff0000111122223333"/>
            <property name="ci.run_id" value="mg-9"/>
          </properties>
          <testcase classname="tests/checkout.spec.ts" name="tax rounds" time="0.4">
            <properties><property name="retry" value="0"/></properties>
            <failure message="Expected node to stay attached during assertion" type="Error">Expected node to stay attached during assertion
    at /tmp/shop/checkout.spec.ts:12:4</failure>
          </testcase>
          <testcase classname="tests/checkout.spec.ts" name="tax rounds" time="0.2">
            <properties><property name="retry" value="1"/></properties>
          </testcase>
        </testsuite>
      </testsuites>`;
    const run = parseJUnit(xml, "ignored.xml", 3);
    expect(run.commit).toBe("aaaabbbbccccddddeeeeffff0000111122223333");
    expect(run.commitSource).toBe("file");
    expect(run.runId).toBe("mg-9");
    expect(run.timestamp).toBe("2026-04-01T09:00:00.000Z");
    expect(run.attempts.map((attempt) => [attempt.retryIndex, attempt.status, attempt.testId])).toEqual([
      [0, "fail", "tests/checkout.spec.ts > tax rounds"],
      [1, "pass", "tests/checkout.spec.ts > tax rounds"],
    ]);
    expect(run.attempts[0]?.message).toBe("Expected node to stay attached during assertion");
    expect(run.attempts[0]?.durationMs).toBe(400);
  });

  it("reads Jest failure bodies and the duration attribute", () => {
    const xml = `<testsuites name="jest tests">
      <testsuite name="tests/cart.spec.ts">
        <testcase classname="tests/cart.spec.ts" name="adds a line" duration="1.5">
          <failure>Expected 1 but got 2
    at tests/cart.spec.ts:10:2</failure>
        </testcase>
      </testsuite>
    </testsuites>`;
    const run = parseJUnit(xml, "jest.xml", 0);
    expect(run.attempts).toHaveLength(1);
    expect(run.attempts[0]).toMatchObject({
      status: "fail",
      durationMs: 1500,
      message: "Expected 1 but got 2",
      testId: "tests/cart.spec.ts > adds a line",
    });
  });

  it("treats pytest error elements as failures and keeps skips out of the failure path", () => {
    const xml = `<testsuite name="pytest" timestamp="2026-04-02T01:00:00.000Z">
      <testcase classname="tests.test_checkout" name="test_promo" time="0.05">
        <error message="Promo code stacking rejected">Promo code stacking rejected
tests/test_checkout.py:10: AssertionError</error>
      </testcase>
      <testcase classname="tests.test_checkout" name="test_later" time="0">
        <skipped message="not now"/>
      </testcase>
    </testsuite>`;
    const run = parseJUnit(xml, "pytest.xml", 1);
    expect(run.attempts.map((attempt) => attempt.status)).toEqual(["fail", "skip"]);
    expect(run.attempts[0]?.message).toBe("Promo code stacking rejected");
    expect(run.timestamp).toBe("2026-04-02T01:00:00.000Z");
  });

  it("falls back to the filename, and lets in-file properties win", () => {
    const filename = "results-commit-abc1234def-run-42-20260401T090000Z.xml";
    expect(metadataFromFilename(filename)).toEqual({
      commit: "abc1234def",
      runId: "42",
      timestamp: "2026-04-01T09:00:00Z",
    });
    const bare = `<testsuite name="t"><testcase classname="pkg" name="works" time="0.2"/></testsuite>`;
    const fromName = parseJUnit(bare, filename, 4);
    expect(fromName.commit).toBe("abc1234def");
    expect(fromName.runId).toBe("42");
    expect(fromName.timestamp).toBe("2026-04-01T09:00:00Z");
    expect(fromName.commitSource).toBe("filename");

    const overridden = `<testsuite name="t">
      <properties><property name="commit" value="bbbbbbbbbbbbbbb"/><property name="run_id" value="file-run"/></properties>
      <testcase classname="pkg" name="works" time="0.2"/>
    </testsuite>`;
    const fromFile = parseJUnit(overridden, filename, 4);
    expect(fromFile.commit).toBe("bbbbbbbbbbbbbbb");
    expect(fromFile.runId).toBe("file-run");
    expect(fromFile.commitSource).toBe("file");
    expect(fromFile.runIdSource).toBe("file");
  });

  it("assigns file order when the document and the filename have no metadata", () => {
    const xml = `<testsuite name="t"><testcase classname="pkg" name="works"/></testsuite>`;
    const run = parseJUnit(`\uFEFF${xml}`, "alpha.xml", 2);
    expect(run.commit).toBe("order-2");
    expect(run.runId).toBe("file-2");
    expect(run.timestamp).toBeNull();
    expect(run.commitSource).toBe("order");
    expect(run.warnings.length).toBeGreaterThan(0);
  });

  it("rejects documents that are not JUnit", () => {
    expect(() => parseJUnit("this is not xml", "bad.xml", 0)).toThrow(JUnitParseError);
    expect(() => parseJUnit("<testsuites></testsuites>", "empty.xml", 0)).toThrow(JUnitParseError);
    expect(() => parseJUnit("", "empty.xml", 0)).toThrow(JUnitParseError);
  });
});
