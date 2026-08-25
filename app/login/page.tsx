"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
      setIsSigningIn(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 overflow-hidden relative bg-white dark:bg-[#0B1120] transition-colors duration-200">
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-accent/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-md space-y-8 bg-gray-50/50 dark:bg-white/[0.03] p-10 rounded-3xl border border-gray-200 dark:border-white/[0.08] backdrop-blur-xl relative z-10 shadow-2xl">
        
        <div className="text-center flex flex-col items-center">
          <div className="mb-6 text-brand-primary dark:text-gray-100">
            <Logo className="scale-125 origin-center" iconOnly />
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome to Contexa
          </h2>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Sign in to start building your AI assistants.
          </p>
        </div>

        <div className="mt-10">
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="group relative flex w-full justify-center items-center gap-3 rounded-xl bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 px-4 py-3.5 text-sm font-semibold text-gray-900 dark:text-white transition-all hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:opacity-70 disabled:cursor-not-allowed shadow-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            {isSigningIn ? (
              <svg className="animate-spin h-5 w-5 text-gray-900 dark:text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span className="text-[15px]">{isSigningIn ? "Signing in..." : "Continue with Google"}</span>
          </button>
        </div>
        
        <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
          By signing in, you agree to our <Link href="#" className="hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2 transition-colors">Terms of Service</Link> and <Link href="#" className="hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2 transition-colors">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}
