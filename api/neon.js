// api/neon.js
// High-performance Vercel Serverless Function for Neon PostgreSQL
// Handles all CRUD operations, settings/configs, exams, lessons, classes, and profiles securely.
import { Client } from '@neondatabase/serverless';

const ALLOWED_TABLES = [
  'config',
  'lessons',
  'exams',
  'classes',
  'profiles',
  'activation_codes',
  'progress',
  'mock_history',
  'activity',
  'extraction_tasks'
];

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'NEON_DATABASE_URL is not configured on server' });
  }

  const client = new Client(databaseUrl);
  try {
    await client.connect();

    // ── 1. POST / PUT Requests (Mutations & Queries) ───────────────────────────
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = req.body || {};
      const action = body.action || (body.sql ? 'query' : null);

      // (A) Raw SQL Query
      if (action === 'query') {
        const { sql, params = [] } = body;
        if (!sql) return res.status(400).json({ error: 'Missing sql statement' });
        const result = await client.query(sql, params);
        return res.status(200).json({ rows: result.rows, rowCount: result.rowCount });
      }

      // (B) Table Upsert (Config, Lessons, Exams, Classes, Profiles, etc.)
      if (action === 'upsert') {
        const { table, data, keyField = 'id' } = body;
        if (!table || !ALLOWED_TABLES.includes(table)) {
          return res.status(403).json({ error: `Table '${table}' not allowed or invalid` });
        }
        if (!data || typeof data !== 'object') {
          return res.status(400).json({ error: 'Missing or invalid data payload' });
        }

        const keys = Object.keys(data);
        if (keys.length === 0) return res.status(400).json({ error: 'Empty data object' });

        const columns = keys.map(k => `"${k}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const updateSet = keys
          .filter(k => k !== keyField)
          .map(k => `"${k}" = EXCLUDED."${k}"`)
          .join(', ');

        const values = keys.map(k => {
          const val = data[k];
          if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        const sql = `
          INSERT INTO public."${table}" (${columns})
          VALUES (${placeholders})
          ON CONFLICT ("${keyField}") DO UPDATE SET
            ${updateSet || `"${keyField}" = EXCLUDED."${keyField}"`}
          RETURNING *;
        `;

        const result = await client.query(sql, values);
        return res.status(200).json({ success: true, row: result.rows[0] });
      }

      // (C) Table Delete
      if (action === 'delete') {
        const { table, id, keyField = 'id' } = body;
        if (!table || !ALLOWED_TABLES.includes(table)) {
          return res.status(403).json({ error: `Table '${table}' not allowed or invalid` });
        }
        if (id === undefined || id === null) {
          return res.status(400).json({ error: 'Missing id for deletion' });
        }

        const sql = `DELETE FROM public."${table}" WHERE "${keyField}" = $1 RETURNING *;`;
        const result = await client.query(sql, [id]);
        return res.status(200).json({ success: true, deleted: result.rowCount > 0 });
      }

      return res.status(400).json({ error: `Unknown action '${action}'` });
    }

    // ── 2. GET Requests (Fetches & Health Checks) ──────────────────────────────
    if (req.method === 'GET') {
      const { table, id, keyField = 'id', limit = 200 } = req.query || {};

      // Health check
      if (!table) {
        const check = await client.query('SELECT NOW() as time, current_database() as db, version() as version;');
        return res.status(200).json({
          status: 'ok',
          database: check.rows[0].db,
          serverTime: check.rows[0].time
        });
      }

      const queryTable = table.toLowerCase();
      if (!ALLOWED_TABLES.includes(queryTable) && queryTable !== 'exams_metadata') {
        return res.status(403).json({ error: 'Unauthorized table query' });
      }

      // Single item fetch
      if (id !== undefined && id !== null && id !== '') {
        const sql = `SELECT * FROM public."${queryTable}" WHERE "${keyField}" = $1 LIMIT 1;`;
        const result = await client.query(sql, [id]);
        return res.status(200).json({ row: result.rows[0] || null });
      }

      // List query with limit
      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
      const sql = `SELECT * FROM public."${queryTable}" LIMIT $1;`;
      const result = await client.query(sql, [parsedLimit]);
      return res.status(200).json({ rows: result.rows, rowCount: result.rowCount });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[Neon Serverless Error]:', err);
    return res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}
