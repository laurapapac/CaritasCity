import { pool } from '../db.js';

// Resets the city to a fresh start: wipes every placed block and desktop
// code, resets every building back to completed_blocks = 0 / status =
// 'queued' (with the first-by-order_index building per category flipped
// back to 'in_progress'), and removes the dev-only placeholder school.
//
// Deliberately leaves `qr_codes` untouched — those tokens are already
// printed onto real physical QR stickers, so they must keep working.
// Also leaves every real (non-placeholder) row in `schools` untouched.
//
// Usage: pnpm exec tsx src/scripts/reset-city.ts

type Category = 'residential' | 'hospital' | 'food' | 'school';
const CATEGORIES: Category[] = ['residential', 'hospital', 'food', 'school'];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Wiping blocks and desktop_codes...');
    await client.query('DELETE FROM blocks');
    await client.query('DELETE FROM desktop_codes');

    console.log('Resetting all buildings to completed_blocks = 0, status = queued...');
    await client.query(`UPDATE buildings SET completed_blocks = 0, status = 'queued'`);

    for (const category of CATEGORIES) {
      await client.query(
        `UPDATE buildings SET status = 'in_progress'
         WHERE id = (
           SELECT id FROM buildings
           WHERE category = $1 AND status = 'queued'
           ORDER BY order_index ASC, id ASC
           LIMIT 1
         )`,
        [category],
      );
    }

    console.log('Removing the "Dev Test School" placeholder...');
    const { rowCount } = await client.query(`DELETE FROM schools WHERE name = 'Dev Test School'`);
    console.log(`  removed ${rowCount} row(s)`);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('City reset. qr_codes and the real school list were left untouched.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
