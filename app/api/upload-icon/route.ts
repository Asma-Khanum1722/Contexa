import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";

const MAX_ICON_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

export async function POST(req: NextRequest) {
  try {
    await verifyAuth(req);
    const data = await req.formData();
    const file = data.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_ICON_SIZE) {
      return NextResponse.json({ error: "Icon must be under 2 MB" }, { status: 413 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
    }

    // Convert to base64 data URL — works on all platforms including serverless
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({ url: dataUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
