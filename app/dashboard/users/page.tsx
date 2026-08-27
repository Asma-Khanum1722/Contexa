"use client";

import React, { useState, useEffect, useCallback } from "react";
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

export default function UsersCRMPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [stats, setStats] = useState<Stats>({ totalSessions: 0, activeSessions: 0, avgMessages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const fetchData = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/sessions", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setSessions(data.sessions || []);
      setStats(data.stats || { totalSessions: 0, activeSessions: 0, avgMessages: 0 });
      setLastRefresh(Date.now());
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

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
            <div className="p-6 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm transition-colors">
              <div className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Total Sessions
              </div>
              {loading ? (
                <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-16"></div>
              ) : (
                <div className="text-3xl font-semibold text-gray-900 dark:text-white">{stats.totalSessions.toLocaleString()}</div>
              )}
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-2">Unique chat sessions</div>
            </div>
            <div className="p-6 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm transition-colors">
              <div className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Active Now
              </div>
              {loading ? (
                <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-12"></div>
              ) : (
                <div className="text-3xl font-semibold text-brand-primary dark:text-brand-accent">{stats.activeSessions}</div>
              )}
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-2">Active in last 5 mins</div>
            </div>
            <div className="p-6 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm transition-colors">
              <div className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Avg Messages
              </div>
              {loading ? (
                <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-14"></div>
              ) : (
                <div className="text-3xl font-semibold text-gray-900 dark:text-white">{stats.avgMessages}</div>
              )}
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-2">Messages per session</div>
            </div>
          </div>

          {/* Search & Table */}
          <div className="space-y-4">
            <div className="relative w-72">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input 
                type="text" 
                placeholder="Search sessions..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary bg-white dark:bg-[#1E293B] transition-all shadow-sm"
              />
            </div>

            <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden transition-colors">
              {loading ? (
                <div className="p-10 flex flex-col items-center gap-3">
                  <svg className="animate-spin h-6 w-6 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Loading sessions...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-12 flex flex-col items-center gap-3 text-center">
                  <svg className="w-10 h-10 text-gray-200 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                  <div>
                    <p className="text-gray-600 dark:text-gray-300 font-semibold text-sm">No sessions yet</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Sessions will appear here when users interact with your embedded bots.</p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-4 px-6 font-medium">Session</th>
                      <th className="py-4 px-6 font-medium">Bot</th>
                      <th className="py-4 px-6 font-medium">Status</th>
                      <th className="py-4 px-6 font-medium">Messages</th>
                      <th className="py-4 px-6 font-medium">Duration</th>
                      <th className="py-4 px-6 font-medium text-right">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((session) => (
                      <tr key={session.sessionId} className="bg-white dark:bg-[#0F172A] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-default">
                        <td className="py-4 px-6">
                          <div className="font-semibold text-gray-900 dark:text-gray-200 font-mono text-xs">{maskIp(session.ip)}</div>
                          <div className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">{getBrowserName(session.userAgent)}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">{session.botId.slice(0, 8)}...</span>
                        </td>
                        <td className="py-4 px-6">
                          {isActive(session) ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600 mr-1.5"></span>
                              Idle
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-200">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-primary dark:text-brand-accent"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            {session.messageCount}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-500 dark:text-gray-400 text-xs font-medium">
                          {formatDuration(session.startedAt, session.lastSeenAt)}
                        </td>
                        <td className="py-4 px-6 font-medium text-gray-400 dark:text-gray-500 text-right text-xs">
                          {timeAgo(session.lastSeenAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors">
                <span>{filtered.length} session{filtered.length !== 1 ? "s" : ""}</span>
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
