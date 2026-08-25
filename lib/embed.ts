/**
 * lib/embed.ts
 * Embedding, chunking, and Pinecone upsert/query utilities.
 *
 * Production improvements over the hackathon version:
 *  - Sentence-boundary-aware chunking (no mid-sentence splits)
 *  - Concurrent embedding batches with inter-batch throttle (Gemini free tier safe)
 *  - Every Gemini call wrapped in withRetry()
 *  - Pinecone metadata includes filename, pageHint for richer citations
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "./env";
import { withRetry } from "./retry";
import { UpstreamError } from "./errors";

// ─── Lazy singletons ─────────────────────────────────────────────────────────
// Instantiated on first use so module evaluation at build time doesn't
// throw when env vars aren't present yet.
let _embedModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;
let _index: ReturnType<Pinecone["index"]> | null = null;

function getEmbedModel() {
  if (!_embedModel) {
    const genAI = new GoogleGenerativeAI(env("GEMINI_API_KEY"));
    _embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
  }
  return _embedModel;
}

function getIndex() {
  if (!_index) {
    const pinecone = new Pinecone({ apiKey: env("PINECONE_API_KEY") });
    _index = pinecone.index(env("PINECONE_INDEX"));
  }
  return _index;
}

// ─── Text cleaning ────────────────────────────────────────────────────────────

/**
 * Clean raw extracted text: strip null bytes, collapse excessive whitespace,
 * and remove common PDF extraction artifacts.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\0/g, "") // null bytes (common in pdf-parse output)
    .replace(/\r\n/g, "\n") // normalise line endings
    .replace(/\r/g, "\n")
    .replace(/[ \t]{3,}/g, "  ") // collapse long horizontal whitespace
    .replace(/\n{4,}/g, "\n\n\n") // collapse excessive blank lines
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "") // control chars
    .trim();
}

// ─── Sentence-boundary-aware chunker ─────────────────────────────────────────

/**
 * Splits text into chunks that respect sentence boundaries.
 * Falls back to character-level slicing if no boundary is found.
 *
 * @param size     Target chars per chunk. Default: 1000
 * @param overlap  Overlap between consecutive chunks. Default: 200
 */
export function chunkText(text: string, size = 1000, overlap = 200): string[] {
  // Sentence boundary: period/! /? followed by whitespace or end-of-string.
  const sentenceEnd = /[.!?]\s+|[.!?]$/;
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    let slice = text.slice(start, end);

    // If we're not at the end of the document, try to snap to a sentence boundary.
    if (end < text.length) {
      // Look for the last sentence-end within the slice.
      let lastBoundary = -1;
      const regex = new RegExp(sentenceEnd.source, "g");
      let match: RegExpExecArray | null;
      while ((match = regex.exec(slice)) !== null) {
        lastBoundary = match.index + match[0].length;
      }
      if (lastBoundary > size * 0.5) {
        // Only snap if the boundary is in the latter half (avoids tiny chunks).
        slice = slice.slice(0, lastBoundary);
      }
    }

    const trimmed = slice.trim();
    if (trimmed.length > 0) chunks.push(trimmed);

    if (end === text.length) break;

    // Move forward by slice length minus overlap.
    start += Math.max(slice.length - overlap, 1);
  }

  return chunks;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 3; // Stay under Gemini free tier 100 RPM
const INTER_BATCH_DELAY_MS = 2000; // Wait 2s between batches

async function embedOne(text: string): Promise<number[]> {
  return withRetry(
    async () => {
      const res = await getEmbedModel().embedContent({
        content: { role: "user", parts: [{ text }] },
        outputDimensionality: 768,
      } as any);
      return res.embedding.values;
    },
    { attempts: 4, baseDelayMs: 600 }
  );
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    // Embed batch members concurrently.
    const batchResults = await Promise.all(batch.map(embedOne));
    results.push(...batchResults);

    // Throttle between batches (not after the last one).
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
  }

  return results;
}

// ─── Pinecone upsert ─────────────────────────────────────────────────────────

export interface EmbedAndStoreOptions {
  botId: string;
  docId: string;
  text: string;
  filename?: string;
}

export async function embedAndStore({
  botId,
  docId,
  text,
  filename,
}: EmbedAndStoreOptions): Promise<{ chunksStored: number }> {
  const cleaned = cleanText(text);
  const chunks = chunkText(cleaned);

  if (chunks.length === 0) {
    throw new UpstreamError("embed", "No text content could be extracted.");
  }

  let embeddings: number[][];
  try {
    embeddings = await embedBatch(chunks);
  } catch (err) {
    throw new UpstreamError("Gemini Embeddings", String(err));
  }

  const vectors = chunks.map((chunk, i) => ({
    id: `${docId}-${i}`,
    values: embeddings[i],
    metadata: {
      text: chunk,
      docId,
      filename: filename ?? "unknown",
      chunkIndex: i,
    },
  }));

  // Pinecone upsert in batches of 100 (API limit).
  const UPSERT_BATCH = 100;
  try {
    for (let i = 0; i < vectors.length; i += UPSERT_BATCH) {
      await withRetry(
        () => getIndex().namespace(botId).upsert(vectors.slice(i, i + UPSERT_BATCH)),
        { attempts: 3 }
      );
    }
  } catch (err) {
    throw new UpstreamError("Pinecone", String(err));
  }

  return { chunksStored: vectors.length };
}

// ─── Pinecone query ───────────────────────────────────────────────────────────

export interface ContextMatch {
  text: string;
  score: number | undefined;
  docId: string;
  filename: string;
}

export async function retrieveContext(
  botId: string,
  query: string,
  topK = 6
): Promise<ContextMatch[]> {
  let vector: number[];
  try {
    vector = await embedOne(query);
  } catch (err) {
    throw new UpstreamError("Gemini Embeddings", String(err));
  }

  let results;
  try {
    results = await withRetry(
      () =>
        getIndex().namespace(botId).query({ vector, topK, includeMetadata: true }),
      { attempts: 3 }
    );
  } catch (err) {
    throw new UpstreamError("Pinecone", String(err));
  }

  return results.matches.map((m) => ({
    text: (m.metadata?.text as string) ?? "",
    score: m.score,
    docId: (m.metadata?.docId as string) ?? "",
    filename: (m.metadata?.filename as string) ?? "unknown",
  }));
}

// ─── Pinecone namespace cleanup ──────────────────────────────────────────────

/**
 * Delete all vectors in a bot's Pinecone namespace.
 * Called when a bot is deleted to avoid data leaks and wasted storage.
 */
export async function deleteBotVectors(botId: string): Promise<void> {
  try {
    await withRetry(
      () => getIndex().namespace(botId).deleteAll(),
      { attempts: 3 }
    );
  } catch (err) {
    // Log but don't throw — bot record deletion should still succeed
    console.error(`[embed] Failed to delete Pinecone namespace for bot ${botId}:`, err);
  }
}

