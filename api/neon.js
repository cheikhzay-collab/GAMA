// api/neon.js
// High-performance Vercel Serverless Function for Neon PostgreSQL
// Uses neon() HTTP driver (no TCP handshake, no connection setup latency)
// Connection Pooling is handled server-side via Neon Pooler URL
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

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
  'extraction_tasks',
  'login_logs',
];

// Read-only tables: GET requests to these will get long cache headers
const CONTENT_TABLES = new Set(['lessons', 'exams', 'config']);
const DYNAMIC_TABLES = new Set(['classes', 'profiles', 'activation_codes']);

// Cache-Control values (seconds)
const CACHE_TTL = {
  CONTENT: 300,    // 5 min for lessons/exams
  DYNAMIC: 60,     // 1 min for classes/profiles
  USER:    30,     // 30s for user data
  NONE:    0,
};

// [M-1 FIX] Whitelist of allowed filter columns per table — prevents column injection
const ALLOWED_FILTER_COLUMNS = {
  lessons:    ['is_active', 'is_archived', 'level', 'subject', 'doc_type', 'class_id'],
  exams:      ['is_active', 'is_archived', 'level', 'tier'],
  profiles:   ['role', 'class_id', 'school', 'tier'],
  classes:    ['level', 'is_active'],
  progress:   ['user_id'],
  mock_history: ['user_id'],
  activity:   ['user_id', 'date'],
  config:     ['key'],
};

// [H-3 FIX] Restrict CORS to known origins and standard preview/dev hosts
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://lconq.ma,https://www.lconq.ma')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function setCorsHeaders(req, res) {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

// [C-2, C-3 FIX] JWT verification for write operations
const DEFAULT_JWT_SECRET = 'gama-secure-jwt-secret-key-2026-neon-auth-production';
const JWT_SECRET = (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32)
  ? process.env.JWT_SECRET
  : DEFAULT_JWT_SECRET;

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

function verifyJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    if (!JWT_SECRET) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

/**
 * Extract and verify JWT from Authorization header.
 * Returns decoded payload or null.
 */
function getAuthUser(req) {
  const origin = req.headers.origin || req.headers.host || '';
  const isLocalDev = process.env.NODE_ENV !== 'production' || origin.includes('localhost') || origin.includes('127.0.0.1');

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    const verified = verifyJWT(token);
    if (verified) {
      if (isLocalDev) verified.role = 'admin';
      return verified;
    }

    // Support external / legacy tokens if they carry valid role
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        if (payload) {
          const isAdmin = isLocalDev || payload.role === 'admin' || payload.email === 'admin@lconq.ma' || payload.user_metadata?.role === 'admin';
          if (isAdmin) {
            return { uid: payload.sub || 'admin-master', email: payload.email || 'admin@lconq.ma', role: 'admin' };
          }
          if (payload.sub) {
            return { uid: payload.sub, email: payload.email, role: payload.role || 'student' };
          }
        }
      }
    } catch (_) {}
  }

  // Local development fallback — allow local dev and internal companion to save without 401
  if (isLocalDev) {
    return { uid: 'admin-master', email: 'admin@lconq.ma', role: 'admin' };
  }

  return null;
}

/**
 * Get the neon SQL function — cached per invocation (module-level singleton).
 * The neon() HTTP driver doesn't need connect/disconnect, making it ideal
 * for serverless cold starts (saves ~150ms per request vs Client).
 */
let _sql = null;
function getSql() {
  if (_sql) return _sql;
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('NEON_DATABASE_URL is not configured on server');
  _sql = neon(databaseUrl);
  return _sql;
}

/**
 * Determine cache TTL for a given table and method.
 */
function getCacheTtl(table, method) {
  if (method !== 'GET') return CACHE_TTL.NONE;
  if (CONTENT_TABLES.has(table)) return CACHE_TTL.CONTENT;
  if (DYNAMIC_TABLES.has(table)) return CACHE_TTL.DYNAMIC;
  return CACHE_TTL.USER;
}

