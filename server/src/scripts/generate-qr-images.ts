import { mkdir, readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

// Turns a qr-exports CSV (from reset-and-generate-qr.ts) into scannable PNG
// QR code images, one per code, grouped into per-category folders.
//
// Usage: pnpm exec tsx src/scripts/generate-qr-images.ts [csvPath] [baseUrl]
//   csvPath defaults to the most recently generated qr-codes-*.csv
//   baseUrl defaults to $QR_BASE_URL or http://localhost:5173 — this must be
//   an address a phone camera can actually reach, so swap it for the real
//   deployed origin once this isn't just local dev.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportsDir = path.join(__dirname, '..', '..', 'qr-exports');

async function latestCsv(): Promise<string> {
  const files = (await readdir(exportsDir)).filter(
    (f) => f.startsWith('qr-codes-') && f.endsWith('.csv'),
  );
  if (files.length === 0) {
    throw new Error(`No qr-codes-*.csv files found in ${exportsDir}`);
  }
  files.sort();
  return path.join(exportsDir, files[files.length - 1]);
}

function parseCsv(text: string): Array<{ category: string; token: string; scanPath: string }> {
  const [, ...lines] = text.trim().split('\n'); // drop header row
  return lines.map((line) => {
    const [category, token, scanPath] = line.split(',');
    return { category, token, scanPath };
  });
}

async function main() {
  const csvPath = process.argv[2] || (await latestCsv());
  const baseUrl = process.argv[3] || process.env.QR_BASE_URL || 'http://localhost:5173';

  const rows = parseCsv(await readFile(csvPath, 'utf8'));
  console.log(`Read ${rows.length} codes from ${csvPath}`);
  console.log(`Encoding URLs against base: ${baseUrl}`);

  const stem = path.basename(csvPath, '.csv');
  const outDir = path.join(exportsDir, 'images', stem);

  const counts: Record<string, number> = {};
  for (const { category, token, scanPath } of rows) {
    const categoryDir = path.join(outDir, category);
    await mkdir(categoryDir, { recursive: true });
    const url = `${baseUrl}${scanPath}`;
    await QRCode.toFile(path.join(categoryDir, `${token}.png`), url, {
      width: 400,
      margin: 2,
    });
    counts[category] = (counts[category] ?? 0) + 1;
  }

  console.log(`Wrote images to ${outDir}`);
  for (const [category, count] of Object.entries(counts)) {
    console.log(`  ${category}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
