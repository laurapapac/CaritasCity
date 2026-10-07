import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // Postgres allows 100 connections by default; leave headroom for psql,
  // migrations and scripts.
  max: config.dbPoolMax,
  // When every connection is busy, fail after this long (the client shows
  // "try again") instead of leaving the request hanging indefinitely.
  connectionTimeoutMillis: 5_000,
  // No single query may hold a connection longer than this.
  statement_timeout: 10_000,
});

// An idle client losing its connection (e.g. Postgres restarting) emits
// 'error' on the pool; without a listener that crashes the process.
pool.on('error', (err) => {
  console.error('idle pg client error', err);
});
