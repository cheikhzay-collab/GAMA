// api/neon.js
// Vercel Serverless Function to execute queries securely on Neon PostgreSQL
import { Client } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // CORS Headers for API calls
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

    // 1. POST: Execute parameterized query or batch
    if (req.method === 'POST') {
      const { sql, params = [] } = req.body || {};
      if (!sql) {
        return res.status(400).json({ error: 'Missing sql statement' });
      }

      const result = await client.query(sql, params);
      return res.status(200).json({ 
        rows: result.rows, 
        rowCount: result.rowCount 
      });
    }

    // 2. GET: Safe query or healthcheck
    if (req.method === 'GET') {
      const { table, limit = 100 } = req.query || {};
      if (!table) {
        const check = await client.query('SELECT NOW() as time, current_database() as db;');
        return res.status(200).json({ 
          status: 'ok', 
          database: check.rows[0].db, 
          serverTime: check.rows[0].time 
        });
      }

      const allowedTables = ['lessons', 'exams', 'classes', 'config', 'profiles', 'exams_metadata', 'activation_codes'];
      if (!allowedTables.includes(table)) {
        return res.status(403).json({ error: 'Unauthorized table query' });
      }

      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
      const result = await client.query(`SELECT * FROM public.${table} LIMIT $1`, [parsedLimit]);
      return res.status(200).json({ rows: result.rows, rowCount: result.rowCount });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[Neon API Error]:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}
