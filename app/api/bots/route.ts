import { NextResponse, NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { verifyAuth } = await import("@/lib/auth-server");
    const { listBots } = await import("@/lib/db");
    
    const user = await verifyAuth(req);
    const bots = await listBots(user.uid);
    return NextResponse.json({ bots });
  } catch (err: any) {
    if (err.message === "Unauthorized" || err.message?.includes("Authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { verifyAuth } = await import("@/lib/auth-server");
    const { deleteBot } = await import("@/lib/db");
    const { deleteBotVectors } = await import("@/lib/embed");
    
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
    if (err.message === "Unauthorized" || err.message?.includes("Authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
