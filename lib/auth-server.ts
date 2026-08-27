import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";

let _app: App | undefined;

function getAdminApp(): App {
  if (!_app) {
    if (getApps().length > 0) {
      _app = getApps()[0];
    } else {
      _app = initializeApp({
        // In production, you would want to use a service account key here.
        // For now, initializing with just the projectId allows verifyIdToken to work
        // by fetching the public keys for the project.
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.replace(/^"|"$/g, ""),
      });
    }
  }
  return _app;
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
    const decodedToken = await getAuth(getAdminApp()).verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Error verifying auth token", error);
    throw new Error("Unauthorized");
  }
}
