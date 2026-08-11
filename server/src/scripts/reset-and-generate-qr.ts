import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { generatePublicToken } from '../lib/codes.js';

// Wipes all placed blocks and QR codes, resets every building back to
// completed_blocks = 0 / status = 'queued' (with the first-by-order_index
// building per category flipped back to 'in_progress'), then generates a
// fresh batch of QR codes for specific categories.
//
// Usage: pnpm run reset-and-generate-qr -- residential:1080 hospital:4000

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Category = 'residential' | 'hospital' | 'food' | 'school';
const CATEGORIES: Category[] = ['residential', 'hospital', 'food', 'school'];

function parseArgs(argv: string[]): Array<{ category: Category; count: number }> {
  if (argv.length === 0) {
    throw new Error('Usage: reset-and-generate-qr <category:count> [category:count ...]');
  }
  return argv.map((arg) => {
    const [category, countStr] = arg.split(':');
    if (!CATEGORIES.includes(category as Category)) {
      throw new Error(`Unknown category "${category}" — expected one of ${CATEGORIES.join(', ')}`);
    }
    const count = Number(countStr);
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(`Invalid count "${countStr}" for category "${category}"`);
    }
    return { category: category as Category, count };
  });
}

async function main() {
  const batches = parseArgs(process.argv.slice(2));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Wiping blocks, desktop_codes, qr_codes...');
    await client.query('DELETE FROM blocks');
    await client.query('DELETE FROM desktop_codes');
    await client.query('DELETE FROM qr_codes');

    console.log('Resetting all buildings to completed_blocks = 0, status = queued...');
    await client.query(`UPDATE buildings SET completed_blocks = 0, status = 'queued'`);

    for (const category of CATEGORIES) {
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
        [category],
      );
    }

    const exportRows: Array<{ token: string; category: Category }> = [];
    for (const { category, count } of batches) {
      const tokens = Array.from({ length: count }, () => generatePublicToken());
      await client.query(
        `INSERT INTO qr_codes (public_token, category)
         SELECT * FROM unnest($1::text[], $2::building_category[])`,
        [tokens, Array(count).fill(category)],
      );
      for (const token of tokens) exportRows.push({ token, category });
      console.log(`Generated ${count} "${category}" QR codes.`);
    }

    await client.query('COMMIT');

    const outDir = path.join(__dirname, '..', '..', 'qr-exports');
    await mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `qr-codes-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
    const csv = ['category,public_token,scan_path']
      .concat(exportRows.map((r) => `${r.category},${r.token},/s/${r.token}`))
      .join('\n');
    await writeFile(outFile, csv, 'utf8');
    console.log(`Wrote ${exportRows.length} tokens to ${outFile}`);
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
