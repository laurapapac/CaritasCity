import { Router } from 'express';
import { pool } from '../db.js';

export const statsRouter = Router();

// Powers the kiosk's stats panel. Block counts overall/per-category already
// come from GET /buildings (completed_blocks is aggregated there) — this
// exists only for the one number that isn't: how many blocks real schools
// have placed. "Vanjske donacije" is a schools-table row for external
// (non-school) donations, not a real school, so it's excluded here.
statsRouter.get('/stats', async (_req, res) => {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM blocks b
     JOIN schools s ON s.id = b.school_id
     WHERE s.name <> 'Vanjske donacije'`,
  );
  res.json({ schoolBlocksPlaced: Number(result.rows[0].count) });
});
