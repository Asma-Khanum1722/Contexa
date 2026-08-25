import { NextResponse, NextRequest } from "next/server";
import { listBots, deleteBot } from "@/lib/db";
import { deleteBotVectors } from "@/lib/embed";
import { verifyAuth } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const bots = await listBots(user.uid);
    return NextResponse.json({ bots });
  } catch (err: any) {
    if (err.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const { botId } = await req.json();
    if (!botId) return NextResponse.json({ error: "botId required" }, { status: 400 });
    
    // Delete bot record and Pinecone vectors in parallel
    await Promise.all([
      deleteBot(botId, user.uid),
      deleteBotVectors(botId),
    ]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
