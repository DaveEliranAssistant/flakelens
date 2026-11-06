import { Client } from "pg";
import { databaseUrl, type WaitlistRow } from "@/lib/waitlist/handle";

export async function insertWaitlistSignup(row: WaitlistRow): Promise<void> {
  const url = databaseUrl();
  if (!url) throw new Error("Waitlist database is not configured.");
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5_000 });
  try {
    await client.connect();
    await client.query(
      `INSERT INTO waitlist_signups (email, consent, source, user_agent_hash)
       VALUES ($1, true, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [row.email, row.source, row.userAgentHash],
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
