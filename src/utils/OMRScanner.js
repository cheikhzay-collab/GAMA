import jsQR from 'jsqr';

/**
 * Real OMR (Optical Mark Recognition) Scanner
 * Uses Canvas API to analyze bubble positions based on the EXACT
 * coordinates used by generateAnswerSheet.js (jsPDF layout).
 */

/**
 * Helper to parse QR data with backward compatibility
 */
function parseQRData(dataStr) {
  if (!dataStr) return null;
  const trimmed = dataStr.trim();
  if (trimmed.startsWith('LCQ:')) {
    const rawContent = trimmed.slice(4);
    const parts = rawContent.split(':');
    const examId = parts[0] || '';
    const massarCode = parts[1] || '';
    let studentName = '';
    try {
      studentName = parts[2] ? decodeURIComponent(parts[2]) : '';
    } catch {
      studentName = parts[2] || '';
    }
    return {
      examId,
      massarCode,
      studentName,
      studentId: massarCode
    };
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    // Graceful fallback for plain IDs
    if (trimmed.length >= 8 && /^[a-fA-F0-9-]+$/.test(trimmed)) {
      return { examId: trimmed };
    }
    return null;
  }
}

/**
 * Helper to binarize/enhance contrast of image data for reliable QR decoding
 */
function enhanceContrastData(imgData) {
  const data = imgData.data;
  const len = data.length;
  const output = new Uint8ClampedArray(len);
  
  // Calculate average brightness
  let sum = 0;
  for (let i = 0; i < len; i += 4) {
    sum += (data[i] + data[i+1] + data[i+2]) / 3;
  }
  const avg = sum / (len / 4);
  const threshold = avg * 0.92; // Slight bias towards black modules
  
  for (let i = 0; i < len; i += 4) {
    const val = (data[i] + data[i+1] + data[i+2]) / 3;
    const bin = val < threshold ? 0 : 255;
    output[i] = bin;
    output[i+1] = bin;
    output[i+2] = bin;
    output[i+3] = 255;
  }
  return output;
}

/**
 * Reads QR Code payload from the uploaded image file.
 * Uses multi-pass scanning (different resolutions) and contrast pre-processing.
 * @param {File|Blob} imageFile 
 * @returns {Promise<Object|null>} Decoded QR payload containing { examId } or null
 */
export function readQRCodeFromImage(imageFile) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      // Multi-pass scanning resolutions to try: 1000px, 1500px, 600px, and original
      const targetSizes = [1000, 1500, 600, img.naturalWidth];
      
      for (const targetSize of targetSizes) {
        if (targetSize > img.naturalWidth && targetSize !== img.naturalWidth) continue;
        
        const scale = targetSize / img.naturalWidth;
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Pass A: Try raw image first
        let code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: "dontInvert",
        });
        
        // Pass B: If raw failed, try with contrast enhancement
        if (!code) {
          const enhancedData = enhanceContrastData(imgData);
          code = jsQR(enhancedData, imgData.width, imgData.height, {
            inversionAttempts: "dontInvert",
          });
        }
        
        if (code) {
          const payload = parseQRData(code.data);
          if (payload) {
            resolve(payload);
            return;
          }
        }
      }
      resolve(null);
    };
    img.src = url;
  });
}

// ── Grid constants (must match generateAnswerSheet.js exactly) ────
const PAGE_W = 210;   // A4 mm
const PAGE_H = 297;
const MARGIN  = 14;
const GRID_TOP = 96;
const ROW_H   = 8.5;
const COL_W   = (PAGE_W - MARGIN * 2) / 2;  // 91 mm
const OPTS    = ['A', 'B', 'C', 'D', 'E'];

/** Get bubble centers in mm for question index (0-based) */
function getBubblesMM(qIdx, total) {
  const half   = Math.ceil(total / 2);
  const col    = qIdx < half ? 0 : 1;
  const rowIdx = col === 0 ? qIdx : qIdx - half;
  const xBase  = MARGIN + col * COL_W;
  const cy     = GRID_TOP + 7 + rowIdx * ROW_H + ROW_H / 2;
  return OPTS.map((opt, i) => ({
    opt,
    x: xBase + 20 + i * 9,
    y: cy,
  }));
}

