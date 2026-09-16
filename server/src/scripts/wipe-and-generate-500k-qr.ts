import { pool } from '../db.js';
import { generatePublicToken } from '../lib/codes.js';

// One-off: wipe all placed-block/code data and mint a fresh full-scale batch
// of QR codes (500,000 — one per real block across the whole city, 125,000
// per category to match TOTAL_BLOCKS_TARGET/CATEGORY_BLOCKS_TARGET in
// Kiosk.tsx). Scope is deliberately narrow per user request:
//   - blocks, desktop_codes, qr_codes: wiped completely
//   - buildings: ONLY completed_blocks resets to 0 — status is left alone.
//     Safe as of 2026-09-16 because no building was ever 'completed' (only
//     4 'in_progress' + 156 'queued' existed), so every building lands in a
//     normal, valid state (in_progress-at-0 or queued-at-0) without needing
//     to touch status at all.
//   - No PNGs, no CSV export — just the DB rows. Image generation is a
//     separate later step (see generate-qr-images.ts).
//
// Usage: pnpm --filter server exec tsx src/scripts/wipe-and-generate-500k-qr.ts

const CATEGORIES = ['residential', 'hospital', 'food', 'school'] as const;
const TOTAL_QR_CODES = 500_000;
const PER_CATEGORY = TOTAL_QR_CODES / CATEGORIES.length;

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Wiping blocks, desktop_codes, qr_codes...');
    await client.query('DELETE FROM blocks');
    await client.query('DELETE FROM desktop_codes');
    await client.query('DELETE FROM qr_codes');

    console.log('Resetting buildings.completed_blocks to 0 (status untouched)...');
    await client.query(`UPDATE buildings SET completed_blocks = 0`);

    for (const category of CATEGORIES) {
      console.log(`Generating ${PER_CATEGORY} "${category}" QR codes...`);
      const tokens = Array.from({ length: PER_CATEGORY }, () => generatePublicToken());
      await client.query(
        `INSERT INTO qr_codes (public_token, category)
         SELECT * FROM unnest($1::text[], $2::building_category[])`,
        [tokens, Array(PER_CATEGORY).fill(category)],
      );
    }

    await client.query('COMMIT');
    console.log(`Done — ${TOTAL_QR_CODES} QR codes ready in the db (${PER_CATEGORY} per category).`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
