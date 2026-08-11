import type { PoolClient } from 'pg';
import { pool } from '../db.js';

export type DesktopCodeRow = {
  id: string;
  code: string;
  qr_id: string;
  expires_at: Date;
  used_at: Date | null;
};

export async function findLiveDesktopCode(
  code: string,
  client: PoolClient | typeof pool = pool,
): Promise<DesktopCodeRow | null> {
  const { rows } = await client.query<DesktopCodeRow>(
    `SELECT id, code, qr_id, expires_at, used_at FROM desktop_codes
     WHERE code = $1 AND used_at IS NULL AND expires_at > now()`,
    [code],
  );
  return rows[0] ?? null;
}
