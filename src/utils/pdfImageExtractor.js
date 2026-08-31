// src/utils/pdfImageExtractor.js
// Multi-layer PDF image extraction utility for Générateur de Fiches de Cours IA
// Handles: embedded raster images, page snapshots, and figure_bbox cropping fallback

import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
}

/**
 * Renders all pages of a PDF as high-resolution PNG data URLs.
 * Used as the primary fallback when figure_bbox coordinates are inaccurate.
 *
 * @param {File|ArrayBuffer} input - PDF file or buffer
 * @param {number} maxPages - Max pages to render (default: 20)
 * @param {number} scale - Render scale (default: 2.0 for crisp output)
 * @returns {Promise<{ [pageNum: number]: string }>} Map of page number → PNG data URL
 */
export async function buildPageSnapshotsMap(input, maxPages = 20, scale = 2.0) {
  let data;
  if (input instanceof ArrayBuffer) {
    data = input;
  } else if (input instanceof File || input instanceof Blob) {
    data = await input.arrayBuffer();
  } else {
    throw new Error('buildPageSnapshotsMap: invalid input type');
  }

  const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  const totalPages = Math.min(pdfDoc.numPages, maxPages);
  const snapshots = {};

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      // White background for transparent PDFs
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;
      snapshots[pageNum] = canvas.toDataURL('image/png', 0.92);
    } catch (err) {
      console.warn(`[pdfImageExtractor] Failed to snapshot page ${pageNum}:`, err);
    }
  }

  return snapshots;
}

/**
 * Crops a specific rectangular region from a pre-built page snapshot.
 * This is a pure canvas operation — no PDF re-rendering needed.
 *
 * @param {string} pageDataUrl - The page snapshot PNG data URL
 * @param {{ xmin: number, ymin: number, xmax: number, ymax: number }} bbox - Normalized bbox (0-1000 scale)
 * @param {number} padding - Extra padding pixels around the crop (default: 8)
 * @returns {Promise<string>} Cropped PNG data URL
 */
export async function cropFromPageSnapshot(pageDataUrl, bbox, padding = 8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;

      // Convert 0-1000 scale to actual pixel coords
      const x1 = Math.max(0, (bbox.xmin / 1000) * W - padding);
      const y1 = Math.max(0, (bbox.ymin / 1000) * H - padding);
      const x2 = Math.min(W, (bbox.xmax / 1000) * W + padding);
      const y2 = Math.min(H, (bbox.ymax / 1000) * H + padding);

      const cropW = x2 - x1;
      const cropH = y2 - y1;

      if (cropW <= 5 || cropH <= 5) {
        reject(new Error('Crop region too small'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cropW, cropH);
      ctx.drawImage(img, x1, y1, cropW, cropH, 0, 0, cropW, cropH);

      resolve(canvas.toDataURL('image/png', 0.95));
    };
    img.onerror = () => reject(new Error('Failed to load page snapshot image'));
    img.src = pageDataUrl;
  });
}

/**
 * Extracts all embedded raster images (XObjects) from a PDF using pdfjs operator list.
 * Returns an array of { page, imageIndex, dataUrl } objects.
 *
 * @param {File|ArrayBuffer} input - PDF file or buffer
 * @param {number} maxPages - Max pages to scan (default: 20)
 * @returns {Promise<Array<{ page: number, index: number, dataUrl: string, width: number, height: number }>>}
 */
export async function extractEmbeddedImagesFromPdf(input, maxPages = 20) {
  let data;
  if (input instanceof ArrayBuffer) {
    data = input;
  } else if (input instanceof File || input instanceof Blob) {
    data = await input.arrayBuffer();
  } else {
    throw new Error('extractEmbeddedImagesFromPdf: invalid input type');
  }

  const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  const totalPages = Math.min(pdfDoc.numPages, maxPages);
  const results = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const ops = await page.getOperatorList();
      const viewport = page.getViewport({ scale: 1.5 });

      // Render the full page to find image positions
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = viewport.width;
      pageCanvas.height = viewport.height;
      const pageCtx = pageCanvas.getContext('2d');
      pageCtx.fillStyle = '#FFFFFF';
      pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      await page.render({ canvasContext: pageCtx, viewport }).promise;

      // Scan operator list for image painting commands
      let imgIndex = 0;
      for (let i = 0; i < ops.fnArray.length; i++) {
        // OPS.paintImageXObject = 85, OPS.paintJpegXObject = 82, OPS.paintInlineImageXObject = 83
        const fn = ops.fnArray[i];
        if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {
          try {
            const imgRef = ops.argsArray[i]?.[0];
            if (!imgRef) continue;

            // Get the image object from the page's common objects
            const imageObj = await new Promise((res, rej) => {
              page.objs.get(imgRef, (obj) => {
                if (obj) res(obj);
                else rej(new Error(`Image ${imgRef} not found`));
              });
            });

            if (!imageObj || !imageObj.data) continue;

            const imgWidth = imageObj.width;
            const imgHeight = imageObj.height;

            // Skip tiny icons (< 30x30px)
            if (imgWidth < 30 || imgHeight < 30) continue;

            // Draw the image onto a canvas to get its data URL
            const imgCanvas = document.createElement('canvas');
            imgCanvas.width = imgWidth;
            imgCanvas.height = imgHeight;
            const imgCtx = imgCanvas.getContext('2d');

            const imageData = imgCtx.createImageData(imgWidth, imgHeight);
            imageData.data.set(imageObj.data);
            imgCtx.putImageData(imageData, 0, 0);

            const dataUrl = imgCanvas.toDataURL('image/png', 0.95);
            results.push({ page: pageNum, index: imgIndex, dataUrl, width: imgWidth, height: imgHeight });
            imgIndex++;
          } catch (imgErr) {
            // Silently skip unreadable images
            console.warn(`[pdfImageExtractor] Could not extract image on page ${pageNum}:`, imgErr.message);
          }
        }
      }
    } catch (pageErr) {
      console.warn(`[pdfImageExtractor] Error scanning page ${pageNum}:`, pageErr);
    }
  }

  return results;
}

