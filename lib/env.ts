/**
 * lib/env.ts
 * Validates all required environment variables at module-load time.
 * Import this at the top of any server module that needs env vars.
 * The app will crash loudly with a descriptive message rather than
 * silently failing mid-request.
 */

const REQUIRED = [
  "GEMINI_API_KEY",
  "PINECONE_API_KEY",
  "PINECONE_INDEX",
  "NEXT_PUBLIC_BASE_URL",
] as const;

const OPTIONAL = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

type RequiredEnvKey = (typeof REQUIRED)[number];
type OptionalEnvKey = (typeof OPTIONAL)[number];

function validate(): void {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[Contexa] Missing required environment variables:\n  ${missing.join("\n  ")}\n` +
        `Copy .env.local.example to .env.local and fill in the values.`
    );
  }

  // Warn about missing Firebase vars — auth won't work without them
  const firebaseVars = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  ];
  const missingFirebase = firebaseVars.filter((k) => !process.env[k]);
  if (missingFirebase.length > 0) {
    console.warn(
      `[Contexa] Warning: Missing Firebase env vars (${missingFirebase.join(", ")}). ` +
        `Authentication will not work.`
    );
  }
}

// Skip validation at build time — Next.js evaluates route modules during
// `next build` before .env.local values are injected into the runtime.
// Validation still fires on the first actual request in production.
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-export";

if (typeof window === "undefined" && !isBuildPhase) validate();

export function env(key: RequiredEnvKey): string {
  const val = process.env[key] as string;
  return val ? val.replace(/^"|"$/g, '').replace(/^'|'$/g, '') : val;
}

export function optionalEnv(key: OptionalEnvKey): string | undefined {
  const val = process.env[key];
  return val ? val.replace(/^"|"$/g, '').replace(/^'|'$/g, '') : val;
}
