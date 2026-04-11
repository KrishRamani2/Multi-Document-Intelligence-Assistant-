"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderIcon, ArrowRightIcon } from "lucide-react";
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
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)] p-4 relative">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--foreground)] mb-4">
            <span className="text-[var(--background)] font-bold text-sm tracking-tight">Ax</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Sign in to Axiom</h1>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            Enter your credentials to continue
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-sm)] p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--foreground)]">
                Email
              </label>
              <input
                type="text"
                defaultValue="admin"
                className={cn(
                  "w-full h-9 px-3 rounded-lg text-[13px] transition-colors",
                  "bg-[var(--input-bg)] border border-[var(--input-border)]",
                  "text-[var(--foreground)] placeholder:text-[var(--muted)]",
                  "focus:outline-none focus:border-[var(--input-focus)] focus:ring-1 focus:ring-[var(--ring)]",
                )}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-[var(--foreground)]">
                  Password
                </label>
                <a href="#" className="text-[12px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Forgot?
                </a>
              </div>
              <input
                type="password"
                defaultValue="password"
                className={cn(
                  "w-full h-9 px-3 rounded-lg text-[13px] transition-colors",
                  "bg-[var(--input-bg)] border border-[var(--input-border)]",
                  "text-[var(--foreground)] placeholder:text-[var(--muted)]",
                  "focus:outline-none focus:border-[var(--input-focus)] focus:ring-1 focus:ring-[var(--ring)]",
                )}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full h-9 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-center gap-2",
                "bg-[var(--primary)] text-[var(--primary-fg)]",
                "hover:opacity-90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  Continue
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[var(--muted)] mt-4">
          By continuing, you agree to the Terms of Service
        </p>
      </div>
    </div>
  );
}
