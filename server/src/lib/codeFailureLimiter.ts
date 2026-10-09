import type { RequestHandler } from 'express';

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = Number(process.env.CODE_FAILURE_LIMIT ?? 200);
const failures = new Map<string, { count: number; resetAt: number }>();
setInterval(() => { const now = Date.now(); for (const [k, v] of failures) if (v.resetAt <= now) failures.delete(k); }, 60_000).unref();

// Blocks an IP only after MAX_FAILURES wrong/expired codes. Valid entries, double clicks,
// "already placed" and requests still in flight never count, so a school behind one IP isn't locked out.
export const codeFailureLimiter: RequestHandler = (req, res, next) => {
  const key = req.ip ?? 'unknown';
  const f = failures.get(key);
  if (f && f.resetAt > Date.now() && f.count >= MAX_FAILURES) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }
  res.on('finish', () => {
    if (!res.locals.codeFailure) return;
    const now = Date.now();
    const cur = failures.get(key);
    if (!cur || cur.resetAt <= now) failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
    else cur.count++;
  });
  next();
};
