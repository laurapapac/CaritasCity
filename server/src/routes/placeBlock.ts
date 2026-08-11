import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { findLiveDesktopCode } from '../lib/desktopCode.js';

export const placeBlockRouter = Router();

const placeBlockLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const placeBlockBody = z.object({
  code: z.string().min(1),
  schoolId: z.number().int().positive(),
});

placeBlockRouter.post('/place-block', placeBlockLimiter, async (req, res) => {
  const parsed = placeBlockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }
  const code = parsed.data.code.trim().toUpperCase();
  const { schoolId } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const desktopCode = await findLiveDesktopCode(code, client);
    if (!desktopCode) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'invalid_or_expired_code' });
      return;
    }

    const qrResult = await client.query<{ category: string }>(
      `SELECT category FROM qr_codes WHERE id = $1`,
      [desktopCode.qr_id],
    );
    const qr = qrResult.rows[0];
    if (!qr) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'qr_not_found_for_code' });
      return;
    }

    const schoolResult = await client.query(`SELECT id FROM schools WHERE id = $1`, [schoolId]);
    if (schoolResult.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'unknown_school' });
      return;
    }

    // Serializes concurrent placements within the same category on this row lock.
    const buildingResult = await client.query<{
      id: string;
      variant: string;
      total_blocks: number;
      completed_blocks: number;
    }>(
      `SELECT id, variant, total_blocks, completed_blocks FROM buildings
       WHERE category = $1 AND status = 'in_progress'
       FOR UPDATE`,
      [qr.category],
    );
    const building = buildingResult.rows[0];
    if (!building) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'category_complete' });
      return;
    }

    const blockIndex = building.completed_blocks;

    let blockInsert;
    try {
      blockInsert = await client.query(
        `INSERT INTO blocks (building_id, block_index, qr_id, school_id)
         VALUES ($1, $2, $3, $4)
         RETURNING block_index, placed_at`,
        [building.id, blockIndex, desktopCode.qr_id, schoolId],
      );
    } catch (err: any) {
      if (err.code === '23505') {
        // Someone already placed a block for this qr_id (e.g. a retried request).
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'block_already_placed' });
        return;
      }
      throw err;
    }

    const newCompletedBlocks = building.completed_blocks + 1;
    const justCompleted = newCompletedBlocks >= building.total_blocks;

    await client.query(
      `UPDATE buildings SET completed_blocks = $1, status = $2 WHERE id = $3`,
      [newCompletedBlocks, justCompleted ? 'completed' : 'in_progress', building.id],
    );

    if (justCompleted) {
      // order_index resets to 0 for every variant within a category (see seed.ts),
      // so it alone doesn't disambiguate — id ASC breaks the tie in insertion order.
      await client.query(
        `UPDATE buildings SET status = 'in_progress'
         WHERE id = (
           SELECT id FROM buildings
           WHERE category = $1 AND status = 'queued'
           ORDER BY order_index ASC, id ASC
           LIMIT 1
         )`,
        [qr.category],
      );
    }

    await client.query(`UPDATE desktop_codes SET used_at = now() WHERE id = $1`, [
      desktopCode.id,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      status: 'placed',
      block: {
        buildingId: building.id,
        buildingVariant: building.variant,
        blockIndex: blockInsert.rows[0].block_index,
        schoolId,
        placedAt: blockInsert.rows[0].placed_at,
        totalBlocks: building.total_blocks,
        completedBlocks: newCompletedBlocks,
        category: qr.category,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
