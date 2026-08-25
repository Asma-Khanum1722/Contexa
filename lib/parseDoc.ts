/**
 * lib/parseDoc.ts
 * Dual-path document parser — the core differentiator of ScanBrain.
 *
 * Decision tree:
 *  1. PDF  → pdf-parse for native text layer
 *             if sparse (<50 chars/page) → pdfjs-dist page render → tesseract OCR
 *  2. Image → tesseract OCR directly
 *  3. Other → UTF-8 decode (txt / csv / md)
 *
 * Production improvements:
 *  - Text cleaning (null bytes, control chars, whitespace normalisation)
 *  - Page-count guard (>100 pages → warn and process first 100)
 *  - Pure-JS PDF-to-image via pdfjs-dist CanvasFactory shim (no native deps)
 *  - Always terminates tesseract worker in a finally block
 */

import pdf from "pdf-parse";
import { createWorker } from "tesseract.js";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ParseResult {
  text: string;
  /** How many pages were processed (PDFs only). */
  pages?: number;
  /** "text" | "ocr-image" | "ocr-pdf" | "raw" */
  method: "text" | "ocr-image" | "ocr-pdf" | "raw";
}

export async function parseDocument(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) {
    return parsePdf(buffer);
  }

  if (/\.(png|jpe?g|webp|tiff?)$/i.test(lower)) {
    const text = await ocrImage(buffer);
    return { text: cleanRaw(text), method: "ocr-image" };
  }

  // Plain text, Markdown, CSV, etc.
  return { text: cleanRaw(buffer.toString("utf-8")), method: "raw" };
}

// ---------------------------------------------------------------------------
// PDF path
// ---------------------------------------------------------------------------

const MAX_OCR_PAGES = 100; // Safety cap — avoid hanging on huge scans

async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const result = await pdf(buffer);
  const rawText = result.text.trim();
  const totalPages = result.numpages;

  const charsPerPage = rawText.length / Math.max(totalPages, 1);

  if (charsPerPage > 50) {
    // ✅ Clean text-layer PDF
    return { text: cleanRaw(rawText), pages: totalPages, method: "text" };
  }

  // ⭐ Scanned PDF — fall through to OCR
  console.log(
    `[parseDoc] Scanned PDF detected (${charsPerPage.toFixed(1)} chars/page). ` +
    `Running OCR on ${Math.min(totalPages, MAX_OCR_PAGES)} page(s).`
  );

  const text = await ocrScannedPdf(buffer, totalPages);
  return { text: cleanRaw(text), pages: totalPages, method: "ocr-pdf" };
}

// ---------------------------------------------------------------------------
// Scanned PDF → pdfjs render → tesseract OCR
// ---------------------------------------------------------------------------

async function ocrScannedPdf(
  buffer: Buffer,
  totalPages: number
): Promise<string> {
  // pdfjs-dist works in Node via a lightweight OffscreenCanvas polyfill.
  // We use the legacy CJS build to avoid ESM/CJS interop issues in Next.js.
  let pdfjsLib: Awaited<ReturnType<typeof loadPdfjs>>;
  try {
    pdfjsLib = await loadPdfjs();
  } catch {
    console.error("[parseDoc] pdfjs-dist failed to load — returning empty text.");
    return "";
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    // Disable font loading in Node — we only need page geometry for rendering.
    disableFontFace: true,
    verbosity: 0,
  });

  const pdfDoc = await loadingTask.promise;
  const pagesToProcess = Math.min(pdfDoc.numPages, MAX_OCR_PAGES);

  if (totalPages > MAX_OCR_PAGES) {
    console.warn(
      `[parseDoc] PDF has ${totalPages} pages — only OCR-ing first ${MAX_OCR_PAGES}.`
    );
  }

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const imageBuffer = await renderPageToBuffer(page);
    if (!imageBuffer) continue;

    const text = await ocrImage(imageBuffer);
    if (text.trim()) {
      pageTexts.push(text);
    }
  }

  return pageTexts.join("\n\n--- page break ---\n\n");
}

/** Lazily import pdfjs-dist so the bundle is only loaded when needed. */
async function loadPdfjs() {
  // Try legacy build first (CJS-friendly), fall back to the default export.
  try {
    return await import(
      /* webpackIgnore: true */ "pdfjs-dist/legacy/build/pdf.mjs"
    );
  } catch {
    return await import("pdfjs-dist");
  }
}

/**
 * Render a pdfjs page to a PNG Buffer using an OffscreenCanvas shim.
 * Returns null if rendering is not possible in the current environment.
 */
async function renderPageToBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any
): Promise<Buffer | null> {
  const scale = 2.0; // 2× for better OCR accuracy
  const viewport = page.getViewport({ scale });

  // Use the canvas package if available (best quality).
  // Gracefully degrade to a no-op if not installed.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require("canvas");
    const canvas = createCanvas(
      Math.round(viewport.width),
      Math.round(viewport.height)
    );
    const ctx = canvas.getContext("2d");

    await page.render({
      canvas,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasContext: ctx as any,
      viewport,
    }).promise;

    return canvas.toBuffer("image/png");
  } catch {
    // 'canvas' not installed — fall back to OffscreenCanvas (available in
    // Node 18+ via the `--experimental-vm-modules` flag or in Vercel Edge).
    try {
      const offscreen = new OffscreenCanvas(
        Math.round(viewport.width),
        Math.round(viewport.height)
      );
      const ctx = offscreen.getContext("2d");
      if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({
        canvas: offscreen,
        canvasContext: ctx,
        viewport,
      } as any).promise;
      const blob = await offscreen.convertToBlob({ type: "image/png" });
      return Buffer.from(await blob.arrayBuffer());
    } catch {
      console.warn(
        "[parseDoc] No canvas available for PDF rendering. " +
        "Install the 'canvas' package or run Node with OffscreenCanvas support."
      );
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Image OCR
// ---------------------------------------------------------------------------

async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text;
  } finally {
    // Always terminate — don't leak workers in serverless environments.
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Text cleaning
// ---------------------------------------------------------------------------

function cleanRaw(text: string): string {
  return text
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .trim();
}
