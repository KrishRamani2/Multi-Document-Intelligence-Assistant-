"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LoaderIcon, LockIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      router.push("/chat");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)] p-4 relative overflow-hidden transition-theme">
      {/* Theme toggle - top left */}
      <div className="absolute top-5 left-5 z-20">
        <ThemeToggle />
      </div>

      {/* Ambient glow effects */}
      <div className="absolute inset-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.06] dark:bg-indigo-500/[0.08] rounded-full filter blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-500/[0.06] dark:bg-violet-500/[0.08] rounded-full filter blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-500/[0.03] dark:bg-fuchsia-500/[0.04] rounded-full filter blur-[180px]" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-[420px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Card */}
        <div className="bg-[var(--surface)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border)] shadow-[var(--shadow-xl)] rounded-3xl p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/20"
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            >
              <SparklesIcon className="w-7 h-7 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight mb-2 gradient-text-light">
              Welcome back
            </h1>
            <p className="text-sm text-[var(--muted)] font-medium">
              Enter your credentials to access the dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-[var(--foreground)] ml-1">
                Username
              </label>
              <input
                type="text"
                defaultValue="admin"
                className={cn(
                  "w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  "bg-[var(--surface-hover)] dark:bg-[rgba(255,255,255,0.04)]",
                  "border border-[var(--border)] hover:border-[var(--border-hover)]",
                  "text-[var(--foreground)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/40",
                  "placeholder:text-[var(--muted)]/50"
                )}
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-[var(--foreground)] ml-1">
                Password
              </label>
              <input
                type="password"
                defaultValue="password"
                className={cn(
                  "w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  "bg-[var(--surface-hover)] dark:bg-[rgba(255,255,255,0.04)]",
                  "border border-[var(--border)] hover:border-[var(--border-hover)]",
                  "text-[var(--foreground)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/40",
                  "placeholder:text-[var(--muted)]/50"
                )}
                placeholder="Enter password"
              />
            </div>

            {/* Remember me / Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded-md border border-[var(--border)] bg-[var(--surface-hover)] accent-[var(--accent)]"
                  defaultChecked
                />
                <span className="text-[13px] text-[var(--muted)] font-medium">Remember me</span>
              </label>
              <a href="#" className="text-[13px] text-[var(--accent)] font-medium hover:underline">
                Forgot?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full mt-2 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2",
                "bg-gradient-to-r from-indigo-500 to-violet-600 text-white",
                "shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30",
                "hover:from-indigo-600 hover:to-violet-700",
                "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50",
                isLoading ? "opacity-80 cursor-not-allowed" : ""
              )}
            >
              {isLoading ? <LoaderIcon className="w-4 h-4 animate-spin" /> : null}
              <span>{isLoading ? "Authenticating..." : "Sign In"}</span>
            </button>
          </form>
        </div>

        {/* Footer text */}
        <motion.p
          className="text-center text-[12px] text-[var(--muted)] mt-6 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Secured by Akarshak · Privacy Policy
        </motion.p>
      </motion.div>
    </div>
  );
}
