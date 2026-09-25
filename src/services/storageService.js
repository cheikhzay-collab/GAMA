// src/services/storageService.js
// Multi-tier asset storage: Supabase Storage -> Local Companion -> Inline Base64 Fallback.

import { supabase } from '../lib/supabase';

/**
 * Uploads an asset (file/blob or base64 data url) to Supabase Storage or Companion server.
 * @param {File|Blob|string} fileOrDataUrl - The file or base64 data URL to upload.
 * @param {string} path - The destination path (e.g. 'lessons/MOCK-1/fig1.png').
 * @param {string} [mimeType='image/png'] - MIME type.
 * @returns {Promise<string>} - The public URL of the stored asset or fallback data URL.
 */
export const uploadAsset = async (fileOrDataUrl, path, mimeType = 'image/png') => {
  if (!fileOrDataUrl) throw new Error('No file or data provided');

  let fileBlob = null;
  let base64Data = '';

  if (typeof fileOrDataUrl === 'string') {
    base64Data = fileOrDataUrl;
    const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (match && match[1]) {
      mimeType = match[1];
      const byteCharacters = atob(match[2]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      fileBlob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
    }
  } else {
    fileBlob = fileOrDataUrl;
    if (fileOrDataUrl.type) mimeType = fileOrDataUrl.type;
  }

  const cleanPath = path.replace(/^\/+/, '');

  // 1. Try Supabase Storage (Primary Cloud Storage)
  if (supabase && fileBlob) {
    try {
      const { error: uploadError } = await supabase.storage
        .from('gima-assets')
        .upload(cleanPath, fileBlob, {
          contentType: mimeType,
          upsert: true
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('gima-assets')
          .getPublicUrl(cleanPath);

        if (urlData?.publicUrl) {
          return urlData.publicUrl;
        }
      } else {
        console.warn('[Storage] Supabase upload failed:', uploadError.message);
      }
    } catch (err) {
      console.warn('[Storage] Supabase storage exception:', err.message || err);
    }
  }

  // 2. Try Local Companion Server on port 5002
  try {
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '127.0.0.1';
    const compResponse = await fetch(`http://${host}:5002/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: cleanPath,
        data: base64Data,
        mimeType,
      }),
    });

    if (compResponse.ok) {
      const json = await compResponse.json();
      if (json.publicUrl) return json.publicUrl;
    }
  } catch (err) {}

  // 3. Fallback to inline Base64 Data URL if offline
  if (base64Data) return base64Data;
  if (fileBlob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileBlob);
    });
  }

  return '';
};

export const uploadAssetData = uploadAsset;
