"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actions = [
    { id: "home", title: "Go to Dashboard", href: "/dashboard" },
    { id: "logs", title: "View Chat Logs", href: "/dashboard/users" },
  ];

  const filtered = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-fade-slide-up">
        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <Search className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 text-lg"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="px-2 py-1 text-[10px] font-bold tracking-widest text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">ESC</div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No results found.</div>
          ) : (
            filtered.map((action) => (
              <button
                key={action.id}
                className="w-full flex items-center px-4 py-3 text-left rounded-xl hover:bg-brand-primary/5 dark:hover:bg-brand-primary/10 hover:text-brand-primary text-gray-700 dark:text-gray-300 transition-colors group"
                onClick={() => {
                  router.push(action.href);
                  setIsOpen(false);
                }}
              >
                <span className="font-medium text-sm">{action.title}</span>
                <span className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity">Jump →</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
