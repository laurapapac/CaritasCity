import { Router } from 'express';
import { pool } from '../db.js';

export const buildingsRouter = Router();

// Powers the kiosk's live 3D city — the currently in_progress building per
// category (at most 4 rows, guaranteed by buildings_one_active_per_category).
buildingsRouter.get('/buildings', async (_req, res) => {
  const result = await pool.query<{
    id: string;
    category: string;
    variant: string;
    total_blocks: number;
    completed_blocks: number;
  }>(`SELECT id, category, variant, total_blocks, completed_blocks FROM buildings WHERE status = 'in_progress'`);

  res.json(
    result.rows.map((r) => ({
      id: r.id,
      category: r.category,
      variant: r.variant,
      totalBlocks: r.total_blocks,
      completedBlocks: r.completed_blocks,
    })),
  );
});
