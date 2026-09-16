// src/lib/neon.js
// Secure Neon PostgreSQL Client Helper for GAMA (Hybrid Architecture)
// Routes queries through /api/neon so database credentials are never exposed in the browser bundle.

/**
 * Execute a parameterized query on Neon PostgreSQL via the secure /api/neon endpoint.
 * @param {string} sql - SQL query string with $1, $2 placeholders
 * @param {Array} params - Array of parameter values
 * @returns {Promise<{ data: Array|null, error: Error|null, count: number }>}
 */
export async function neonQuery(sql, params = []) {
  try {
    const response = await fetch('/api/neon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorJson.error || `Request failed with status ${response.status}`);
    }

    const result = await response.json();
    return { data: result.rows || [], error: null, count: result.rowCount || 0 };
  } catch (err) {
    console.error('[Neon Query Error]:', err.message || err);
    return { data: null, error: err, count: 0 };
  }
}

/**
 * Fetch rows from an allowed public table on Neon PostgreSQL.
 * @param {string} table - Table name (e.g. 'lessons', 'exams', 'classes', 'config', 'profiles')
 * @param {number} limit - Maximum number of rows to retrieve
 * @returns {Promise<{ data: Array|null, error: Error|null }>}
 */
export async function getNeonTable(table, limit = 100) {
  try {
    const response = await fetch(`/api/neon?table=${encodeURIComponent(table)}&limit=${limit}`);
    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorJson.error || `Request failed with status ${response.status}`);
    }

    const result = await response.json();
    return { data: result.rows || [], error: null };
  } catch (err) {
    console.error(`[Neon getTable "${table}" Error]:`, err.message || err);
    return { data: null, error: err };
  }
}

export default {
  neonQuery,
  getNeonTable,
};
