"use client";

import { useState, useEffect } from "react";
import {
  MenuIcon,
  XIcon,
  MessageSquarePlusIcon,
  UploadCloudIcon,
  BookOpenIcon,
  NetworkIcon,
  DatabaseIcon,
  ClockIcon,
  LogOutIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { name: "New Chat", icon: MessageSquarePlusIcon, active: true },
    { name: "Upload Files", icon: UploadCloudIcon },
    { name: "Ingestion Wiki", icon: BookOpenIcon },
    { name: "Knowledge Graph", icon: NetworkIcon },
    { name: "Data Sources", icon: DatabaseIcon },
  ];

  const pastChats = [
    { title: "Discussion on Q1 Earnings", time: "2h ago" },
    { title: "Onboarding Documentation", time: "5h ago" },
    { title: "System Architecture Fixes", time: "1d ago" },
    { title: "API Refactoring Draft", time: "2d ago" },
  ];

  return (
    <div className="flex h-screen w-full bg-[var(--background)] overflow-hidden text-[var(--foreground)] transition-theme">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50",
          "flex flex-col",
          "bg-[var(--surface)] dark:bg-[rgba(12,12,14,0.95)]",
          "border-r border-[var(--border)]",
          "transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          "shadow-[var(--shadow-lg)] md:shadow-none",
          // Mobile
          isSidebarOpen ? "translate-x-0 w-[280px]" : "-translate-x-full md:translate-x-0",
          // Desktop
          !isSidebarOpen && isDesktopCollapsed && "md:w-[72px]",
          !isSidebarOpen && !isDesktopCollapsed && "md:w-[280px]"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 h-16 shrink-0 border-b border-[var(--border)]">
          <div
            className={cn(
              "flex items-center gap-3 overflow-hidden transition-all duration-300",
              isDesktopCollapsed && !isSidebarOpen
                ? "md:w-0 md:opacity-0"
                : "w-auto opacity-100"
            )}
          >
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
                <SparklesIcon className="w-4 h-4" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[var(--surface)] dark:border-[#0c0c0e]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-tight truncate">Akarshak</span>
              <span className="text-[11px] text-[var(--muted)] font-medium">Admin Panel</span>
            </div>
          </div>
          <button
            className="md:hidden p-2 hover:bg-[var(--surface-hover)] rounded-xl text-[var(--muted)] transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-1 custom-scrollbar py-3">
          {/* Main Navigation */}
          <nav className="px-3 space-y-0.5">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] px-3 py-2 transition-all",
                isDesktopCollapsed && !isSidebarOpen ? "md:hidden" : "block"
              )}
            >
              Navigation
            </p>
            {navItems.map((item, idx) => (
              <a
                key={idx}
                href="#"
                className={cn(
                  "nav-item-glow flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                  item.active
                    ? "bg-[var(--accent-light)] text-[var(--accent)] font-medium shadow-[var(--shadow-sm)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                  isDesktopCollapsed && !isSidebarOpen ? "md:justify-center md:px-0" : ""
                )}
                title={item.name}
              >
                <div className={cn(
                  "flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg transition-colors",
                  item.active
                    ? "bg-[var(--accent-medium)]"
                    : "bg-transparent group-hover:bg-[var(--surface-active)]"
                )}>
                  <item.icon className="w-[18px] h-[18px]" />
                </div>
                <span
                  className={cn(
                    "text-[13px] whitespace-nowrap transition-all font-medium",
                    isDesktopCollapsed && !isSidebarOpen ? "md:hidden" : "block"
                  )}
                >
                  {item.name}
                </span>
                {item.active && (
                  <motion.div
                    className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[var(--accent)] pulse-ring"
                    layoutId="active-indicator"
                  />
                )}
              </a>
            ))}
          </nav>

          {/* Divider */}
          <div className={cn(
            "mx-4 my-2 h-px bg-[var(--border)] transition-all",
            isDesktopCollapsed && !isSidebarOpen ? "md:mx-3" : ""
          )} />

          {/* Past Chats */}
          <div
            className={cn(
              "px-3 transition-all duration-300",
              isDesktopCollapsed && !isSidebarOpen ? "md:hidden" : "block"
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <ClockIcon className="w-3.5 h-3.5 text-[var(--muted)]" />
              <h3 className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-[0.08em]">
                Recent Chats
              </h3>
            </div>
            <div className="space-y-0.5">
              {pastChats.map((chat, idx) => (
                <a
                  key={idx}
                  href="#"
                  className="flex items-center justify-between px-3 py-2 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-xl truncate transition-all duration-200 group"
                >
                  <span className="truncate font-medium">{chat.title}</span>
                  <span className="text-[10px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                    {chat.time}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--border)] space-y-2 shrink-0">
          {/* Settings Link */}
          <a
            href="#"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all duration-200",
              isDesktopCollapsed && !isSidebarOpen ? "md:justify-center md:px-0" : ""
            )}
          >
            <SettingsIcon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className={cn(
              "text-[13px] font-medium whitespace-nowrap",
              isDesktopCollapsed && !isSidebarOpen ? "md:hidden" : "block"
            )}>
              Settings
            </span>
          </a>

          {/* User Profile */}
          <div className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] transition-all",
            isDesktopCollapsed && !isSidebarOpen ? "md:justify-center md:px-2" : ""
          )}>
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                <span className="text-[11px] font-bold text-white">AU</span>
              </div>
            </div>
            <div
              className={cn(
                "flex flex-col flex-1 min-w-0 transition-all",
                isDesktopCollapsed && !isSidebarOpen ? "md:hidden" : "block"
              )}
            >
              <span className="text-[13px] font-semibold truncate tracking-tight">Admin User</span>
              <span className="text-[11px] text-[var(--muted)] truncate">admin@akarshak.com</span>
            </div>
            <button
              className={cn(
                "p-1.5 rounded-lg text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-all",
                isDesktopCollapsed && !isSidebarOpen ? "md:hidden" : "block"
              )}
              title="Sign Out"
            >
              <LogOutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300">
        {/* Top Header Bar */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0 z-30 bg-[var(--surface)]/80 dark:bg-[rgba(9,9,11,0.8)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {/* Theme toggle in top-left area */}
            <ThemeToggle />

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-[var(--surface-hover)] text-[var(--muted)] transition-colors md:hidden"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            {/* Desktop sidebar toggle */}
            <button
              onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
              className="hidden md:flex p-2 rounded-xl hover:bg-[var(--surface-hover)] text-[var(--muted)] transition-colors"
              title="Toggle Sidebar"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-[var(--muted)] font-medium">Dashboard</span>
              <span className="text-[var(--border-hover)]">/</span>
              <span className="font-medium">Chat</span>
            </div>
          </div>

          {/* Right side of header */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold">Online</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto relative scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}
