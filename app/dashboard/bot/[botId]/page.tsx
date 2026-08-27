"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface Config {
  name: string;
  themeColor: string;
  bgColor: string;
  avatarUrl: string;
}

const DEFAULT: Config = { name: "", themeColor: "#4338CA", bgColor: "#0B1120", avatarUrl: "" };

export default function BotSandboxPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const { user } = useAuth();
  const [config, setConfig] = useState<Config>(DEFAULT);
  const [savedConfig, setSavedConfig] = useState<Config>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);

  // Track unsaved changes strictly
  const hasChanges = !loading && JSON.stringify(config) !== JSON.stringify(savedConfig);

  // Load config from server when user is authenticated
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    user.getIdToken().then(token => {
      fetch(`/api/bot/${botId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (!isMounted) return;
          const c: Config = {
            name: data.name || "",
            themeColor: data.themeColor || "#4338CA",
            bgColor: data.bgColor || "#0B1120",
            avatarUrl: data.avatarUrl || "",
          };
          setConfig(c);
          setSavedConfig(c);
          setLoading(false);
        })
        .catch(() => {
          if (isMounted) setLoading(false);
        });
    });

    return () => { isMounted = false; };
  }, [botId, user]);

  // postMessage to iframe on every config change
  const postToIframe = useCallback((cfg: Config) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "sb-update", config: cfg }, "*");
  }, []);

  useEffect(() => {
    if (!loading && iframeReady.current) {
      postToIframe(config);
    }
  }, [config, loading, postToIframe]);

  const iframeSrcDoc = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { height: 100%; width: 100%; overflow: hidden; }
      body {
        background: transparent;
        display: flex; align-items: center; justify-content: center;
        font-family: system-ui, sans-serif;
      }
      .empty {
        text-align: center; color: #94A3B8;
      }
      .empty h2 { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
      .empty p { font-size: 0.8rem; }
      
      @media (prefers-color-scheme: dark) {
        .empty h2 { color: #E2E8F0; }
        .empty p { color: #94A3B8; }
      }
    </style>
  </head>
  <body>
    <div class="empty">
      <h2>Live Preview</h2>
      <p>Interact with your bot in the bottom right.</p>
    </div>
    <script src="/widget.js" data-bot="${botId}"></script>
    <script>
      // Auto-open the chat panel after widget loads
      (function poll(n) {
        if (n <= 0) return;
        var host = document.getElementById('contexa-widget-host');
        if (host && host.shadowRoot) {
          var bubble = host.shadowRoot.getElementById('sb-bubble');
          if (bubble) { bubble.click(); return; }
        }
        setTimeout(function() { poll(n - 1); }, 200);
      })(20);

      // Notify parent that iframe is ready
      window.addEventListener('load', function() {
        window.parent.postMessage({ type: 'sb-iframe-ready' }, '*');
      });
    </script>
  </body>
</html>`;

  // Listen for iframe ready + postMessage initial config
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "sb-iframe-ready") {
        iframeReady.current = true;
        // Send current config immediately after iframe is ready
        setTimeout(() => postToIframe(config), 300);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [config, postToIframe]);

  const saveConfig = async () => {
    setSaving(true);
    const token = await auth.currentUser?.getIdToken();
    await fetch(`/api/bot/${botId}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(config),
    });
    setSavedConfig(config);
    setSaving(false);
  };

  const discardChanges = () => setConfig(savedConfig);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-icon", { 
        method: "POST", 
        body: formData,
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setConfig(c => ({ ...c, avatarUrl: data.url }));
    } catch {
      alert("Failed to upload icon. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-full w-full font-sans overflow-hidden transition-colors duration-200">
      {/* Left Pane - Settings Container */}
      <div className="w-[520px] bg-white dark:bg-[#0F172A] border-r border-gray-200 dark:border-gray-800 flex relative z-10 shadow-sm transition-colors duration-200 overflow-hidden">
        
        {/* Sub-nav */}
        <div className="w-44 border-r border-gray-100 dark:border-gray-800/80 flex flex-col pt-6 bg-gray-50/70 dark:bg-[#0B1120]/70 shrink-0">
          <div className="px-4 mb-6">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group">
              <span className="p-1 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group-hover:border-indigo-300 dark:group-hover:border-indigo-600 transition-colors shadow-xs">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </span>
              Back to Bots
            </Link>
          </div>
          <nav className="flex flex-col gap-1 px-3 sticky top-6">
            <a href="#general" className="px-3 py-2 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all">General</a>
            <a href="#appearance" className="px-3 py-2 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all">Appearance</a>
            <a href="#embed" className="px-3 py-2 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all">Embed Code</a>
            <a href="#danger" className="px-3 py-2 text-xs font-semibold rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-all mt-4">Danger Zone</a>
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 flex flex-col relative h-full">
          <div className="px-8 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0 transition-colors bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-sm">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Bot Configuration</h1>
              <p className="text-xs text-gray-400 font-mono">ID: {botId}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/40 px-2.5 py-1 rounded-full">
              Live Sync
            </span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 scroll-smooth">
              
              {/* General Section */}
              <div id="general" className="space-y-4 pt-2">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  General Settings
                </h2>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Display Name</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                    placeholder="e.g. Support Bot"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-[#1E293B] transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Appearance Section */}
              <div id="appearance" className="space-y-6 pt-4">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  Appearance & Branding
                </h2>
                
                {/* Brand Color */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Brand Accent Color</label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden shrink-0 transition-colors">
                      <input type="color" value={config.themeColor} onChange={e => setConfig(c => ({ ...c, themeColor: e.target.value }))} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer border-none" />
                    </div>
                    <input
                      type="text" value={config.themeColor}
                      onChange={e => setConfig(c => ({ ...c, themeColor: e.target.value }))}
                      className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-gray-900 dark:text-white bg-white dark:bg-[#1E293B] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-sm uppercase"
                    />
                  </div>
                </div>

                {/* Background Color */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Chat Window Background</label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden shrink-0 transition-colors">
                      <input type="color" value={config.bgColor} onChange={e => setConfig(c => ({ ...c, bgColor: e.target.value }))} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer border-none" />
                    </div>
                    <input
                      type="text" value={config.bgColor}
                      onChange={e => setConfig(c => ({ ...c, bgColor: e.target.value }))}
                      className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-gray-900 dark:text-white bg-white dark:bg-[#1E293B] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-sm uppercase"
                    />
                  </div>
                </div>

                {/* Avatar Image */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Avatar Icon</label>
                  <div className="flex items-center gap-4">
                    <label className={`relative group cursor-pointer w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center shrink-0 transition-all ${config.avatarUrl ? 'border-transparent' : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50/10'} ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                      {config.avatarUrl ? (
                        <>
                          <img src={config.avatarUrl} alt="Avatar" className="w-full h-full rounded-2xl object-cover shadow-sm" />
                          <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 5v14M5 12h14"/></svg>
                          </div>
                        </>
                      ) : (
                        <>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center bg-white/80 dark:bg-[#0F172A]/80 transition-opacity">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400"><path d="M12 5v14M5 12h14"/></svg>
                          </div>
                        </>
                      )}
                    </label>
                    <div className="flex flex-col items-start gap-1">
                      {config.avatarUrl ? (
                        <button onClick={() => setConfig(c => ({ ...c, avatarUrl: "" }))} className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors px-1 pt-1">
                          Remove icon
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Click to upload custom logo</span>
                      )}
                      {uploading && <span className="text-xs font-bold text-indigo-600 animate-pulse">Uploading…</span>}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Embed Section */}
              <div id="embed" className="space-y-4 pt-4">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Website Embed Snippet
                </h2>
                
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Copy and paste this snippet anywhere before the closing <code>&lt;/body&gt;</code> tag.</p>
                  <div className="relative group">
                    <pre className="bg-gray-900 dark:bg-black/70 border border-gray-800 rounded-xl px-4 py-3.5 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all select-all transition-colors shadow-inner">
    {`<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget.js" data-bot="${botId}"></script>`}
                    </pre>
                    <button
                      onClick={() => {
                        const snippet = `<script src="${window.location.origin}/widget.js" data-bot="${botId}"></script>`;
                        navigator.clipboard.writeText(snippet);
                        const btn = document.getElementById("copy-btn");
                        if (btn) { btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = "Copy"; }, 2000); }
                      }}
                      id="copy-btn"
                      className="absolute top-2.5 right-2.5 px-3 py-1.5 text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg hover:text-white transition-all shadow-sm cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              {/* Danger Zone Section */}
              <div id="danger" className="space-y-4 pt-4 pb-8">
                <h2 className="text-sm font-bold text-red-500 border-b border-red-100 dark:border-red-900/30 pb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Danger Zone
                </h2>
                <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20">
                  <p className="text-xs text-red-600/90 dark:text-red-400 mb-3 font-medium">Permanently deletes this bot and un-indexes all vectorized knowledge.</p>
                  <button className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm cursor-pointer">
                    Delete Bot Permanently
                  </button>
                </div>
              </div>

              {/* Spacer for bottom bar */}
              <div className="h-24"></div>
            </div>
          )}

        {/* Floating Unsaved Changes Bar inside Left Pane */}
        {hasChanges && (
          <div 
            className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] animate-fade-slide-up z-20"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                Unsaved changes
              </span>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={discardChanges}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      </div>

      {/* Right Pane: Live Preview */}
      <div className="flex-1 relative flex items-center justify-center">
        <iframe
          ref={iframeRef}
          srcDoc={iframeSrcDoc}
          className="w-full h-full border-none bg-transparent"
          title="Live Preview"
        />
      </div>
    </div>
  );
}
