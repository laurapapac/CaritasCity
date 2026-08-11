import { Router } from 'express';
import { pool } from '../db.js';

export const schoolsRouter = Router();

// Populates the kiosk's school picker.
schoolsRouter.get('/schools', async (_req, res) => {
  const result = await pool.query<{ id: number; name: string }>(
    `SELECT id, name FROM schools ORDER BY name`,
  );
  res.json(result.rows);
});
