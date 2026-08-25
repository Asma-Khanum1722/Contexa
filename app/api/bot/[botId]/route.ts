import { NextResponse, NextRequest } from "next/server";
import { getBotConfig, setBotConfig } from "@/lib/db";
import { verifyAuth } from "@/lib/auth-server";

// Handle CORS for widget fetches
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const config = await getBotConfig(botId);
    return NextResponse.json(config, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const { botId } = await params;
    const body = await req.json();
    // setBotConfig already syncs name/theme into the bot registry record
    await setBotConfig(botId, user.uid, body);
    
    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}

