import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { findLiveDesktopCode } from '../lib/desktopCode.js';

export const enterRouter = Router();

const enterLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20, // per IP — codes are short, so brute-forcing must stay expensive
  standardHeaders: true,
  legacyHeaders: false,
});

const enterBody = z.object({ code: z.string().min(1) });

enterRouter.post('/enter', enterLimiter, async (req, res) => {
  const parsed = enterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }
  const code = parsed.data.code.trim().toUpperCase();

  const desktopCode = await findLiveDesktopCode(code);
  if (!desktopCode) {
    res.status(400).json({ error: 'invalid_or_expired_code' });
    return;
  }

  const qrResult = await pool.query<{ category: string }>(
    `SELECT category FROM qr_codes WHERE id = $1`,
    [desktopCode.qr_id],
  );
  const qr = qrResult.rows[0];
  if (!qr) {
    res.status(500).json({ error: 'qr_not_found_for_code' });
    return;
  }

  const blockResult = await pool.query(
    `SELECT b.block_index, b.placed_at, b.school_id, bd.variant AS building_variant,
            bd.id AS building_id, bd.total_blocks, bd.completed_blocks
     FROM blocks b JOIN buildings bd ON bd.id = b.building_id
     WHERE b.qr_id = $1`,
    [desktopCode.qr_id],
  );
  const existingBlock = blockResult.rows[0];

  if (existingBlock) {
    // View-only: this physical block was already placed. Nothing further to do, so
    // consume the code now.
    await pool.query(`UPDATE desktop_codes SET used_at = now() WHERE id = $1`, [desktopCode.id]);
    res.json({
      status: 'existing',
      block: {
        buildingId: existingBlock.building_id,
        buildingVariant: existingBlock.building_variant,
        blockIndex: existingBlock.block_index,
        schoolId: existingBlock.school_id,
        placedAt: existingBlock.placed_at,
        totalBlocks: existingBlock.total_blocks,
        completedBlocks: existingBlock.completed_blocks,
        category: qr.category,
      },
    });
    return;
  }

  // No block yet — the code stays unused so /place-block can redeem it once the
  // school picker has been completed.
  res.json({ status: 'needs_school', category: qr.category });
});
