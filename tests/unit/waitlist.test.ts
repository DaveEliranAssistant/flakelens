import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { redactConnectionStrings, runVercelBuild } from "../../scripts/vercel-build-lib.mjs";
import { databaseUrl, handleWaitlistPost, type WaitlistDeps, type WaitlistRow } from "@/lib/waitlist/handle";
import { WAITLIST_SUCCESS, WAITLIST_UNAVAILABLE } from "@/lib/waitlist/messages";
import { createRateLimiter } from "@/lib/waitlist/rate-limit";
import { normalizeEmail, validateWaitlistInput } from "@/lib/waitlist/validate";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const signup = { email: "person@example.com", consent: true };

async function post(body: unknown, deps: Partial<WaitlistDeps> = {}, headers?: Record<string, string>) {
  const inserted: WaitlistRow[] = [];
  const request = new Request("https://flakelens.vercel.app/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const response = await handleWaitlistPost(request, {
    databaseConfigured: true,
    insert: async (row) => {
      inserted.push(row);
    },
    takeToken: () => ({ allowed: true }),
    ...deps,
  });
  return { status: response.status, body: await response.json(), inserted };
}

describe("waitlist validation", () => {
  it("normalizes email case and surrounding space", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
  });

  it("rejects missing consent and an invalid email", () => {
    const result = validateWaitlistInput({ email: "not-an-email", consent: false });
    expect(result).toEqual({
      ok: false,
      fields: {
        email: "Enter a valid email address.",
        consent: "Consent is required to join the waitlist.",
      },
    });
  });

  it("rejects an email with a control character instead of failing at the insert", () => {
    expect(validateWaitlistInput({ email: "a\u0000b@example.com", consent: true }).ok).toBe(false);
  });
});

describe("waitlist POST", () => {
  it("inserts only after consent", async () => {
    const refused = await post({ email: "person@example.com", consent: false });
    expect(refused.status).toBe(400);
    expect(refused.inserted).toEqual([]);

    const stringConsent = await post({ email: "person@example.com", consent: "true" });
    expect(stringConsent.status).toBe(400);
    expect(stringConsent.inserted).toEqual([]);

    const accepted = await post({ email: " Person@Example.com ", consent: true });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ ok: true, message: WAITLIST_SUCCESS });
    expect(accepted.inserted).toHaveLength(1);
    expect(accepted.inserted[0]?.email).toBe("person@example.com");
    expect(accepted.inserted[0]?.source).toBe("landing");
  });

  it("does not insert a honeypot submission and still returns success", async () => {
    const result = await post({ ...signup, company_website: "https://spam.example" });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, message: WAITLIST_SUCCESS });
    expect(result.inserted).toEqual([]);
  });

  it("returns 503 without leaking detail when the database is missing or the insert fails", async () => {
    const missing = await post(signup, { databaseConfigured: false });
    expect(missing.status).toBe(503);
    expect(missing.body).toEqual({ ok: false, message: WAITLIST_UNAVAILABLE });
    expect(missing.inserted).toEqual([]);

    const failed = await post(signup, {
      insert: async () => {
        throw new Error("connection refused");
      },
    });
    expect(failed.status).toBe(503);
    expect(failed.body).toEqual(missing.body);
  });

  it("hashes the user agent and keeps the address off the row", async () => {
    const result = await post(signup, {}, { "user-agent": "Mozilla/5.0", "x-forwarded-for": "203.0.113.8, 10.0.0.1" });
    const row = result.inserted[0];
    expect(row?.userAgentHash).toBe(createHash("sha256").update("Mozilla/5.0").digest("hex"));
    expect(JSON.stringify(row)).not.toContain("203.0.113.8");
    expect(JSON.stringify(row)).not.toContain("Mozilla");
  });

  it("rate limits by a hash of the address and allows the request if the limiter throws", async () => {
    const seen: string[] = [];
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
    const takeToken: WaitlistDeps["takeToken"] = (key, now) => {
      seen.push(key);
      return limiter(key, now);
    };
    const headers = { "x-forwarded-for": "203.0.113.9" };
    expect((await post(signup, { takeToken, now: () => 1_000 }, headers)).status).toBe(200);
    expect((await post(signup, { takeToken, now: () => 1_100 }, headers)).status).toBe(200);
    expect((await post(signup, { takeToken, now: () => 1_200 }, headers)).status).toBe(429);
    expect((await post(signup, { takeToken, now: () => 2_100 }, headers)).status).toBe(200);
    expect(seen.join()).not.toContain("203.0.113.9");

    const degraded = await post(signup, {
      takeToken: () => {
        throw new Error("limiter down");
      },
    });
    expect(degraded.status).toBe(200);
  });

  it("rejects an oversized body and invalid JSON", async () => {
    expect((await post(`{"email":"${"a".repeat(5_000)}@example.com"}`)).status).toBe(413);
    const invalid = await post("{");
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toContain("JSON");
  });
});

describe("waitlist database setup", () => {
  it("prefers DATABASE_URL_POOLED and treats a blank value as missing", () => {
    const { DATABASE_URL_POOLED: pooled, DATABASE_URL: direct } = process.env;
    try {
      process.env.DATABASE_URL_POOLED = " postgres://pooled ";
      process.env.DATABASE_URL = "postgres://direct";
      expect(databaseUrl()).toBe("postgres://pooled");
      process.env.DATABASE_URL_POOLED = "   ";
      expect(databaseUrl()).toBe("postgres://direct");
      delete process.env.DATABASE_URL_POOLED;
      delete process.env.DATABASE_URL;
      expect(databaseUrl()).toBeNull();
    } finally {
      if (pooled === undefined) delete process.env.DATABASE_URL_POOLED;
      else process.env.DATABASE_URL_POOLED = pooled;
      if (direct === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = direct;
    }
  });

  it("keeps the migration idempotent, free of IP columns, and refuses to run without a URL", () => {
    const sql = readFileSync(new URL("../../sql/waitlist.sql", import.meta.url), "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS waitlist_signups");
    expect(sql).toContain("email text NOT NULL UNIQUE");
    expect(sql.toLowerCase()).not.toContain("drop table");
    expect(sql).not.toMatch(/\b(ip_address|client_ip|remote_addr)\b/i);

    const result = spawnSync(process.execPath, ["scripts/migrate-waitlist.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "", DATABASE_URL_POOLED: "" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL_POOLED");
  });

  it("skips the migration without a URL and still builds", async () => {
    let migrated = false;
    const code = await runVercelBuild({
      env: { DATABASE_URL_POOLED: "   ", DATABASE_URL: "" },
      migrate: async () => {
        migrated = true;
        return { ok: true };
      },
      build: async () => 0,
      log: () => undefined,
    });
    expect(code).toBe(0);
    expect(migrated).toBe(false);
  });

  it("stops the build when the migration fails and does not print the connection string", async () => {
    const secret = "postgres://user:super-secret-password@db.example.com:5432/flakelens";
    let built = false;
    const errors: string[] = [];
    const code = await runVercelBuild({
      env: { DATABASE_URL_POOLED: secret },
      migrate: async () => ({ ok: false, message: `connect ECONNREFUSED ${secret}` }),
      build: async () => {
        built = true;
        return 0;
      },
      error: (line) => errors.push(line),
    });
    expect(code).toBe(1);
    expect(built).toBe(false);
    expect(errors.join("\n")).toContain("The build was stopped");
    expect(errors.join("\n")).not.toContain("super-secret-password");
    expect(redactConnectionStrings(`password=${secret}`, [secret])).not.toContain("postgres://");
  });
});