// Gaussian elimination solver for Ax = B (8x8 system for homography)
function gaussianElimination(A, B) {
  const n = B.length;
  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }
    for (let k = i; k < n; k++) {
      const tmp = A[maxRow][k];
      A[maxRow][k] = A[i][k];
      A[i][k] = tmp;
    }
    const tmp = B[maxRow];
    B[maxRow] = B[i];
    B[i] = tmp;

    if (Math.abs(A[i][i]) < 1e-10) return null; // Singular matrix

    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      B[k] += c * B[i];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = B[i] / A[i][i];
    for (let k = i - 1; k >= 0; k--) {
      B[k] -= A[k][i] * x[i];
    }
  }
  return x;
}

/** Solve for homography projection mapping 4 points from src to dst */
export function solvePerspective(src, dst) {
  const A = [];
  const B = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    B.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    B.push(v);
  }
  
  const coeffs = gaussianElimination(A, B);
  if (!coeffs) return null;
  
  return function(x, y) {
    const [a, b, c, d, e, f, g, h] = coeffs;
    const den = g * x + h * y + 1;
    return {
      x: (a * x + b * y + c) / den,
      y: (d * x + e * y + f) / den
    };
  };
}



/** Sample inner center core and overall bubble darkness */
function sampleBubbleDetail(data, cx, cy, r, W, H) {
  let innerSum = 0, innerN = 0;
  let totalSum = 0, totalN = 0;
  const ri = Math.ceil(r);
  const rInner = r * 0.40; // Core area inside the bubble

  for (let dy = -ri; dy <= ri; dy++) {
    for (let dx = -ri; dx <= ri; dx++) {
      const distSq = dx * dx + dy * dy;
      if (distSq > r * r) continue;
      
      const px = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      
      const i = (py * W + px) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const darkness = 255 - gray;
      
      if (distSq <= rInner * rInner) {
        innerSum += darkness;
        innerN++;
      }
      totalSum += darkness;
      totalN++;
    }
  }

  const innerDarkness = innerN > 0 ? innerSum / innerN : 0;
  const overallDarkness = totalN > 0 ? totalSum / totalN : 0;

  return { innerDarkness, overallDarkness };
}

/**
 * Adaptive Thresholding (Mean Local Thresholding) — in-place on ImageData.
 *
 * For each pixel, we compare it to the AVERAGE of its local neighborhood
 * (windowSize × windowSize). If it is darker than (localMean - C), it becomes
 * black (ink / mark), otherwise white (paper / background).
 *
 * This completely neutralizes:
 *  - Uneven phone camera lighting / shadows
 *  - Camera flash reflections and Moiré patterns
 *  - Yellow / warm paper tones
 *  - Dark desk borders around the sheet
 *
 * Uses an integral image (summed area table) for O(1) per-pixel box blur —
 * extremely fast even at 1500px width.
 *
 * @param {Uint8ClampedArray} data       Raw RGBA pixel buffer (mutated in-place)
 * @param {number}            W          Image width in pixels
 * @param {number}            H          Image height in pixels
 * @param {number}            windowSize Neighborhood radius (default 31px — ~5mm at 1200px)
 * @param {number}            C          Offset constant: pixels darker by C than mean become black (default 8)
 */
