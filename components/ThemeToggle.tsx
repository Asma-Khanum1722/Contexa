"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Laptop } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-8 h-8 opacity-0" />;
  }

  return (
    <div className="flex items-center bg-gray-100 dark:bg-[#1E293B] p-1 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm transition-colors">
      <button
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-full transition-all ${
          theme === "light"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
        }`}
        title="Light Mode"
      >
        <Sun size={14} />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-1.5 rounded-full transition-all ${
          theme === "system"
            ? "bg-white dark:bg-[#0B1120] text-gray-900 dark:text-gray-100 shadow-sm"
            : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
        }`}
        title="System Preference"
      >
        <Laptop size={14} />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-1.5 rounded-full transition-all ${
          theme === "dark"
            ? "bg-[#0B1120] text-gray-100 shadow-sm border border-gray-700"
            : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
        }`}
        title="Dark Mode"
      >
        <Moon size={14} />
      </button>
    </div>
  );
}
