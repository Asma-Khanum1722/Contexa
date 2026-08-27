"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";

interface Config {
  name: string;
  themeColor: string;
  bgColor: string;
  avatarUrl: string;
}

const DEFAULT: Config = { name: "", themeColor: "#4338CA", bgColor: "#0B1120", avatarUrl: "" };

export default function BotSandboxPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const [config, setConfig] = useState<Config>(DEFAULT);
  const [savedConfig, setSavedConfig] = useState<Config>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);

  // Track unsaved changes
  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig);

  // Load config from server
  useEffect(() => {
    auth.currentUser?.getIdToken().then(token => {
      fetch(`/api/bot/${botId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          const c: Config = {
            name: data.name || "",
            themeColor: data.themeColor || "#4338CA",
            bgColor: data.bgColor || "#0B1120",
            avatarUrl: data.avatarUrl || "",
          };
          setConfig(c);
          setSavedConfig(c);
          setLoading(false);
        });
    });
  }, [botId]);

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
      html, body { height: 100%; width: 100%; }
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
    <div className="flex h-full font-sans overflow-hidden transition-colors duration-200">
      {/* Left Pane */}
      <div className="w-[360px] bg-white dark:bg-[#0F172A] border-r border-gray-200 dark:border-gray-800 flex flex-col relative z-10 shadow-sm transition-colors duration-200">
        {/* Nav Header */}
        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 transition-colors">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to Bots
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Appearance</h1>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10">
            
            {/* Display Name */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Display Name</label>
              <input
                type="text"
                value={config.name}
                onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                placeholder="e.g. Support Bot"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary bg-white dark:bg-[#1E293B] transition-all shadow-sm"
              />
            </div>

            {/* Brand Color */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Brand Color</label>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden shrink-0 transition-colors">
                  <input type="color" value={config.themeColor} onChange={e => setConfig(c => ({ ...c, themeColor: e.target.value }))} className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer border-none" />
                </div>
                <input
                  type="text" value={config.themeColor}
                  onChange={e => setConfig(c => ({ ...c, themeColor: e.target.value }))}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm font-mono font-medium text-gray-900 dark:text-white bg-white dark:bg-[#1E293B] focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm uppercase"
                />
              </div>
            </div>

            {/* Background Color */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Chat Background</label>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden shrink-0 transition-colors">
                  <input type="color" value={config.bgColor} onChange={e => setConfig(c => ({ ...c, bgColor: e.target.value }))} className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer border-none" />
                </div>
                <input
                  type="text" value={config.bgColor}
                  onChange={e => setConfig(c => ({ ...c, bgColor: e.target.value }))}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm font-mono font-medium text-gray-900 dark:text-white bg-white dark:bg-[#1E293B] focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm uppercase"
                />
              </div>
            </div>

            {/* Avatar Image */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Avatar Image</label>
              <div className="flex items-center gap-4">
                <label className={`relative group cursor-pointer w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center shrink-0 transition-all ${config.avatarUrl ? 'border-transparent' : 'border-gray-300 dark:border-gray-600 hover:border-brand-primary dark:hover:border-brand-accent hover:bg-brand-primary/5 dark:hover:bg-brand-accent/5'} ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  {config.avatarUrl ? (
                    <>
                      <img src={config.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover shadow-sm" />
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 5v14M5 12h14"/></svg>
                      </div>
                    </>
                  ) : (
                    <>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-500 group-hover:text-brand-primary dark:group-hover:text-brand-accent transition-colors"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center bg-white/80 dark:bg-[#0F172A]/80 transition-opacity">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-primary dark:text-brand-accent"><path d="M12 5v14M5 12h14"/></svg>
                      </div>
                    </>
                  )}
                </label>
                <div className="flex flex-col items-start gap-1">
                  {config.avatarUrl ? (
                    <button onClick={() => setConfig(c => ({ ...c, avatarUrl: "" }))} className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors px-1 pt-1">
                      Remove photo
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Click to upload avatar</span>
                  )}
                  {uploading && <span className="text-xs font-medium text-brand-primary">Uploading…</span>}
                </div>
              </div>
            </div>
            {/* Embed Code */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Embed Code</label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Paste this snippet into any website&apos;s HTML to add the chatbot.</p>
              <div className="relative group">
                <pre className="bg-gray-50 dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-all select-all transition-colors">
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
                  className="absolute top-2 right-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Spacer for bottom bar */}
            <div className="h-16"></div>          </div>
        )}

        {/* Floating Unsaved Changes Bar inside Left Pane */}
        <div 
          className={`absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-[#0F172A] border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] dark:shadow-[0_-4px_10px_rgba(0,0,0,0.2)] transition-transform duration-300 ${hasChanges && !loading ? "translate-y-0" : "translate-y-[100%]"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">Unsaved changes</span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={discardChanges}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Discard
              </button>
              <button
                onClick={saveConfig}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
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
