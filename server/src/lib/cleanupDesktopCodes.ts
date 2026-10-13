import { pool } from '../db.js';

const CLEANUP_INTERVAL_MS = 60 * 60_000;
const BATCH_SIZE = 10_000;

// Desktop codes live for minutes, so anything expired over a day ago (used or
// not) is dead weight. Deleting it also releases the code value from
// desktop_codes_active_code_uq. Batched so a large backlog never trips the
// pool's statement_timeout.
export async function deleteExpiredDesktopCodes(): Promise<number> {
  let total = 0;
  for (;;) {
    const { rowCount } = await pool.query(
      `DELETE FROM desktop_codes WHERE id IN (
         SELECT id FROM desktop_codes
         WHERE expires_at < now() - interval '1 day'
         LIMIT $1
       )`,
      [BATCH_SIZE],
    );
    total += rowCount ?? 0;
    if ((rowCount ?? 0) < BATCH_SIZE) return total;
  }
}

export function startDesktopCodeCleanup(): void {
  const run = () => {
    deleteExpiredDesktopCodes()
      .then((n) => { if (n > 0) console.log(`deleted ${n} expired desktop codes`); })
      .catch((err) => console.error('desktop code cleanup failed', err));
  };
  run();
  setInterval(run, CLEANUP_INTERVAL_MS).unref();
}