function adaptiveThreshold(data, W, H, windowSize = 31, C = 8) {
  const half = Math.floor(windowSize / 2);

  // ── Step 1: extract grayscale into a flat Float32Array ──────────
  const gray = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const p = i * 4;
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  // ── Step 2: build integral image (summed area table) ────────────
  // integral[y][x] = sum of gray[0..y][0..x]
  const integral = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      rowSum += gray[y * W + x];
      integral[(y + 1) * (W + 1) + (x + 1)] =
        rowSum + integral[y * (W + 1) + (x + 1)];
    }
  }

  // ── Step 3: for each pixel, compute local mean via SAT & binarize ──
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Clamp neighborhood window to image bounds
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(W - 1, x + half);
      const y2 = Math.min(H - 1, y + half);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      // SAT lookup: sum of rectangle [x1,y1]→[x2,y2]
      const areaSum =
        integral[(y2 + 1) * (W + 1) + (x2 + 1)]
        - integral[y1       * (W + 1) + (x2 + 1)]
        - integral[(y2 + 1) * (W + 1) + x1]
        + integral[y1       * (W + 1) + x1];

      const localMean = areaSum / count;
      const gv = gray[y * W + x];

      // Pixel is "ink" if it is darker than (localMean - C)
      const bw = gv < localMean - C ? 0 : 255;

      const p = (y * W + x) * 4;
      data[p] = data[p + 1] = data[p + 2] = bw;
      // alpha channel unchanged
    }
  }
}
/** Find the largest solid black square component in a quadrant (A4 anchor square) */
function findAnchorSquareInQuadrant(data, x1, x2, y1, y2, W, H, isTL = false, isTR = false) {
  // Create an independent visited array to avoid cross-quadrant component blocking
  const visited = new Uint8Array(W * H);
  let maxCentroid = null;
  let maxCount = -1;
  let fallbackCentroid = null;
  let maxFallbackSize = -1;

  // Expected area in pixels of a 7x7mm square on an A4 sheet.
  // A4 width is 210mm. Pixels per mm = W / 210.
  // 7mm side = 7 * W / 210 = W / 30.
  // Expected area = (W / 30) * (W / 30) = (W * W) / 900.
  const expectedArea = (W * W) / 900;
  const minArea = expectedArea * 0.40; // Require at least 40% size to avoid tiny noise
  const maxArea = expectedArea * 2.2;  // Standard anchor cap

  const mmPx = W / 210;

  const step = 2; // Sample every 2nd pixel for speed and robustness
  for (let y = y1; y < y2; y += step) {
    for (let x = x1; x < x2; x += step) {
      const idx = y * W + x;
      if (visited[idx]) continue;
      // In binarized data, a black pixel has data[idx*4] = 0 (low intensity)
      if (data[idx * 4] < 128) {
        const component = [];
        const queue = [{ x, y }];
        visited[idx] = 1;
        let head = 0;

        while (head < queue.length) {
          const curr = queue[head++];
          component.push(curr);
          if (component.length > expectedArea * 15.0) break; // Allow larger for header band fallback

          const neighbors = [
            { x: curr.x + 1, y: curr.y },
            { x: curr.x - 1, y: curr.y },
            { x: curr.x, y: curr.y + 1 },
            { x: curr.x, y: curr.y - 1 }
          ];

          for (const n of neighbors) {
            if (n.x >= x1 && n.x < x2 && n.y >= y1 && n.y < y2) {
              const nIdx = n.y * W + n.x;
              if (!visited[nIdx]) {
                visited[nIdx] = 1;
                if (data[nIdx * 4] < 128) {
                  queue.push(n);
                }
              }
            }
          }
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        for (const p of component) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const wComp = maxX - minX + 1;
        const hComp = maxY - minY + 1;
        const aspect = wComp / hComp;
        const fill = component.length / (wComp * hComp);

        // Standard square check
        if (component.length > minArea && component.length < maxArea) {
          if (aspect >= 0.55 && aspect <= 1.8 && fill >= 0.6) {
            if (component.length > maxCount) {
              maxCount = component.length;
              let sumX = 0, sumY = 0;
              for (const p of component) {
                sumX += p.x;
                sumY += p.y;
              }
              maxCentroid = { x: sumX / component.length, y: sumY / component.length };
            }
          }
        }

        // Fallback check for merged header band
        if (component.length >= maxArea) {
          if (component.length > maxFallbackSize) {
            maxFallbackSize = component.length;
            if (isTL && minX < W * 0.15 && minY < H * 0.15) {
              // Outer corner of merged TL component is the TL anchor center
              fallbackCentroid = {
                x: minX + 3.5 * mmPx,
                y: minY + 3.5 * mmPx
              };
            } else if (isTR && maxX > W * 0.85 && minY < H * 0.15) {
              // Outer corner of merged TR component is the TR anchor center
              fallbackCentroid = {
                x: maxX - 3.5 * mmPx,
                y: minY + 3.5 * mmPx
              };
            }
          }
        }
      }
    }
  }
  return maxCentroid || fallbackCentroid;
}

/** Search locally for the centroid of the row timing track */
function findTimingTrack(data, coarsePx, W, H) {
  const cx = Math.round(coarsePx.x);
  const cy = Math.round(coarsePx.y);
  
  // Timing track is 2x2mm. Calculate search window based on pixel-per-mm scale.
  const mmPx = W / 210;
  const rY = Math.round(4.0 * mmPx); // Allow up to 4mm vertical shift per row
  const rX = Math.round(3.0 * mmPx); // Allow up to 3mm horizontal shift per row
  
  let sumX = 0, sumY = 0, count = 0;
  for (let dy = -rY; dy <= rY; dy++) {
    for (let dx = -rX; dx <= rX; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const idx = (py * W + px) * 4;
      if (data[idx] < 128) { // Black pixel
        sumX += px;
        sumY += py;
        count++;
      }
    }
  }
  
  // Verify if detected count matches a valid timing track size footprint
  const expectedTrackArea = 4 * mmPx * mmPx; // 2mm x 2mm area
  const minPixels = Math.round(expectedTrackArea * 0.10);
  if (count > minPixels) {
    return { x: sumX / count, y: sumY / count };
  }
  return coarsePx;
}

/**
 * Main scanner function with quadrant anchor perspective homography and timing tracks correction.
 * @param {File|Blob} imageFile
 * @param {number}    questionCount
 * @returns {Promise<Array<{q, answer, confidence, darknesses}>>}
 */
export function scanAnswerSheet(imageFile, questionCount) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(imageFile);
    const img = new Image();

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image invalide')); };

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1500 / img.naturalWidth);
      canvas.width  = Math.round(img.naturalWidth  * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const W = canvas.width;
      const H = canvas.height;

      // ── STEP 1: Detect QR Code on RAW pixels (before binarization) ──
      const code = jsQR(imgData.data, W, H, { inversionAttempts: 'dontInvert' });

      // ── STEP 2: Adaptive Thresholding (Binarize in place) ──────────
      adaptiveThreshold(imgData.data, W, H, 61, 8);

      // Establish default projection mapping (linear fallback)
      let project = (x, y) => ({
        x: (x / PAGE_W) * W,
        y: (y / PAGE_H) * H
      });

      let alignedWithAnchors = false;

      // ── STEP 3: Detect 4 Corner Solid Black Anchor Squares ──────────
      // To prevent matching other page content (like student cards, legend, or text),
      // we restrict the search area for each corner to 20% of the page borders.
      const searchW = Math.round(W * 0.20);
      const searchH = Math.round(H * 0.20);

      const cTL = findAnchorSquareInQuadrant(imgData.data, 0, searchW, 0, searchH, W, H, true, false);
      const cTR = findAnchorSquareInQuadrant(imgData.data, W - searchW, W, 0, searchH, W, H, false, true);
      const cBR = findAnchorSquareInQuadrant(imgData.data, W - searchW, W, H - searchH, H, W, H, false, false);
      const cBL = findAnchorSquareInQuadrant(imgData.data, 0, searchW, H - searchH, H, W, H, false, false);

      let finalTL = cTL;
      let finalTR = cTR;
      let finalBR = cBR;
      let finalBL = cBL;

      // 3-point fallback: If exactly one corner is missing/obscured, estimate it mathematically.
      let detectedCount = 0;
      if (finalTL) detectedCount++;
      if (finalTR) detectedCount++;
      if (finalBR) detectedCount++;
      if (finalBL) detectedCount++;

      if (detectedCount === 3) {
        if (!finalTL) {
          finalTL = {
            x: finalTR.x + finalBL.x - finalBR.x,
            y: finalTR.y + finalBL.y - finalBR.y
          };
        } else if (!finalTR) {
          finalTR = {
            x: finalTL.x + finalBR.x - finalBL.x,
            y: finalTL.y + finalBR.y - finalBL.y
          };
        } else if (!finalBR) {
          finalBR = {
            x: finalTR.x + finalBL.x - finalTL.x,
            y: finalTR.y + finalBL.y - finalTL.y
          };
        } else if (!finalBL) {
          finalBL = {
            x: finalTL.x + finalBR.x - finalTR.x,
            y: finalTL.y + finalBR.y - finalTR.y
          };
        }
        detectedCount = 4;
      }

      if (detectedCount === 4) {
        // Ideal anchor centers on the sheet (in mm)
        const cIdeal = [
          { x: 11.5, y: 11.5 },   // Top-Left
          { x: 198.5, y: 11.5 },  // Top-Right
          { x: 198.5, y: 285.5 }, // Bottom-Right
          { x: 11.5, y: 285.5 }   // Bottom-Left
        ];

        const projectFine = solvePerspective(cIdeal, [finalTL, finalTR, finalBR, finalBL]);
        if (projectFine) {
          project = projectFine;
          alignedWithAnchors = true;
        }
      }

      // Fallback to QR code homography if anchors are not found
      if (!alignedWithAnchors && code) {
        const pTL = code.location.topLeftCorner;
        const pTR = code.location.topRightCorner;
        const pBR = code.location.bottomRightCorner;
        const pBL = code.location.bottomLeftCorner;

        // Ideal QR corners on the A4 sheet (in mm)
        const qTL = { x: 166, y: 14 };
        const qTR = { x: 192, y: 14 };
        const qBR = { x: 192, y: 40 };
        const qBL = { x: 166, y: 40 };

        const projectCoarse = solvePerspective([qTL, qTR, qBR, qBL], [pTL, pTR, pBR, pBL]);
        if (projectCoarse) {
          project = projectCoarse;
        }
      }

      // Bubble sample radius in pixels
      const bubbleRadiusPx = (2.6 / PAGE_W) * W;

      // ── STEP 4: First Pass - Sample timing tracks and calibrate alignment ──
      const rawResults = [];
      const allOverall = [];
      const allInner = [];
      const rowYOffsets = new Array(questionCount).fill(0);
      const half = Math.ceil(questionCount / 2);

      for (let q = 0; q < questionCount; q++) {
        const col = q < half ? 0 : 1;
        const rowIdx = col === 0 ? q : q - half;
        const cy = GRID_TOP + 7 + rowIdx * ROW_H + ROW_H / 2;

        // Timing track center is at x = 9 for left column and x = 201 for right column
        const trackX = col === 0 ? 9 : 201;
        const coarseTrack = project(trackX, cy);
        const fineTrack = findTimingTrack(imgData.data, coarseTrack, W, H);
        rowYOffsets[q] = fineTrack.y - coarseTrack.y; // Vertical alignment correction
      }

      for (let q = 0; q < questionCount; q++) {
        const bubbles = getBubblesMM(q, questionCount);
        const qResults = {};
        const dyShift = rowYOffsets[q];

        for (const { opt, x, y } of bubbles) {
          const { x: pxCoarse, y: pyCoarse } = project(x, y);
          const px = pxCoarse;
          const py = pyCoarse + dyShift;

          const detail = sampleBubbleDetail(imgData.data, px, py, bubbleRadiusPx, W, H);
          qResults[opt] = detail;
          allOverall.push(detail.overallDarkness);
          allInner.push(detail.innerDarkness);
        }
        rawResults.push(qResults);
      }

      // ── STEP 5: Dynamic Baseline Calibration ──
      const sortedOverall = [...allOverall].sort((a, b) => a - b);
      const sortedInner = [...allInner].sort((a, b) => a - b);

      const emptyIdx = Math.floor(sortedOverall.length * 0.70);
      const emptyBaselineOverall = sortedOverall[emptyIdx];
      const emptyBaselineInner = sortedInner[emptyIdx];

      const overallThreshold = Math.max(48, emptyBaselineOverall + 20);
      const innerThreshold = Math.max(30, emptyBaselineInner + 25);

      const results = [];

      for (let q = 0; q < questionCount; q++) {
        const qResults = rawResults[q];
        const darknesses = {};
        const innerDarknesses = {};

        for (const opt of OPTS) {
          darknesses[opt] = qResults[opt].overallDarkness;
          innerDarknesses[opt] = qResults[opt].innerDarkness;
        }

        // Pick the bubble with highest overall darkness
        let bestOpt = 'A', bestDark = -1;
        for (const [opt, dark] of Object.entries(darknesses)) {
          if (dark > bestDark) {
            bestDark = dark;
            bestOpt = opt;
          }
        }

        // Dual-constraint: bubble must exceed both dynamic thresholds
        const bestInner = innerDarknesses[bestOpt];
        const isFilled = bestDark >= overallThreshold && bestInner >= innerThreshold;
        const isEmpty = !isFilled;

        // Confidence calculation
        const secondBest = Object.entries(darknesses)
          .filter(([o]) => o !== bestOpt)
          .reduce((m, [, v]) => Math.max(m, v), 0);

        const confidence = isEmpty
          ? 1
          : Math.min(1, (bestDark - secondBest) / (bestDark + 1));

        // Calculate coordinates for bubbles in original image pixels
        const bubbles = getBubblesMM(q, questionCount);
        const coords = {};
        bubbles.forEach(b => {
          const { x: pxCoarse, y: pyCoarse } = project(b.x, b.y);
          coords[b.opt] = {
            x: Math.round(pxCoarse / scale),
            y: Math.round((pyCoarse + rowYOffsets[q]) / scale)
          };
        });

        results.push({
          q:          q + 1,
          answer:     isEmpty ? null : bestOpt,
          confidence: Math.max(0, confidence),
          darknesses,
          coords,
        });
      }

      resolve(results);
    };

    img.src = url;
  });
}
