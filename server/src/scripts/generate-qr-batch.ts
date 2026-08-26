import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { generatePublicToken } from '../lib/codes.js';

// Mints a fresh batch of QR codes WITHOUT touching blocks/buildings/existing
// qr_codes — unlike reset-and-generate-qr.ts, which wipes all placement
// progress first. Use this when the existing QR images have just gone stale
// (e.g. after a dev DB reset invalidated their tokens) and you want new,
// scannable codes without resetting the city.
//
// Usage: pnpm exec tsx src/scripts/generate-qr-batch.ts <category:count> [category:count ...]
//   e.g. pnpm exec tsx src/scripts/generate-qr-batch.ts residential:20 hospital:20 food:20 school:20

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Category = 'residential' | 'hospital' | 'food' | 'school';
const CATEGORIES: Category[] = ['residential', 'hospital', 'food', 'school'];

function parseArgs(argv: string[]): Array<{ category: Category; count: number }> {
  if (argv.length === 0) {
    throw new Error('Usage: generate-qr-batch <category:count> [category:count ...]');
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

  const exportRows: Array<{ token: string; category: Category }> = [];
  for (const { category, count } of batches) {
    const tokens = Array.from({ length: count }, () => generatePublicToken());
    await pool.query(
      `INSERT INTO qr_codes (public_token, category)
       SELECT * FROM unnest($1::text[], $2::building_category[])`,
      [tokens, Array(count).fill(category)],
    );
    for (const token of tokens) exportRows.push({ token, category });
    console.log(`Minted ${count} "${category}" QR codes.`);
  }

  const outDir = path.join(__dirname, '..', '..', 'qr-exports');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `qr-codes-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
  const csv = ['category,public_token,scan_path']
    .concat(exportRows.map((r) => `${r.category},${r.token},/s/${r.token}`))
    .join('\n');
  await writeFile(outFile, csv, 'utf8');
  console.log(`Wrote ${exportRows.length} tokens to ${outFile}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
