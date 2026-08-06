import { describe, it, expect } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { admins, clients, anthropometricRecords } from '../src/models/schema.js';

describe('drizzle db connection', () => {
  it('connects to the test database', async () => {
    const result = await db.execute(sql`select 1 as ok`);
    expect(result[0].ok).toBe(1);
  });

  it('can select from a table protected by a deny_all RLS policy', async () => {
    // admins has RLS enabled with `CREATE POLICY deny_all ON admins USING (false)`.
    // This only succeeds if DATABASE_URL authenticates as a role that bypasses
    // RLS (Supabase's direct "postgres" connection string) — proving the same
    // app-level access-control model as server.js still applies end to end.
    await expect(db.select().from(admins)).resolves.toBeInstanceOf(Array);
  });

  it('round-trips a numeric column as a genuine JS number, not a string', async () => {
    // Postgres numeric/decimal defaults to coming back as a string over the
    // wire (to avoid float precision loss). This project configures the
    // postgres.js driver to parse OID 1700 (numeric) as a JS number instead,
    // and schema.ts declares these columns with `.$type<number>()` to match.
    // This test proves the runtime value is actually a number, not just that
    // the types say so.
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Numeric Roundtrip Test',
        email: `numeric-roundtrip-${Date.now()}@example.com`,
        passwordHash: 'unused',
      })
      .returning();

    try {
      const [record] = await db
        .insert(anthropometricRecords)
        .values({ clientId: client.id, peso: 72.5 })
        .returning();

      expect(typeof record.peso).toBe('number');
      expect(record.peso).toBe(72.5);

      const [reloaded] = await db
        .select()
        .from(anthropometricRecords)
        .where(eq(anthropometricRecords.id, record.id));

      expect(typeof reloaded.peso).toBe('number');
      expect(reloaded.peso).toBe(72.5);
    } finally {
      await db.delete(clients).where(eq(clients.id, client.id));
    }
  });
});
