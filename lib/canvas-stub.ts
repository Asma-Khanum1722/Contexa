/**
 * lib/canvas-stub.ts
 * Empty stub for the 'canvas' package.
 * Used when the native canvas package is not installed (e.g. on Vercel).
 * The parseDoc.ts code catches the error and falls back to OffscreenCanvas.
 */
export const createCanvas = undefined;
export const loadImage = undefined;
