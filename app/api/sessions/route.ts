import { NextResponse, NextRequest } from "next/server";
import { listSessions, getSessionStats, listBots } from "@/lib/db";
import { verifyAuth } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const [sessions, stats, bots] = await Promise.all([
      listSessions(100),
      getSessionStats(),
      listBots(user.uid),
    ]);
    // Only return sessions belonging to the user's bots
    const userBotIds = new Set(bots.map(b => b.botId));
    const userSessions = sessions.filter(s => userBotIds.has(s.botId));
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const userStats = {
      totalSessions: userSessions.length,
      activeSessions: userSessions.filter(s => s.lastSeenAt > fiveMinAgo).length,
      avgMessages: userSessions.length > 0
        ? Math.round(userSessions.reduce((sum, s) => sum + s.messageCount, 0) / userSessions.length)
        : 0,
    };
    return NextResponse.json({ sessions: userSessions, stats: userStats });
  } catch (err: any) {
    if (err.message === "Unauthorized" || err.message === "Missing or invalid Authorization header") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

