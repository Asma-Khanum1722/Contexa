"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface UploadEvent {
  stage: "parsing" | "embedding" | "done" | "error";
  pct?: number;
  filename?: string;
  method?: string;
  botId?: string;
  chunksStored?: number;
  embedSnippet?: string;
  error?: string;
}

interface BotRecord {
  botId: string;
  name: string;
  chunks: number;
  filenames: string[];
  createdAt: number;
  themeColor: string;
  avatarUrl: string;
  messageCount?: number;
  lastActive?: number;
}

function CountUp({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrameId: number;
    const duration = 500; // ms

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const pct = Math.min(progress / duration, 1);
      const easeOut = 1 - Math.pow(1 - pct, 3);
      setCount(Math.floor(easeOut * value));
      
      if (progress < duration) {
        animationFrameId = requestAnimationFrame(step);
      }
    };
    
    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);

  return <span>{count}</span>;
}



function PipelineTracker({ progress, pct }: { progress: UploadEvent | null, pct: number }) {
  if (!progress) return null;
  const steps = [
    { id: 'parsing', label: 'Extracting Text & Chunking' },
    { id: 'embedding', label: 'Generating Embeddings' },
    { id: 'done', label: 'Finalizing Bot' }
  ];
  
  const currentStepIdx = progress.stage === 'done' ? 2 : steps.findIndex(s => s.id === progress.stage);
  const activeIdx = currentStepIdx === -1 ? 0 : currentStepIdx;
  
  return (
    <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Processing Document Pipeline</h3>
        <span className="text-xs font-mono font-medium text-brand-primary">{pct}%</span>
      </div>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isPast = activeIdx > idx || progress.stage === 'done';
          const isCurrent = activeIdx === idx && progress.stage !== 'done';
          
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${isPast ? 'bg-green-500 text-white' : isCurrent ? 'bg-brand-primary text-white shadow-[0_0_10px_rgba(67,56,202,0.5)]' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}>
                {isPast ? '✓' : idx + 1}
              </div>
              <span className={`text-sm font-medium ${isPast ? 'text-gray-900 dark:text-gray-200' : isCurrent ? 'text-brand-primary dark:text-brand-accent' : 'text-gray-400 dark:text-gray-500'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mt-5">
        <div className="h-full bg-brand-primary dark:bg-brand-accent transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-gray-400 dark:text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const IconFile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-gray-400 dark:text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const IconBot = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
    <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4M8 15h0M16 15h0" strokeLinecap="round" />
  </svg>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [progress, setProgress] = useState<UploadEvent | null>(null);
  const [pct, setPct] = useState(0);
  const [result, setResult] = useState<{ botId: string; snippet: string; chunks: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [botName, setBotName] = useState("");
  const [loading, setLoading] = useState(false);
  const [botsLoading, setBotsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch bots from server — waits for auth to be ready
  const fetchBots = async () => {
    try {
      setBotsLoading(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setBotsLoading(false); return; }
      const res = await fetch("/api/bots", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setBots(data.bots || []);
    } catch {
      setBots([]);
    } finally {
      setBotsLoading(false);
    }
  };

  useEffect(() => { if (user) fetchBots(); }, [user]);

  useEffect(() => {
    let dragCounter = 0;
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      setIsDraggingGlobal(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) setIsDraggingGlobal(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDraggingGlobal(false);
      if (e.dataTransfer?.files?.length) {
        setFiles(prev => [...prev, ...Array.from(e.dataTransfer!.files)]);
      }
    };
    const handleDragOver = (e: DragEvent) => e.preventDefault();

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback(() => setIsDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };
  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  async function handleUpload() {
    if (!files.length) {
      setError("Please select at least one file to upload.");
      return;
    }
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 25 * 1024 * 1024) {
      setError("Total file size exceeds the 25MB limit. Please remove some files.");
      return;
    }
    
    setLoading(true); setError(null); setResult(null); setProgress(null); setPct(0);

    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (botName.trim()) form.append("botName", botName.trim());

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/upload", { 
        method: "POST", 
        body: form,
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.status === 429 || res.status === 403) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Request failed");
      }
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as UploadEvent;
            setProgress(event);
            if (event.pct !== undefined) setPct(event.pct);

            if (event.stage === "done" && event.botId && event.embedSnippet) {
              setResult({ botId: event.botId, snippet: event.embedSnippet, chunks: event.chunksStored ?? 0 });
              setFiles([]); setBotName("");
              // Refresh bots list from server
              await fetchBots();
            } else if (event.stage === "error") {
              setError(event.error ?? "An unknown error occurred.");
            }
          } catch {}
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setLoading(false); setPct(0);
    }
  }

  const deleteBot = async (botId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch("/api/bots", {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ botId }),
      });
      setBots(prev => prev.filter(b => b.botId !== botId));
    } catch {}
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  };

  return (
    <div className="font-sans min-h-full relative">
      {/* Global Drag Overlay */}
      {isDraggingGlobal && (
        <div className="fixed inset-0 z-50 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-sm m-4 rounded-3xl border-4 border-dashed border-brand-primary flex flex-col items-center justify-center text-brand-primary dark:text-brand-accent pointer-events-none transition-all">
          <IconUpload />
          <h2 className="text-2xl font-bold mt-4">Drop files anywhere to upload</h2>
          <p className="text-sm font-medium opacity-80 mt-2">We'll automatically start processing them.</p>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-8 py-16 space-y-10">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white transition-colors">
            Create a new Chatbot
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium transition-colors">
            Upload PDFs, scanned images, or text documents to generate an embedded AI agent instantly.
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-colors">
          <div 
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-12 m-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 border-2 border-dashed rounded-xl ${
              isDragging 
                ? 'bg-brand-primary/5 border-brand-primary text-brand-primary dark:bg-brand-primary/10' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <div className={`mb-4 p-3 rounded-full ${isDragging ? 'bg-brand-primary/10' : 'bg-gray-50 dark:bg-gray-800'}`}>
              <IconUpload />
            </div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1">Click to upload or drag and drop</h2>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">PDF, PNG, JPG or TXT (max. 25MB)</p>
            <input ref={fileInputRef} type="file" multiple onChange={onFileChange} accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" className="hidden" />
          </div>

          {files.length > 0 && (
            <div className="px-6 pb-4">
              <div className="border border-gray-100 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm">
                        <IconFile />
                      </div>
                      <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-6 pb-6 pt-2 flex flex-col sm:flex-row gap-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0F172A] mt-2 transition-colors">
            <div className="flex-1 mt-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Bot Name (Optional)</label>
              <input 
                type="text" 
                value={botName}
                onChange={e => setBotName(e.target.value)}
                placeholder="e.g. Acme Inc. Sales Bot"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary bg-white dark:bg-[#1E293B] transition-all shadow-sm"
              />
            </div>
            <div className="flex items-end mt-4">
              <button 
                onClick={handleUpload}
                disabled={loading || files.length === 0}
                className="w-full sm:w-auto bg-brand-primary text-white px-8 py-2.5 rounded-lg font-medium text-sm hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-transparent dark:border-indigo-400/30 dark:shadow-[0_0_15px_rgba(67,56,202,0.2)] flex items-center justify-center gap-2 h-[42px]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </>
                ) : "Create Bot →"}
              </button>
            </div>
          </div>

          {loading && progress && (
            <PipelineTracker progress={progress} pct={pct} />
          )}

          {error && (
            <div className="p-6 border-t border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium text-sm rounded-b-2xl transition-colors">
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Result Card */}
        {result && (
          <div className="bg-white dark:bg-[#0F172A] border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-6 shadow-sm relative overflow-hidden transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-2xl"></div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              Bot Successfully Created
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-4">ID: {result.botId} · {result.chunks} data chunks embedded</p>
            <div className="bg-gray-900 dark:bg-black/50 border dark:border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Embed Code</p>
              <div className="font-code text-sm text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
                {result.snippet}
              </div>
            </div>
          </div>
        )}

        {/* Bots List */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">Your Bots</h2>
          </div>
          
          {botsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white dark:bg-[#0F172A] border border-gray-100 dark:border-gray-800/50 rounded-xl p-5 shadow-sm h-[180px] flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg animate-shimmer mb-3"></div>
                    <div className="w-3/4 h-5 rounded-md animate-shimmer mb-2"></div>
                    <div className="w-1/2 h-4 rounded-md animate-shimmer"></div>
                  </div>
                  <div className="w-full h-9 rounded-lg animate-shimmer mt-4"></div>
                </div>
              ))}
            </div>
          )}
          
          {!botsLoading && bots.length === 0 && (
            <div className="bg-white dark:bg-[#0F172A] border border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-10 text-center transition-colors">
              <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center mx-auto mb-3 text-gray-400 dark:text-gray-500">
                <IconBot />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No bots yet. Upload your first document above to get started.</p>
            </div>
          )}

          {bots.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bots.map((bot, i) => (
                <div 
                  key={bot.botId} 
                  className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between animate-fade-slide-up hover:-translate-y-[2px]"
                  style={{ animationFillMode: "both", animationDelay: `${i * 50}ms` }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-accent flex items-center justify-center">
                          <IconBot />
                        </div>
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/50 px-2 py-1 rounded-full border border-gray-100 dark:border-gray-700">
                          <span className={`w-2 h-2 rounded-full ${bot.lastActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {bot.lastActive ? timeAgo(bot.lastActive) : "Never active"}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteBot(bot.botId)} 
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                        title="Delete bot"
                      >
                        <IconTrash />
                      </button>
                    </div>
                    <div className="flex items-end justify-between mb-1 mt-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">{bot.name}</h3>
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
                          <CountUp value={bot.chunks} /> chunks · <CountUp value={bot.messageCount || 0} /> messages
                        </p>
                      </div>
                    </div>
                    {bot.filenames?.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate" title={bot.filenames.join(", ")}>
                        📄 {bot.filenames.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                    <Link href={`/dashboard/bot/${bot.botId}`} className="flex-1 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-center py-2 rounded-lg font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-brand-primary dark:hover:text-brand-accent hover:border-brand-primary/30 dark:hover:border-brand-primary/30 transition-colors shadow-sm">
                      Configure →
                    </Link>
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
