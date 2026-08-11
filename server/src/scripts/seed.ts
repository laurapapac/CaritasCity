import { pool } from '../db.js';
import { generatePublicToken } from '../lib/codes.js';

type BuildingSeed = {
  category: 'residential' | 'hospital' | 'food' | 'school';
  variant: string;
  count: number;
  blocksEach: number;
};

// From plans/qr-backend-todo.md — 158 buildings, 500,000 blocks total.
const BUILDINGS: BuildingSeed[] = [
  { category: 'residential', variant: 'house', count: 75, blocksEach: 1080 },
  { category: 'residential', variant: 'short_apartment', count: 23, blocksEach: 4000 },
  { category: 'residential', variant: 'tall_apartment', count: 12, blocksEach: 8000 },
  { category: 'food', variant: 'food_bank', count: 11, blocksEach: 4000 },
  { category: 'food', variant: 'restaurant', count: 14, blocksEach: 5000 },
  { category: 'school', variant: 'school', count: 13, blocksEach: 5000 },
  { category: 'hospital', variant: 'hospital_small', count: 5, blocksEach: 4000 },
  { category: 'hospital', variant: 'hospital_medium', count: 4, blocksEach: 6000 },
  { category: 'hospital', variant: 'hospital_large', count: 1, blocksEach: 8000 },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Buildings: order_index counts up within each category in the order listed above.
    // Sequencing rule is still TBD (see plans/qr-backend-todo.md) — this just gives every row
    // a stable, arbitrary index so `status` bootstrapping has something to sort by.
    for (const b of BUILDINGS) {
      for (let i = 0; i < b.count; i++) {
        await client.query(
          `INSERT INTO buildings (category, variant, order_index, total_blocks, status)
           VALUES ($1, $2, $3, $4, 'queued')`,
          [b.category, b.variant, i, b.blocksEach],
        );
      }
    }

    // Kick off one in_progress building per category so /place-block has somewhere to write.
    for (const category of ['residential', 'hospital', 'food', 'school'] as const) {
      // order_index resets to 0 for every variant within a category (see BUILDINGS
      // above), so it alone doesn't disambiguate — id ASC breaks the tie in insertion order.
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

    // One dev school for attribution testing.
    const schoolResult = await client.query<{ id: number }>(
      `INSERT INTO schools (name) VALUES ('Dev Test School') RETURNING id`,
    );
    console.log(`school: Dev Test School (id=${schoolResult.rows[0].id})`);

    // Five dev QR codes, one per category plus a spare residential one.
    const devCategories: Array<'residential' | 'hospital' | 'food' | 'school'> = [
      'residential',
      'hospital',
      'food',
      'school',
      'residential',
    ];
    for (const category of devCategories) {
      const token = generatePublicToken();
      await client.query(`INSERT INTO qr_codes (public_token, category) VALUES ($1, $2)`, [
        token,
        category,
      ]);
      console.log(`qr: ${category.padEnd(11)} /scan/${token}`);
    }

    await client.query('COMMIT');
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
