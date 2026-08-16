import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is configured
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
}

/**
 * Loads a PDF document from an ArrayBuffer, File, or Base64 string.
 * @param {File|ArrayBuffer|string} input 
 * @returns {Promise<pdfjsLib.PDFDocumentProxy>}
 */
export async function loadPdfDocument(input) {
  let data;
  if (input instanceof ArrayBuffer) {
    data = input;
  } else if (input instanceof File || input instanceof Blob) {
    data = await input.arrayBuffer();
  } else if (typeof input === 'string') {
    // If base64 data URL
    if (input.startsWith('data:')) {
      const base64 = input.split(',')[1];
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      data = bytes.buffer;
    } else {
      // Raw base64 string
      const binaryStr = atob(input);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      data = bytes.buffer;
    }
  }

  const loadingTask = pdfjsLib.getDocument({ data });
  return await loadingTask.promise;
}

/**
 * Renders a specific page of a PDF onto an HTML5 Canvas at high DPI.
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc 
 * @param {number} pageNumber 1-based page number
 * @param {HTMLCanvasElement} canvas Target canvas element
 * @param {number} scale Zoom scale (default: 2.0 for crisp text and graphics)
 * @returns {Promise<{ width: number, height: number }>}
 */
export async function renderPdfPageToCanvas(pdfDoc, pageNumber, canvas, scale = 2.0) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
  return { width: viewport.width, height: viewport.height };
}

/**
 * Crops a specific rectangular region from a PDF page and returns a high-resolution PNG Data URL.
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc 
 * @param {number} pageNumber 1-based page number
 * @param {{ x: number, y: number, width: number, height: number }} rect Normalized (0-1) or pixel rect
 * @param {boolean} isNormalized If true, x, y, width, height are between 0 and 1
 * @param {number} renderScale Scale to render for crisp cropping (default: 2.5)
 * @returns {Promise<string>} PNG Data URL
 */
export async function cropPdfRegion(pdfDoc, pageNumber, rect, isNormalized = true, renderScale = 2.5) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: renderScale });

  // Create off-screen canvas for rendering full page
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = viewport.width;
  fullCanvas.height = viewport.height;
  const fullCtx = fullCanvas.getContext('2d');

  await page.render({
    canvasContext: fullCtx,
    viewport: viewport
  }).promise;

  let cropX, cropY, cropW, cropH;
  if (isNormalized) {
    cropX = Math.max(0, rect.x * viewport.width);
    cropY = Math.max(0, rect.y * viewport.height);
    cropW = Math.min(viewport.width - cropX, rect.width * viewport.width);
    cropH = Math.min(viewport.height - cropY, rect.height * viewport.height);
  } else {
    cropX = Math.max(0, rect.x * renderScale);
    cropY = Math.max(0, rect.y * renderScale);
    cropW = Math.min(viewport.width - cropX, rect.width * renderScale);
    cropH = Math.min(viewport.height - cropY, rect.height * renderScale);
  }

  // Ensure valid dimensions
  if (cropW <= 0 || cropH <= 0) {
    throw new Error("Zone de recadrage invalide.");
  }

  // Create crop canvas
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext('2d');

  // Fill with white background (in case of transparent PDFs)
  cropCtx.fillStyle = '#FFFFFF';
  cropCtx.fillRect(0, 0, cropW, cropH);

  cropCtx.drawImage(
    fullCanvas,
    cropX, cropY, cropW, cropH,
    0, 0, cropW, cropH
  );

  return cropCanvas.toDataURL('image/png', 0.95);
}