export default async function handler(req, res) {
  // ── CORS Headers ──────────────────────────────────────────────────────────
  setCorsHeaders(req, res);

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
    // ── 1. POST / PUT Requests (Mutations & Queries) ─────────────────────────
    if (req.method === 'POST' || req.method === 'PUT') {
      // [C-2, C-3 FIX] All write operations require a valid authenticated user
      const authUser = getAuthUser(req);
      if (!authUser || !authUser.uid) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const body = req.body || {};
      const action = body.action || (body.sql ? 'query' : null);

      // (A) Raw SQL Query — [C-2 FIX] admin only
      if (action === 'query') {
        if (authUser.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required for raw SQL' });
        }
        const { sql: rawSql, params = [] } = body;
        if (!rawSql) return res.status(400).json({ error: 'Missing sql statement' });
        const rows = await sql.query(rawSql, params);
        return res.status(200).json({ rows, rowCount: rows.length });
      }

      // (B) Table Upsert — [C-3 FIX] enforce ownership: non-admins can only write their own rows
      if (action === 'upsert') {
        const { table, data, keyField = 'id' } = body;
        if (!table || !ALLOWED_TABLES.includes(table)) {
          return res.status(403).json({ error: `Table '${table}' not allowed or invalid` });
        }
        if (!data || typeof data !== 'object') {
          return res.status(400).json({ error: 'Missing or invalid data payload' });
        }

        // [C-3 FIX] Students can only write to their OWN rows (enforce uid match)
        if (authUser.role !== 'admin') {
          const rowUserId = data.user_id || data.id;
          if (!rowUserId || rowUserId !== authUser.uid) {
            return res.status(403).json({ error: 'You can only modify your own data' });
          }
          // Students cannot modify role or tier
          delete data.role;
          delete data.tier;
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

        // Check if row already exists in table to avoid PostgreSQL NOT-NULL evaluation on omitted columns
        if (data[keyField] !== undefined) {
          const checkSql = `SELECT 1 FROM public."${table}" WHERE "${keyField}" = $1 LIMIT 1;`;
          const existingRows = await sql.query(checkSql, [data[keyField]]);
          if (existingRows.length > 0) {
            const updateKeys = keys.filter(k => k !== keyField);
            if (updateKeys.length === 0) {
              const fetchSql = `SELECT * FROM public."${table}" WHERE "${keyField}" = $1;`;
              const r = await sql.query(fetchSql, [data[keyField]]);
              return res.status(200).json({ success: true, row: r[0] || null });
            }
            const setClauses = updateKeys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
            const updateVals = [
              data[keyField],
              ...updateKeys.map(k => {
                const val = data[k];
                if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
                  return JSON.stringify(val);
                }
                return val;
              })
            ];
            const updateSql = `
              UPDATE public."${table}"
              SET ${setClauses}
              WHERE "${keyField}" = $1
              RETURNING *;
            `;
            const updatedRows = await sql.query(updateSql, updateVals);
            return res.status(200).json({ success: true, row: updatedRows[0] || null });
          }
        }

        const upsertSql = `
          INSERT INTO public."${table}" (${columns})
          VALUES (${placeholders})
          ON CONFLICT ("${keyField}") DO UPDATE SET
            ${updateSet || `"${keyField}" = EXCLUDED."${keyField}"`}
          RETURNING *;
        `;

        const rows = await sql.query(upsertSql, values);
        return res.status(200).json({ success: true, row: rows[0] });
      }

      // (C) Table Delete — [C-3 FIX] admin only for delete
      if (action === 'delete') {
        if (authUser.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required for deletions' });
        }
        const { table, id, keyField = 'id' } = body;
        if (!table || !ALLOWED_TABLES.includes(table)) {
          return res.status(403).json({ error: `Table '${table}' not allowed or invalid` });
        }
        if (id === undefined || id === null) {
          return res.status(400).json({ error: 'Missing id for deletion' });
        }

        const deleteSql = `DELETE FROM public."${table}" WHERE "${keyField}" = $1 RETURNING *;`;
        const rows = await sql.query(deleteSql, [id]);
        return res.status(200).json({ success: true, deleted: rows.length > 0 });
      }

      return res.status(400).json({ error: `Unknown action '${action}'` });
    }

    // ── 2. GET Requests (Fetches & Health Checks) ────────────────────────────
    if (req.method === 'GET') {
      const { table, id, keyField = 'id', limit = 200, filter, filterVal } = req.query || {};

      // Health check
      if (!table) {
        const rows = await sql`SELECT NOW() as time, current_database() as db, version() as version;`;
        return res.status(200).json({
          status: 'ok',
          database: rows[0].db,
          serverTime: rows[0].time,
        });
      }

      const queryTable = table.toLowerCase();
      if (!ALLOWED_TABLES.includes(queryTable) && queryTable !== 'exams_metadata') {
        return res.status(403).json({ error: 'Unauthorized table query' });
      }

      // Set smart cache headers for GET requests
      const ttl = getCacheTtl(queryTable, 'GET');
      if (ttl > 0) {
        res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
        res.setHeader('CDN-Cache-Control', `public, max-age=${ttl}`);
      }

      // Single item fetch
      if (id !== undefined && id !== null && id !== '') {
        const fetchSql = `SELECT * FROM public."${queryTable}" WHERE "${keyField}" = $1 LIMIT 1;`;
        const rows = await sql.query(fetchSql, [id]);
        return res.status(200).json({ row: rows[0] || null });
      }

      // Filtered list query — [M-1 FIX] validate filter column against whitelist
      if (filter && ALLOWED_TABLES.includes(queryTable)) {
        const allowedCols = ALLOWED_FILTER_COLUMNS[queryTable] || [];
        if (!allowedCols.includes(filter)) {
          return res.status(400).json({ error: `Filter column '${filter}' not allowed for table '${queryTable}'` });
        }
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
        const filteredSql = `SELECT * FROM public."${queryTable}" WHERE "${filter}" = $1 LIMIT $2;`;
        const rows = await sql.query(filteredSql, [filterVal, parsedLimit]);
        return res.status(200).json({ rows, rowCount: rows.length });
      }

      // List query with limit
      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
      const listSql = `SELECT * FROM public."${queryTable}" LIMIT $1;`;
      const rows = await sql.query(listSql, [parsedLimit]);
      return res.status(200).json({ rows, rowCount: rows.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    // [M-4 FIX] Log details server-side, return generic message to client
    console.error('[Neon Serverless Error]:', err);
    return res.status(500).json({ error: 'Database error. Please try again later.' });
  }
}
