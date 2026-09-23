// src/services/storageService.js
// Multi-tier asset storage: Neon Cloud -> Local Companion -> Inline Base64 Fallback.

/**
 * Uploads an asset (file/blob or base64 data url) to Neon /api/assets or Companion server.
 * @param {File|Blob|string} fileOrDataUrl - The file or base64 data URL to upload.
 * @param {string} path - The destination path (e.g. 'lessons/MOCK-1/fig1.png').
 * @param {string} [mimeType='image/png'] - MIME type.
 * @returns {Promise<string>} - The public URL of the stored asset or fallback data URL.
 */
export const uploadAsset = async (fileOrDataUrl, path, mimeType = 'image/png') => {
  if (!fileOrDataUrl) throw new Error('No file or data provided');

  let base64Data = '';
  if (typeof fileOrDataUrl === 'string') {
    base64Data = fileOrDataUrl;
    const match = base64Data.match(/^data:([^;]+);base64,/);
    if (match && match[1]) mimeType = match[1];
  } else {
    base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    });
    if (fileOrDataUrl.type) mimeType = fileOrDataUrl.type;
  }

  // 1. Try standard /api/assets (Neon via Serverless / Vite proxy)
  try {
    const response = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        data: base64Data,
        mimeType,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.publicUrl) return json.publicUrl;
    }
  } catch (err) {
    console.warn('[Storage] Remote asset upload to /api/assets failed:', err.message);
  }

  // 2. Try Local Companion Server on port 5002
  try {
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '127.0.0.1';
    const compResponse = await fetch(`http://${host}:5002/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        data: base64Data,
        mimeType,
      }),
    });

    if (compResponse.ok) {
      const json = await compResponse.json();
      if (json.publicUrl) return json.publicUrl;
    }
  } catch (err) {
    console.warn('[Storage] Companion asset upload failed:', err.message);
  }

  // 3. Fallback to inline Base64 Data URL if servers are unreachable
  return base64Data;
};

export const uploadAssetData = uploadAsset;
