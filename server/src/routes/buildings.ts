import { Router } from 'express';
import { pool } from '../db.js';

export const buildingsRouter = Router();

// Powers the kiosk's live 3D city — ALL 160 buildings (2026-08-13, widened
// from "just the in_progress one per category" so the kiosk can render the
// full static city layout with real per-building progress, matching
// /dev/city). Position never lived here and still doesn't — the frontend
// joins these rows against src/data/cityLayout.ts client-side, keyed by
// `${variant}_${orderIndex}`, which generateCityLayout.ts's buildingId
// (`${variant}_${i}`) was already designed to match (see its doc comment).
buildingsRouter.get('/buildings', async (_req, res) => {
  const result = await pool.query<{
    id: string;
    category: string;
    variant: string;
    order_index: number;
    total_blocks: number;
    completed_blocks: number;
    status: string;
  }>(`SELECT id, category, variant, order_index, total_blocks, completed_blocks, status FROM buildings`);

  res.json(
    result.rows.map((r) => ({
      id: r.id,
      category: r.category,
      variant: r.variant,
      orderIndex: r.order_index,
      totalBlocks: r.total_blocks,
      completedBlocks: r.completed_blocks,
      status: r.status,
    })),
  );
});
