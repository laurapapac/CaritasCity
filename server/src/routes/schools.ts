import { Router } from 'express';
import { pool } from '../db.js';

export const schoolsRouter = Router();

// Populates the kiosk's school picker. City is included alongside name
// because several schools across different cities share the same name
// (e.g. multiple "Osnovna škola Vladimir Nazor") — the picker needs it to
// disambiguate them.
schoolsRouter.get('/schools', async (_req, res) => {
  const result = await pool.query<{ id: number; name: string; city: string | null }>(
    `SELECT id, name, city FROM schools ORDER BY name, city`,
  );
  res.json(result.rows);
});
