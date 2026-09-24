// api/assets.js
// Storage endpoint for image & document assets using Neon PostgreSQL.
// Uses neon() HTTP driver — zero TCP overhead, ideal for serverless cold starts.
import { neon } from '@neondatabase/serverless';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://lconq.ma,https://www.lconq.ma')
  .split(',').map(o => o.trim()).filter(Boolean);

/**
 * Get the neon SQL function — cached per module (singleton).
 * Uses HTTP driver: no TCP handshake overhead, ideal for serverless.
 */
let _sql = null;
function getSql() {
  if (_sql) return _sql;
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.VITE_NEON_DATABASE_URL;
  if (!databaseUrl) throw new Error('NEON_DATABASE_URL is not configured');
  _sql = neon(databaseUrl);
  return _sql;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.endsWith('.vercel.app');

  const allowed = isAllowed ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowed || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let sql;
  try {
    sql = getSql();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  try {
    // ── 1. GET /api/assets?path=... (Serve image) ───────────────────────────
    if (req.method === 'GET') {
      const { path } = req.query || {};
      if (!path) return res.status(400).json({ error: 'Missing path' });

      const rows = await sql('SELECT data, mime_type FROM public.assets WHERE path = $1 LIMIT 1;', [path]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      const { data, mime_type } = rows[0];
      const base64Content = data.includes(',') ? data.split(',')[1] : data;
      const buffer = Buffer.from(base64Content, 'base64');

      res.setHeader('Content-Type', mime_type || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(buffer);
    }

    // ── 2. POST /api/assets (Upload image) ──────────────────────────────────
    if (req.method === 'POST') {
      const { path, data, mimeType = 'image/png' } = req.body || {};
      if (!path || !data) {
        return res.status(400).json({ error: 'Missing path or data payload' });
      }

      const id = 'asset_' + Math.random().toString(36).substring(2, 11);
      const size = Buffer.byteLength(data, 'utf8');

      const insertSql = `
        INSERT INTO public.assets (id, path, data, mime_type, size, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (path) DO UPDATE SET
          data = EXCLUDED.data,
          mime_type = EXCLUDED.mime_type,
          size = EXCLUDED.size,
          updated_at = NOW()
        RETURNING path;
      `;

      await sql(insertSql, [id, path, data, mimeType, size]);
      const publicUrl = `/api/assets?path=${encodeURIComponent(path)}`;

      return res.status(200).json({ success: true, publicUrl });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[Neon Assets Error]:', err);
    return res.status(500).json({ error: err.message || 'Asset storage error' });
  }
}
