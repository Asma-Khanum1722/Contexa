"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";

interface ChatSession {
  sessionId: string;
  botId: string;
  ip: string;
  startedAt: number;
  lastSeenAt: number;
  messageCount: number;
  userAgent: string;
}

interface Stats {
  totalSessions: number;
  activeSessions: number;
  avgMessages: number;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function formatDuration(startedAt: number, lastSeenAt: number) {
  const diff = lastSeenAt - startedAt;
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function getBrowserName(userAgent: string) {
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
  if (userAgent.includes("Edg")) return "Edge";
  if (userAgent === "unknown") return "Unknown";
  return "Other";
}

function maskIp(ip: string) {
  if (ip === "unknown") return "Anonymous";
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  return ip.slice(0, 6) + "...";
}

function Sparkline({ data, colorClass }: { data: number[], colorClass: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 30 - ((d - min) / range) * 26;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className="w-16 h-8 overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
      <polyline 
        points={points} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={colorClass}
        style={{ vectorEffect: 'non-scaling-stroke' }}
      />
    </svg>
  );
}

export default function UsersCRMPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [stats, setStats] = useState<Stats>({ totalSessions: 0, activeSessions: 0, avgMessages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const [botsMap, setBotsMap] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const [res, botsRes] = await Promise.all([
        fetch("/api/sessions", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/bots", { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      const data = await res.json();
      const botsData = await botsRes.json();
      
      const map: Record<string, string> = {};
      if (botsData.bots) {
        botsData.bots.forEach((b: any) => { map[b.id] = b.name; });
      }
      setBotsMap(map);

      setSessions(data.sessions || []);
      setStats(data.stats || { totalSessions: 0, activeSessions: 0, avgMessages: 0 });
      setLastRefresh(Date.now());
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  const sparklineData = useMemo(() => {
    if (sessions.length === 0) return [0, 0, 0, 0, 0, 0, 0];
    const now = Date.now();
    const bins = new Array(7).fill(0);
    const binSize = (24 * 60 * 60 * 1000) / 7;
    sessions.forEach(s => {
      const age = now - s.startedAt;
      if (age < 24 * 60 * 60 * 1000) {
        const binIndex = 6 - Math.floor(age / binSize);
        if (binIndex >= 0 && binIndex < 7) bins[binIndex]++;
      }
    });
    return bins;
  }, [sessions]);

  useEffect(() => {
    if (user) {
      fetchData();
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  const filtered = sessions.filter(s =>
    s.botId.toLowerCase().includes(search.toLowerCase()) ||
    s.ip.toLowerCase().includes(search.toLowerCase()) ||
    getBrowserName(s.userAgent).toLowerCase().includes(search.toLowerCase())
  );

  const isActive = (s: ChatSession) => Date.now() - s.lastSeenAt < 5 * 60 * 1000;

  return (
    <div className="h-full bg-gray-50 dark:bg-[#0B1120] text-gray-900 dark:text-gray-100 font-sans flex transition-colors">
      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-10 py-8 flex justify-between items-end sticky top-0 z-10 bg-gray-50/90 dark:bg-[#0B1120]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-1">Chat Logs</h1>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
              Last updated {timeAgo(lastRefresh)} ·{" "}
              <button onClick={fetchData} className="text-brand-primary dark:text-brand-accent hover:underline">Refresh</button>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live tracking
            </span>
          </div>
        </div>

        <div className="p-10 space-y-8 max-w-6xl">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-6">
            <div className="p-6 bg-white dark:bg-[#0F172A] border border-gray-200/80 dark:border-gray-800 rounded-2xl shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                <span>Total Sessions</span>
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              </div>
              {loading ? (
                <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded animate-shimmer w-16"></div>
              ) : (
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalSessions.toLocaleString()}</div>
                  <Sparkline data={sparklineData} colorClass="text-indigo-500" />
                </div>
              )}
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-2">Unique user chat sessions</div>
            </div>
            
            <div className="p-6 bg-white dark:bg-[#0F172A] border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl shadow-sm transition-all hover:shadow-md bg-gradient-to-b from-emerald-50/10 to-transparent dark:from-emerald-950/10">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                <span>Active Now</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              {loading ? (
                <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded animate-shimmer w-12"></div>
              ) : (
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.activeSessions}</div>
                  <Sparkline data={sparklineData} colorClass="text-emerald-500" />
                </div>
              )}
              <div className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 mt-2">Active in last 5 mins</div>
            </div>

            <div className="p-6 bg-white dark:bg-[#0F172A] border border-purple-200/60 dark:border-purple-900/40 rounded-2xl shadow-sm transition-all hover:shadow-md bg-gradient-to-b from-purple-50/10 to-transparent dark:from-purple-950/10">
              <div className="flex items-center justify-between text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
                <span>Avg Messages</span>
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              </div>
              {loading ? (
                <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded animate-shimmer w-14"></div>
              ) : (
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.avgMessages}</div>
                </div>
              )}
              <div className="text-xs font-medium text-purple-600/70 dark:text-purple-400/70 mt-2">Messages per session</div>
            </div>
          </div>

          {/* Search & Table */}
          <div className="space-y-4">
            <div className="relative w-80">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input 
                type="text" 
                placeholder="Search by IP, bot name, browser..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-[#1E293B] transition-all shadow-sm"
              />
            </div>

            <div className="bg-white dark:bg-[#0F172A] border border-gray-200/80 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-colors">
              {loading ? (
                <div className="w-full">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div className="h-8 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-shimmer"></div>
                      <div className="h-6 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-shimmer"></div>
                      <div className="h-6 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-shimmer"></div>
                      <div className="h-6 w-12 bg-gray-100 dark:bg-gray-800 rounded animate-shimmer ml-auto"></div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-12 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                  </div>
                  <div>
                    <p className="text-gray-800 dark:text-gray-200 font-bold text-sm">No sessions recorded yet</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Sessions will appear here automatically when users chat with your bots.</p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-4 px-6 font-semibold">User Session</th>
                      <th className="py-4 px-6 font-semibold">Target Bot</th>
                      <th className="py-4 px-6 font-semibold">Live Status</th>
                      <th className="py-4 px-6 font-semibold">Messages</th>
                      <th className="py-4 px-6 font-semibold">Duration</th>
                      <th className="py-4 px-6 font-semibold text-right">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                    {filtered.map((session) => {
                      const browser = getBrowserName(session.userAgent);
                      return (
                        <tr key={session.sessionId} className="bg-white dark:bg-[#0F172A] hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-colors cursor-default">
                          <td className="py-4 px-6">
                            <div className="font-semibold text-gray-900 dark:text-gray-100 font-mono text-xs">{maskIp(session.ip)}</div>
                            <div className="mt-1">
                              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                browser === "Chrome" ? "bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border-sky-200/60 dark:border-sky-800/40" :
                                browser === "Firefox" ? "bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-200/60 dark:border-orange-800/40" :
                                browser === "Safari" ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-800/40" :
                                "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                              }`}>
                                {browser}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {botsMap[session.botId] ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
                                🤖 {botsMap[session.botId]}
                              </span>
                            ) : (
                              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-md">{session.botId.slice(0, 8)}...</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {isActive(session) ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 mr-1.5"></span>
                                Idle
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                              {session.messageCount}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-600 dark:text-gray-300 text-xs font-medium">
                            {formatDuration(session.startedAt, session.lastSeenAt)}
                          </td>
                          <td className="py-4 px-6 font-medium text-gray-400 dark:text-gray-500 text-right text-xs">
                            {timeAgo(session.lastSeenAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{filtered.length} session{filtered.length !== 1 ? "s" : ""} recorded</span>
                <span className="text-gray-400 dark:text-gray-500">Auto-refreshes every 30s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side Panel */}
      <div className="w-72 bg-white dark:bg-[#0F172A] border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto shadow-[-4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[-4px_0_24px_rgba(0,0,0,0.15)] transition-colors">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                const csv = [
                  ["Session ID", "Bot ID", "IP", "Browser", "Messages", "Duration", "Last Active"].join(","),
                  ...sessions.map(s => [
                    s.sessionId,
                    s.botId,
                    maskIp(s.ip),
                    getBrowserName(s.userAgent),
                    s.messageCount,
                    formatDuration(s.startedAt, s.lastSeenAt),
                    new Date(s.lastSeenAt).toISOString(),
                  ].join(","))
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "sessions.csv"; a.click();
              }}
              className="w-full flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-white dark:hover:bg-gray-800 hover:border-brand-primary/30 hover:shadow-sm transition-all group text-left"
            >
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-primary dark:group-hover:text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-primary dark:group-hover:text-brand-accent">Export CSV</span>
            </button>
            <button
              onClick={fetchData}
              className="w-full flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-white dark:hover:bg-gray-800 hover:border-brand-primary/30 hover:shadow-sm transition-all group text-left"
            >
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-primary dark:group-hover:text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-primary dark:group-hover:text-brand-accent">Refresh Now</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Recent Activity</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-4">
              {sessions.slice(0, 8).map((session, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${isActive(session) ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-snug">
                      {maskIp(session.ip)}
                      <span className="font-normal text-gray-400 dark:text-gray-500"> sent {session.messageCount} message{session.messageCount !== 1 ? "s" : ""}</span>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(session.lastSeenAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
