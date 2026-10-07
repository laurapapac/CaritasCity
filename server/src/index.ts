import express from 'express';
import { config } from './config.js';
import { scanRouter } from './routes/scan.js';
import { enterRouter } from './routes/enter.js';
import { placeBlockRouter } from './routes/placeBlock.js';
import { schoolsRouter } from './routes/schools.js';
import { buildingsRouter } from './routes/buildings.js';
import { statsRouter } from './routes/stats.js';

const app = express();
// Exactly one reverse proxy (the host's nginx) sits in front of this server,
// so take the client IP from the last X-Forwarded-For hop. Without this every
// request appears to come from nginx and all users share one rate-limit bucket.
app.set('trust proxy', 1);
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api', scanRouter);
app.use('/api', enterRouter);
app.use('/api', placeBlockRouter);
app.use('/api', schoolsRouter);
app.use('/api', buildingsRouter);
app.use('/api', statsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(config.port, () => {
  console.log(`caritas-city-server listening on :${config.port}`);
});
