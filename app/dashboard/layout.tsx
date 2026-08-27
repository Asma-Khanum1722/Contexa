"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { CommandPalette } from "@/components/CommandPalette";
import { Bot, Users } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-[#0B1120]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  const navItems = [
    { href: "/dashboard", label: "My Bots", icon: <Bot size={20} /> },
    { href: "/dashboard/users", label: "Chat Logs", icon: <Users size={20} /> },
  ];

  const userInitials = user.displayName 
    ? user.displayName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : user.email?.substring(0, 2).toUpperCase() || "U";

  const isBotSettings = pathname.startsWith("/dashboard/bot/");

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0B1120] text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      {!isBotSettings && (
        <aside className="w-64 bg-white dark:bg-[#0F172A] border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 shadow-sm z-10 relative transition-colors duration-200">
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <Link href="/dashboard" className="text-brand-primary dark:text-gray-100 transition-colors">
              <Logo />
            </Link>
            <ThemeToggle />
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            <div className="px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Overview</div>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? "bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-accent" 
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  <div className={`${isActive ? "text-brand-primary dark:text-brand-accent" : "text-gray-400 dark:text-gray-500"}`}>
                    {item.icon}
                  </div>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          
          {/* Bottom actions */}
          <div className="p-4 flex flex-col gap-3 shrink-0 border-t border-gray-100 dark:border-gray-800">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 transition-colors flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full object-cover shadow-sm border border-white dark:border-gray-700" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-primary to-blue-500 flex items-center justify-center text-white text-sm font-semibold shadow-sm border border-white dark:border-gray-700">
                    {userInitials}
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-200 leading-none mb-1 truncate">{user.displayName || "User"}</p>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="w-full text-left text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors py-1.5 px-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Sign Out
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col bg-gray-50/50 dark:bg-[#0B1120] transition-colors duration-200 shadow-inner ${isBotSettings ? "overflow-hidden" : "overflow-y-auto"}`}>
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