/**
 * Main pipeline: attach resolved image URLs to lesson sections.
 * Tries in order:
 *   1. cropPdfRegion (using figure_bbox from AI, precise crop)
 *   2. cropFromPageSnapshot (using pre-rendered page PNG, fast fallback)
 *   3. Full page snapshot (last resort — shows whole page with the figure)
 *
 * @param {Array} sections - Parsed lesson sections from AI
 * @param {object|null} pdfDocProxy - Already-loaded pdfjs document proxy (optional)
 * @param {File|null} uploadFile - Original uploaded file
 * @param {{ [page: number]: string }} pageSnapshotsMap - Pre-built page snapshots
 * @param {Function} cropPdfRegion - The existing cropPdfRegion function
 * @param {Function} onProgress - Progress callback (message: string)
 * @returns {Promise<Array>} Updated sections with resolved image URLs
 */
export async function attachImagesToSections(
  sections,
  pdfDocProxy,
  uploadFile,
  pageSnapshotsMap,
  cropPdfRegion,
  onProgress = () => {}
) {
  // Count items needing image resolution
  let totalImages = 0;
  for (const sec of sections) {
    if (Array.isArray(sec.items)) {
      for (const it of sec.items) {
        if (it.type === 'image' && it.figure_bbox && !it.url) totalImages++;
      }
    }
  }

  if (totalImages === 0) return sections;
  onProgress(`🖼️ Résolution de ${totalImages} figure(s) géométrique(s)...`);

  let resolved = 0;
  const updatedSections = sections.map(sec => ({ ...sec, items: sec.items ? [...sec.items] : [] }));

  for (const sec of updatedSections) {
    if (!Array.isArray(sec.items)) continue;

    for (let i = 0; i < sec.items.length; i++) {
      const it = sec.items[i];
      if (it.type !== 'image' || it.url || !it.figure_bbox) continue;

      const bbox = it.figure_bbox;
      const pageNum = Math.max(1, bbox.page || 1);

      // === Layer 1: Try precise cropPdfRegion (from pdfjs proxy) ===
      if (pdfDocProxy && cropPdfRegion) {
        try {
          const rect = {
            x: (bbox.xmin || 0) / 1000,
            y: (bbox.ymin || 0) / 1000,
            width: Math.max(0.05, ((bbox.xmax || 900) - (bbox.xmin || 0)) / 1000),
            height: Math.max(0.05, ((bbox.ymax || 900) - (bbox.ymin || 0)) / 1000)
          };
          const croppedDataUrl = await cropPdfRegion(pdfDocProxy, pageNum, rect, true, 2.5);
          sec.items[i] = { ...it, url: croppedDataUrl };
          resolved++;
          onProgress(`🖼️ Figure ${resolved}/${totalImages} extraite (précision haute)...`);
          continue;
        } catch (cropErr) {
          console.warn(`[attachImages] Layer 1 crop failed for page ${pageNum}:`, cropErr.message);
        }
      }

      // === Layer 2: Try cropFromPageSnapshot (faster, no PDF re-render) ===
      const snapshotUrl = pageSnapshotsMap[pageNum];
      if (snapshotUrl && bbox.xmax && bbox.ymax) {
        try {
          const croppedDataUrl = await cropFromPageSnapshot(snapshotUrl, bbox);
          sec.items[i] = { ...it, url: croppedDataUrl };
          resolved++;
          onProgress(`🖼️ Figure ${resolved}/${totalImages} extraite (snapshot)...`);
          continue;
        } catch (snapErr) {
          console.warn(`[attachImages] Layer 2 snapshot crop failed:`, snapErr.message);
        }
      }

      // === Layer 3: Use full page snapshot as fallback ===
      if (snapshotUrl) {
        sec.items[i] = {
          ...it,
          url: snapshotUrl,
          _isFullPageFallback: true,
          alt: it.alt || `Page ${pageNum} — figure géométrique`
        };
        resolved++;
        onProgress(`🖼️ Figure ${resolved}/${totalImages} (page complète - fallback)...`);
      }
    }
  }

  onProgress(`✅ ${resolved}/${totalImages} figure(s) résolue(s) avec succès.`);
  return updatedSections;
}

/**
 * Detects if a page likely contains embedded images (vs. vector drawings only).
 * Used to decide whether to build snapshots for that page.
 *
 * @param {object} pdfDoc - pdfjs document proxy
 * @param {number} pageNum - 1-based page number
 * @returns {Promise<boolean>}
 */
export async function pageHasImages(pdfDoc, pageNum) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    const ops = await page.getOperatorList();
    return ops.fnArray.some(fn =>
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintJpegXObject ||
      fn === pdfjsLib.OPS.paintInlineImageXObject
    );
  } catch {
    return false;
  }
}
