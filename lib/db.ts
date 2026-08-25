import { Redis } from "@upstash/redis";

export interface BotConfig {
  name: string;
  themeColor: string;
  bgColor: string;
  avatarUrl: string;
}

export interface BotRecord {
  botId: string;
  userId: string;
  name: string;
  chunks: number;
  filenames: string[];
  createdAt: number;
  themeColor: string;
  avatarUrl: string;
}

export interface ChatSession {
  sessionId: string;
  botId: string;
  ip: string;
  startedAt: number;
  lastSeenAt: number;
  messageCount: number;
  userAgent: string;
}

const DEFAULT_CONFIG: BotConfig = {
  name: "ScanBrain AI",
  themeColor: "#0084C7",
  bgColor: "#0C0C14",
  avatarUrl: "",
};

// Lazy initialize Redis to avoid build-time errors if env vars are missing
let _redis: Redis | null = null;
function getRedis() {
  if (!_redis) {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      _redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    }
  }
  return _redis;
}

// Fallback in-memory map for local development without Redis
const inMemoryStore = new Map<string, BotConfig>();
const inMemoryBots: BotRecord[] = [];
const inMemorySessions: ChatSession[] = [];

// ─── Bot Config ───────────────────────────────────────────────────────────────

export async function getBotConfig(botId: string): Promise<BotConfig> {
  const redis = getRedis();
  if (redis) {
    const config = await redis.get<BotConfig>(`bot_config:${botId}`);
    return { ...DEFAULT_CONFIG, ...(config || {}) };
  } else {
    return inMemoryStore.get(botId) || DEFAULT_CONFIG;
  }
}

export async function setBotConfig(botId: string, userId: string, config: Partial<BotConfig>): Promise<void> {
  const current = await getBotConfig(botId);
  const updated = { ...current, ...config };
  
  const redis = getRedis();
  if (redis) {
    const bot = await redis.get<BotRecord>(`bot_record:${botId}`);
    if (bot && bot.userId !== userId) throw new Error("Unauthorized");

    await redis.set(`bot_config:${botId}`, updated);
    
    // Also update the name in the registry if it changed
    if (config.name !== undefined && bot) {
      bot.name = config.name!;
      bot.themeColor = updated.themeColor;
      bot.avatarUrl = updated.avatarUrl;
      await redis.set(`bot_record:${botId}`, bot);
    }
  } else {
    inMemoryStore.set(botId, updated);
  }
}

// ─── Bot Registry ─────────────────────────────────────────────────────────────

export async function registerBot(bot: BotRecord): Promise<void> {
  const redis = getRedis();
  if (redis) {
    // Store bot record as a hash
    await redis.set(`bot_record:${bot.botId}`, bot);
    // Add botId to the user's ordered set (score = createdAt timestamp)
    await redis.zadd(`bots_by_user:${bot.userId}`, { score: bot.createdAt, member: bot.botId });
  } else {
    inMemoryBots.unshift(bot);
  }
}

export async function listBots(userId: string): Promise<BotRecord[]> {
  const redis = getRedis();
  if (redis) {
    // Get all botIds ordered by creation time (newest first) for this user
    const botIds = await redis.zrange(`bots_by_user:${userId}`, 0, -1, { rev: true }) as string[];
    if (!botIds || botIds.length === 0) return [];
    
    // Fix N+1 query: Fetch all bot records in a single mget
    const keys = botIds.map(id => `bot_record:${id}`);
    const records = await redis.mget<BotRecord[]>(...keys);
    
    return records.filter((r): r is BotRecord => r !== null);
  } else {
    return inMemoryBots.filter(b => b.userId === userId);
  }
}

export async function getBot(botId: string): Promise<BotRecord | null> {
  const redis = getRedis();
  if (redis) {
    return redis.get<BotRecord>(`bot_record:${botId}`);
  } else {
    return inMemoryBots.find(b => b.botId === botId) || null;
  }
}

export async function deleteBot(botId: string, userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    const bot = await redis.get<BotRecord>(`bot_record:${botId}`);
    if (bot && bot.userId !== userId) throw new Error("Unauthorized");

    await Promise.all([
      redis.del(`bot_record:${botId}`),
      redis.del(`bot_config:${botId}`),
      redis.zrem(`bots_by_user:${userId}`, botId),
      redis.zrem("bots_index", botId), // cleanup old index
    ]);
  } else {
    const idx = inMemoryBots.findIndex(b => b.botId === botId && b.userId === userId);
    if (idx !== -1) inMemoryBots.splice(idx, 1);
    inMemoryStore.delete(botId);
  }
}

export async function getUserBotCount(userId: string): Promise<number> {
  const redis = getRedis();
  if (redis) {
    return await redis.zcard(`bots_by_user:${userId}`);
  }
  return inMemoryBots.filter(b => b.userId === userId).length;
}

// ─── Chat Session Tracking ────────────────────────────────────────────────────

export async function trackChatSession(
  botId: string,
  sessionId: string,
  ip: string,
  userAgent: string
): Promise<void> {
  const redis = getRedis();
  const now = Date.now();
  const key = `session:${sessionId}`;
  
  if (redis) {
    const existing = await redis.get<ChatSession>(key);
    if (existing) {
      // Update existing session
      existing.lastSeenAt = now;
      existing.messageCount += 1;
      await redis.set(key, existing, { ex: 60 * 60 * 24 * 30 }); // 30-day TTL
    } else {
      // New session
      const session: ChatSession = {
        sessionId,
        botId,
        ip,
        startedAt: now,
        lastSeenAt: now,
        messageCount: 1,
        userAgent,
      };
      await redis.set(key, session, { ex: 60 * 60 * 24 * 30 });
      // Add to the bot's session index
      await redis.zadd(`sessions:${botId}`, { score: now, member: sessionId });
      // Add to the global sessions index
      await redis.zadd("sessions_index", { score: now, member: sessionId });
    }
  } else {
    const existing = inMemorySessions.find(s => s.sessionId === sessionId);
    if (existing) {
      existing.lastSeenAt = now;
      existing.messageCount += 1;
    } else {
      inMemorySessions.push({ sessionId, botId, ip, startedAt: now, lastSeenAt: now, messageCount: 1, userAgent });
    }
  }
}

export async function listSessions(limit = 100): Promise<ChatSession[]> {
  const redis = getRedis();
  if (redis) {
    // Get most recent session IDs
    const sessionIds = await redis.zrange("sessions_index", 0, limit - 1, { rev: true }) as string[];
    if (!sessionIds || sessionIds.length === 0) return [];
    
    // Using mget here too for optimization
    const keys = sessionIds.map(id => `session:${id}`);
    const sessions = await redis.mget<ChatSession[]>(...keys);
    
    return sessions.filter((s): s is ChatSession => s !== null);
  } else {
    return [...inMemorySessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
  }
}

export async function getSessionStats(): Promise<{
  totalSessions: number;
  activeSessions: number;
  avgMessages: number;
}> {
  const sessions = await listSessions(1000);
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const activeSessions = sessions.filter(s => s.lastSeenAt > fiveMinAgo).length;
  const avgMessages = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.messageCount, 0) / sessions.length)
    : 0;
  return {
    totalSessions: sessions.length,
    activeSessions,
    avgMessages,
  };
}
