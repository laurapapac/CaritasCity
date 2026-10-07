import { Router } from 'express';
import { pool } from '../db.js';
import { asyncRoute } from '../lib/asyncRoute.js';

export const statsRouter = Router();

// Powers the kiosk's stats panel. Block counts overall/per-category already
// come from GET /buildings (completed_blocks is aggregated there) — this
// exists only for the one number that isn't: how many blocks real schools
// have placed. "Vanjske donacije" is a schools-table row for external
// (non-school) donations, not a real school, so it's excluded here.
//
// Every kiosk page load hits this, and the count scans the whole blocks table,
// so serve a cached value for a few seconds. Concurrent requests during a
// refresh share the same in-flight query.
const CACHE_MS = 5_000;
let cached: { value: number; at: number } | null = null;
let inFlight: Promise<number> | null = null;

async function countSchoolBlocks(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM blocks b
     JOIN schools s ON s.id = b.school_id
     WHERE s.name <> 'Vanjske donacije'`,
  );
  return Number(result.rows[0].count);
}

statsRouter.get('/stats', asyncRoute(async (_req, res) => {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    inFlight ??= countSchoolBlocks()
      .then((value) => {
        cached = { value, at: Date.now() };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
    await inFlight;
  }
  res.json({ schoolBlocksPlaced: cached!.value });
}));
