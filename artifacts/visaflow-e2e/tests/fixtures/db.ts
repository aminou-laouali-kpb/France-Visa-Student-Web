import { Client } from "pg";
import { requireEnv } from "./env";

export async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

export async function getUserIdByEmail(
  db: Client,
  email: string,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );
  if (rows.length === 0) {
    throw new Error(`No users row for ${email}; run global.setup first.`);
  }
  return rows[0].id;
}
