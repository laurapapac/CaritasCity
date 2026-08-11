import express from 'express';
import { config } from './config.js';
import { scanRouter } from './routes/scan.js';
import { enterRouter } from './routes/enter.js';
import { placeBlockRouter } from './routes/placeBlock.js';
import { schoolsRouter } from './routes/schools.js';
import { buildingsRouter } from './routes/buildings.js';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api', scanRouter);
app.use('/api', enterRouter);
app.use('/api', placeBlockRouter);
app.use('/api', schoolsRouter);
app.use('/api', buildingsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(config.port, () => {
  console.log(`caritas-city-server listening on :${config.port}`);
});
