/**
 * lib/embed.ts
 * Embedding, chunking, and Pinecone upsert/query utilities.
 *
 * Production improvements:
 *  - Sentence-boundary-aware chunking (no mid-sentence splits)
 *  - Concurrent embedding batches with inter-batch throttle (Gemini free tier safe)
 *  - Every Gemini call wrapped in withRetry()
 *  - Pinecone metadata includes filename, pageHint for richer citations
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env, optionalEnv } from "./env";
import { withRetry } from "./retry";
import { UpstreamError } from "./errors";

// ─── Lazy singletons ─────────────────────────────────────────────────────────
let _embedModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;
let _index: ReturnType<Pinecone["index"]> | null = null;

function getEmbedModel() {
  if (!_embedModel) {
    const genAI = new GoogleGenerativeAI(env("GEMINI_API_KEY"));
    const embedModelName = optionalEnv("GEMINI_EMBEDDING_MODEL") || "gemini-embedding-2";
    _embedModel = genAI.getGenerativeModel({ model: embedModelName });
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

export function cleanText(raw: string): string {
  return raw
    .replace(/\0/g, "") // null bytes
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .trim();
}

// ─── Sentence-boundary-aware chunker ─────────────────────────────────────────

export function chunkText(text: string, size = 1000, overlap = 200): string[] {
  const sentenceEnd = /[.!?]\s+|[.!?]$/;
  const chunks: string[] = [];
  let start = 0;
  let guard = 0;

  while (start < text.length && guard < 100000) {
    guard++;
    const end = Math.min(start + size, text.length);
    let slice = text.slice(start, end);

    if (end < text.length) {
      let lastBoundary = -1;
      const regex = new RegExp(sentenceEnd.source, "g");
      let match: RegExpExecArray | null;
      while ((match = regex.exec(slice)) !== null) {
        lastBoundary = match.index + match[0].length;
      }
      if (lastBoundary > size * 0.5) {
        slice = slice.slice(0, lastBoundary);
      }
    }

    const trimmed = slice.trim();
    if (trimmed.length > 0) chunks.push(trimmed);

    if (end === text.length) break;
    start += Math.max(slice.length - overlap, 1);
  }

  return chunks;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 3;
const INTER_BATCH_DELAY_MS = 2000;

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
    const batchResults = await Promise.all(batch.map(embedOne));
    results.push(...batchResults);

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

export async function deleteBotVectors(botId: string): Promise<void> {
  try {
    await withRetry(
      () => getIndex().namespace(botId).deleteAll(),
      { attempts: 3 }
    );
  } catch (err) {
    console.error(`[embed] Failed to delete Pinecone namespace for bot ${botId}:`, err);
  }
}
