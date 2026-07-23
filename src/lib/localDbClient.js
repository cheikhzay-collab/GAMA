// src/lib/localDbClient.js
// Client API wrapper for communicating with the local Companion server database on port 5002.

const BASE_URL = 'http://localhost:5002/api';

const request = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[LocalDB Client] Request to ${endpoint} failed:`, error);
    throw error;
  }
};

export const localDb = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  delete: (endpoint, id) => request(`${endpoint}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
};

export default localDb;
