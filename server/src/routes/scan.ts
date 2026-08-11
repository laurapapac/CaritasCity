import { Router } from 'express';
import { pool } from '../db.js';
import { config } from '../config.js';
import { generateDesktopCode } from '../lib/codes.js';

export const scanRouter = Router();

// Phone hits this after scanning the physical QR code. Mints a short code for
// the user to type into the shared desktop kiosk; nothing else about the QR
// (its category, internal id, etc.) goes back to the phone.
scanRouter.post('/scan/:publicToken', async (req, res) => {
  const { publicToken } = req.params;

  const qrResult = await pool.query<{ id: string }>(
    `SELECT id FROM qr_codes WHERE public_token = $1`,
    [publicToken],
  );
  const qr = qrResult.rows[0];
  if (!qr) {
    res.status(404).json({ error: 'unknown_qr_code' });
    return;
  }

  const expiresAt = new Date(Date.now() + config.desktopCodeTtlMinutes * 60_000);

  // Codes are only unique while unused (see desktop_codes_active_code_uq); collisions
  // against a still-live code are astronomically unlikely at this alphabet/length, but
  // retry a couple of times rather than 500ing the phone if it ever happens.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateDesktopCode(config.desktopCodeLength);
    try {
      await pool.query(
        `INSERT INTO desktop_codes (code, qr_id, expires_at) VALUES ($1, $2, $3)`,
        [code, qr.id, expiresAt],
      );
      res.status(201).json({ code, expiresAt });
      return;
    } catch (err: any) {
      if (err.code === '23505') continue; // unique_violation on the active-code index
      throw err;
    }
  }

  res.status(503).json({ error: 'could_not_allocate_code_try_again' });
});
