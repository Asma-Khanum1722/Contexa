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
  messageCount?: number;
  lastActive?: number;
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

let _redis: Redis | null = null;
let _redisUnavailableUntil = 0;

function markRedisUnavailable(err: unknown) {
  _redisUnavailableUntil = Date.now() + 60_000;
  console.warn("[db] Redis unreachable, disabling for 60s:", (err as any)?.message || err);
}

function getRedis() {
  if (Date.now() < _redisUnavailableUntil) return null;
  if (!_redis) {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      _redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL.replace(/^"|"$/g, ""),
        token: process.env.UPSTASH_REDIS_REST_TOKEN.replace(/^"|"$/g, ""),
      });
    }
  }
  return _redis;
}

// Fallback in-memory map for local development or if Redis is temporarily unreachable
const inMemoryStore = new Map<string, BotConfig>();
const inMemoryBots: BotRecord[] = [];
const inMemorySessions: ChatSession[] = [];

// ─── Bot Config ───────────────────────────────────────────────────────────────

export async function getBotConfig(botId: string): Promise<BotConfig> {
  const redis = getRedis();
  if (redis) {
    try {
      const config = await redis.get<BotConfig>(`bot_config:${botId}`);
      return { ...DEFAULT_CONFIG, ...(config || {}) };
    } catch (e) {
      markRedisUnavailable(e);
      console.warn("[db] Redis getBotConfig error, using in-memory store:", e);
    }
  }
  return inMemoryStore.get(botId) || DEFAULT_CONFIG;
}

export async function setBotConfig(botId: string, userId: string, config: Partial<BotConfig>): Promise<void> {
  const current = await getBotConfig(botId);
  const updated = { ...current, ...config };
  
  const redis = getRedis();
  if (redis) {
    try {
      const bot = await redis.get<BotRecord>(`bot_record:${botId}`);
      if (bot && bot.userId !== userId) throw new Error("Unauthorized");

      await redis.set(`bot_config:${botId}`, updated);
      
      if (config.name !== undefined && bot) {
        bot.name = config.name!;
        bot.themeColor = updated.themeColor;
        bot.avatarUrl = updated.avatarUrl;
        await redis.set(`bot_record:${botId}`, bot);
      }
      return;
    } catch (e: any) {
      if (e.message === "Unauthorized") throw e;
      markRedisUnavailable(e);
      console.warn("[db] Redis setBotConfig error, using in-memory store:", e);
    }
  }
  inMemoryStore.set(botId, updated);
}

// ─── Bot Registry ─────────────────────────────────────────────────────────────

export async function registerBot(bot: BotRecord): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`bot_record:${bot.botId}`, bot);
      await redis.zadd(`bots_by_user:${bot.userId}`, { score: bot.createdAt, member: bot.botId });
      return;
    } catch (e) {
      markRedisUnavailable(e);
      console.warn("[db] Redis registerBot error, using in-memory store:", e);
    }
  }
  inMemoryBots.unshift(bot);
}

export async function listBots(userId: string): Promise<BotRecord[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const botIds = await redis.zrange(`bots_by_user:${userId}`, 0, -1, { rev: true }) as string[];
      if (!botIds || botIds.length === 0) return [];
      
      const keys = botIds.map(id => `bot_record:${id}`);
      const records = await redis.mget<BotRecord[]>(...keys);
      return records.filter((r): r is BotRecord => r !== null);
    } catch (e) {
      markRedisUnavailable(e);
      console.warn("[db] Redis listBots error, using in-memory store:", e);
    }
  }
  return inMemoryBots.filter(b => b.userId === userId);
}

export async function getBot(botId: string): Promise<BotRecord | null> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.get<BotRecord>(`bot_record:${botId}`);
    } catch (e) {
      markRedisUnavailable(e);
      console.warn("[db] Redis getBot error, using in-memory store:", e);
    }
  }
  return inMemoryBots.find(b => b.botId === botId) || null;
}

export async function deleteBot(botId: string, userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      const bot = await redis.get<BotRecord>(`bot_record:${botId}`);
      if (bot && bot.userId !== userId) throw new Error("Unauthorized");

      await Promise.all([
        redis.del(`bot_record:${botId}`),
        redis.del(`bot_config:${botId}`),
        redis.zrem(`bots_by_user:${userId}`, botId),
        redis.zrem("bots_index", botId),
      ]);
      return;
    } catch (e: any) {
      if (e.message === "Unauthorized") throw e;
      console.warn("[db] Redis deleteBot error, using in-memory store:", e);
    }
  }
  const idx = inMemoryBots.findIndex(b => b.botId === botId && b.userId === userId);
  if (idx !== -1) inMemoryBots.splice(idx, 1);
  inMemoryStore.delete(botId);
}

export async function getUserBotCount(userId: string): Promise<number> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.zcard(`bots_by_user:${userId}`);
    } catch (e) {
      console.warn("[db] Redis getUserBotCount error, using in-memory store:", e);
    }
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
    try {
      const existing = await redis.get<ChatSession>(key);
      if (existing) {
        existing.lastSeenAt = now;
        existing.messageCount += 1;
        await redis.set(key, existing, { ex: 60 * 60 * 24 * 30 });
      } else {
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
        await redis.zadd(`sessions:${botId}`, { score: now, member: sessionId });
        await redis.zadd("sessions_index", { score: now, member: sessionId });
      }
      
      const botKey = `bot_record:${botId}`;
      const bot = await redis.get<BotRecord>(botKey);
      if (bot) {
        bot.messageCount = (bot.messageCount || 0) + 1;
        bot.lastActive = now;
        await redis.set(botKey, bot);
      }
      return;
    } catch (e) {
      console.warn("[db] Redis trackChatSession error, using in-memory store:", e);
    }
  }
  
  const existing = inMemorySessions.find(s => s.sessionId === sessionId);
  if (existing) {
    existing.lastSeenAt = now;
    existing.messageCount += 1;
  } else {
    inMemorySessions.push({ sessionId, botId, ip, startedAt: now, lastSeenAt: now, messageCount: 1, userAgent });
  }
}

export async function listSessions(limit = 100): Promise<ChatSession[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const sessionIds = await redis.zrange("sessions_index", 0, limit - 1, { rev: true }) as string[];
      if (!sessionIds || sessionIds.length === 0) return [];
      
      const keys = sessionIds.map(id => `session:${id}`);
      const sessions = await redis.mget<ChatSession[]>(...keys);
      return sessions.filter((s): s is ChatSession => s !== null);
    } catch (e) {
      console.warn("[db] Redis listSessions error, using in-memory store:", e);
    }
  }
  return [...inMemorySessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
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
