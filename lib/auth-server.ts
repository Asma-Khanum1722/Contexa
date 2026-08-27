/**
 * lib/auth-server.ts
 *
 * Verifies Firebase ID tokens WITHOUT firebase-admin.
 * firebase-admin pulls in `jose` which is ESM-only and crashes
 * Vercel's serverless bundler. Instead we verify tokens manually
 * using Google's public JWK endpoint — zero native dependencies.
 */

import { NextRequest } from "next/server";

// Google's public JWK keys for Firebase Auth (JWK format — no X.509 parsing needed)
const GOOGLE_JWK_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.replace(/^"|"$/g, "") ?? "";

/** Minimal decoded token shape */
export interface DecodedIdToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

// ── JWK cache ────────────────────────────────────────────────────────────────
interface JWKSet {
  keys: JsonWebKey[];
}

let _jwkCache: JWKSet | null = null;
let _jwkCachedAt = 0;
const JWK_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getJWKs(): Promise<JWKSet> {
  if (_jwkCache && Date.now() - _jwkCachedAt < JWK_TTL_MS) {
    return _jwkCache;
  }
  const res = await fetch(GOOGLE_JWK_URL);
  if (!res.ok) throw new Error("Failed to fetch Google JWKs");
  _jwkCache = (await res.json()) as JWKSet;
  _jwkCachedAt = Date.now();
  return _jwkCache;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function b64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function base64urlToUint8Array(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Token verification ──────────────────────────────────────────────────────

async function verifyFirebaseToken(token: string): Promise<DecodedIdToken> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  const header = JSON.parse(b64urlDecode(parts[0]));
  const payload = JSON.parse(b64urlDecode(parts[1]));

  // ── Claim validation ──────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp <= now) throw new Error("Token expired");
  if (!payload.iat || payload.iat > now + 300) throw new Error("Token iat in future");
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`)
    throw new Error("Invalid issuer");
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error("Invalid audience");
  if (!payload.sub || typeof payload.sub !== "string")
    throw new Error("Missing sub claim");

  // ── Signature verification ────────────────────────────────────────────────
  const jwks = await getJWKs();
  const jwk = (jwks.keys as any[]).find((k: any) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown kid — key not found in Google JWKs");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signatureBytes = base64urlToUint8Array(parts[2]);
  const dataBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signatureBytes.buffer as ArrayBuffer,
    dataBytes.buffer as ArrayBuffer
  );

  if (!valid) throw new Error("Invalid signature");

  return {
    uid: payload.sub as string,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    ...payload,
  };
}

/**
 * Extracts and verifies the Firebase ID token from the Authorization header.
 * Returns the decoded token (which includes the userId in the `uid` field) if valid,
 * or throws an error if missing or invalid.
 */
export async function verifyAuth(req: NextRequest): Promise<DecodedIdToken> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    return await verifyFirebaseToken(token);
  } catch (error) {
    console.error("Error verifying auth token", error);
    throw new Error("Unauthorized");
  }
}
