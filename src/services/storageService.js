// src/services/storageService.js
// Direct image/asset storage connected to Neon PostgreSQL via /api/assets.
// Gracefully handles data URLs and file conversions without Supabase.

/**
 * Uploads an asset (file/blob) to Neon /api/assets.
 * @param {File|Blob} file - The file to upload.
 * @param {string} path - The destination path (e.g. 'questions/exam1/fig1.png').
 * @returns {Promise<string>} - The public URL of the stored asset.
 */
export const uploadAsset = async (file, path) => {
  if (!file) throw new Error('No file provided');

  // Convert File/Blob to Base64
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const mimeType = file.type || 'image/png';

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

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to upload asset');
    }

    const json = await response.json();
    return json.publicUrl || base64Data;
  } catch (err) {
    console.warn('[Storage] Remote asset upload failed, falling back to base64 data URL:', err.message);
    return base64Data;
  }
};
