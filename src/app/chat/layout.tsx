"use client";

import { useState, useEffect } from "react";
import {
  PanelLeftIcon,
  PanelLeftCloseIcon,
  XIcon,
  MessageSquarePlusIcon,
  UploadCloudIcon,
  BookOpenIcon,
  NetworkIcon,
  DatabaseIcon,
  ClockIcon,
  LogOutIcon,
  SettingsIcon,
  SearchIcon,
  BellIcon,
  WebhookIcon,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { FileUploaderRegular } from "@uploadcare/react-uploader/next";
import "@uploadcare/react-uploader/core.css";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showSidebarUploader, setShowSidebarUploader] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { name: "New Chat", icon: MessageSquarePlusIcon, href: "/chat" },
    { name: "Ingestion Wiki", icon: BookOpenIcon, href: "/chat/ingestion-wiki" },
    { name: "Knowledge Graph", icon: NetworkIcon, href: "/chat/knowledge-graph" },
    { name: "Data Sources", icon: DatabaseIcon, href: "/chat/data-sources" },
    { name: "Channels Integrations", icon: WebhookIcon, href: "/chat/channels" },
  ];

  const pastChats = [
    { title: "Q1 Earnings Discussion", time: "2h" },
    { title: "Onboarding Docs Review", time: "5h" },
    { title: "Architecture Decisions", time: "1d" },
    { title: "API Refactoring Plan", time: "2d" },
  ];

  // Helper to figure out the source_type for the backend
  const determineSourceType = (fileName: string) => {
    const fn = fileName.toLowerCase();
    if (fn.endsWith('.pdf')) return 'pdf';
    if (fn.match(/\.(mp3|wav|m4a|aac|ogg)$/)) return 'audio';
    if (fn.match(/\.(jpeg|jpg|gif|png|webp)$/)) return 'image';
    if (fn.endsWith('.csv')) return 'csv';
    if (fn.endsWith('.json')) return 'json';
    if (fn.endsWith('.md')) return 'md';
    if (fn.match(/\.(html|htm)$/)) return 'html';
    if (fn.match(/\.(txt|text)$/)) return 'text';
    if (fn.endsWith('.docx') || fn.endsWith('.doc')) return 'docx';
    return 'document'; // fallback default
  };

  // Sidebar upload success handler — logs to console and triggers /ingest
  const handleSidebarUploadSuccess = async (e: any) => {
    if (e && e.cdnUrl) {
      console.log(`📁 [Sidebar] File uploaded: ${e.name}`);
      console.log(`   CDN URL: ${e.cdnUrl}`);
      console.log(`   UUID: ${e.uuid}`);
      
      const sourceType = determineSourceType(e.name);
      const payload = {
        source_type: sourceType,
        file_url: e.cdnUrl,
        source_location: "cdn",
        redact: true
      };

      try {
        console.log(`🚀 Sending ingestion request to backend proxy:`, payload);
        const res = await fetch(`/api/proxy/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log(`✅ Backend successfully queued ingestion for ${e.name}`, data);
          
          if (data.job_id) {
             const newJob = {
                job_id: data.job_id,
                document_id: data.document_id || "",
                name: e.name,
                type: determineSourceType(e.name),
                size: (e.size ? (e.size / 1024).toFixed(1) + " KB" : "Unknown"),
                uploadedAt: new Date().toISOString(),
                status: data.status || "pending",
                file_url: payload.file_url
             };
             const existing = JSON.parse(localStorage.getItem('axiom_ingestion_jobs') || '[]');
             localStorage.setItem('axiom_ingestion_jobs', JSON.stringify([newJob, ...existing]));
             window.dispatchEvent(new Event('axiom_jobs_updated'));
          }
        } else {
          console.error(`❌ Ingestion API returned an error: ${res.status}`, await res.text());
        }
      } catch (err) {
        console.error("❌ Failed to reach the /ingest API endpoint:", err);
      }
    }
  };

  const handleSidebarDoneClick = () => {
    console.log("📁 [Sidebar] Upload complete");
    setShowSidebarUploader(false);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 shrink-0">
        <div className={cn(
          "flex items-center gap-2.5 transition-all duration-200",
          isSidebarCollapsed && !isMobileSidebarOpen ? "md:opacity-0 md:w-0 md:overflow-hidden" : ""
        )}>
          <div className="w-7 h-7 rounded-lg bg-[var(--foreground)] flex items-center justify-center flex-shrink-0">
            <span className="text-[var(--background)] font-bold text-xs tracking-tight">Ax</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Axiom</span>
        </div>
        <button
          className="md:hidden p-1.5 rounded-md hover:bg-[var(--surface-hover)] text-[var(--muted)]"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-2 py-2">
        <nav className="space-y-px">
          {navItems.map((item, idx) => {
            const isActive = item.href !== "#" && pathname === item.href;
            return (
              <Link
                key={idx}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
                  isSidebarCollapsed && !isMobileSidebarOpen ? "md:justify-center md:px-0" : ""
                )}
                title={item.name}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className={cn(
                  "truncate",
                  isSidebarCollapsed && !isMobileSidebarOpen ? "md:hidden" : ""
                )}>
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* Upload Files nav item */}
          <button
            onClick={() => setShowSidebarUploader(true)}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors",
              "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
              isSidebarCollapsed && !isMobileSidebarOpen ? "md:justify-center md:px-0" : ""
            )}
            title="Upload Files"
          >
            <UploadCloudIcon className="w-4 h-4 flex-shrink-0" />
            <span className={cn(
              "truncate",
              isSidebarCollapsed && !isMobileSidebarOpen ? "md:hidden" : ""
            )}>
              Upload Files
            </span>
          </button>
        </nav>

        {/* History */}
        <div className={cn(
          "mt-6",
          isSidebarCollapsed && !isMobileSidebarOpen ? "md:hidden" : ""
        )}>
          <div className="flex items-center gap-1.5 px-2.5 mb-1">
            <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">History</span>
          </div>
          <div className="space-y-px">
            {pastChats.map((chat, idx) => (
              <a
                key={idx}
                href="#"
                className="flex items-center justify-between px-2.5 py-[7px] rounded-lg text-[13px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors group"
              >
                <span className="truncate">{chat.title}</span>
                <span className="text-[11px] text-[var(--muted)] opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0 ml-2 tabular-nums">
                  {chat.time}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-[var(--border)] space-y-px shrink-0">
        <a
          href="#"
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors",
            isSidebarCollapsed && !isMobileSidebarOpen ? "md:justify-center md:px-0" : ""
          )}
        >
          <SettingsIcon className="w-4 h-4 flex-shrink-0" />
          <span className={cn(
            "truncate",
            isSidebarCollapsed && !isMobileSidebarOpen ? "md:hidden" : ""
          )}>Settings</span>
        </a>
        <div className={cn(
          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
          isSidebarCollapsed && !isMobileSidebarOpen ? "md:justify-center md:px-0" : ""
        )}>
          <div className="w-6 h-6 rounded-full bg-[var(--surface-active)] flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-semibold text-[var(--muted-foreground)]">A</span>
          </div>
          <div className={cn(
            "flex-1 min-w-0 flex items-center justify-between",
            isSidebarCollapsed && !isMobileSidebarOpen ? "md:hidden" : ""
          )}>
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate">Admin</p>
              <p className="text-[11px] text-[var(--muted)] truncate">admin@axiom.io</p>
            </div>
            <button onClick={() => router.push("/")} className="p-1 rounded text-[var(--muted)] hover:text-[var(--foreground)] transition-colors" title="Sign out">
              <LogOutIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 flex flex-col",
          "bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]",
          "transition-all duration-200 ease-in-out",
          isMobileSidebarOpen ? "translate-x-0 w-[260px]" : "-translate-x-full md:translate-x-0",
          !isMobileSidebarOpen && isSidebarCollapsed ? "md:w-[52px]" : "md:w-[260px]",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0 bg-[var(--header-bg)] backdrop-blur-md z-20">
          <div className="flex items-center gap-2">
            {/* Sidebar toggle — always visible on desktop */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title={isSidebarCollapsed ? "Open sidebar" : "Close sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftIcon className="w-4 h-4" /> : <PanelLeftCloseIcon className="w-4 h-4" />}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)] transition-colors"
            >
              <PanelLeftIcon className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-[var(--border)] hidden md:block" />

            <span className="text-[13px] font-medium text-[var(--muted)]">Chat</span>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)]">
              <SearchIcon className="w-4 h-4" />
            </button>
            <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)]">
              <BellIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Sidebar Upload Modal */}
      <AnimatePresence>
        {showSidebarUploader && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSidebarUploader(false)}
          >
            <motion.div
              className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <UploadCloudIcon className="w-5 h-5 text-[var(--primary)]" />
                  <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Upload Files</h2>
                </div>
                <button
                  onClick={() => setShowSidebarUploader(false)}
                  className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="uploadcare-sidebar-wrapper">
                <FileUploaderRegular
                  sourceList="local, camera, facebook, gdrive"
                  classNameUploader="uc-light uc-purple"
                  pubkey="f25db25b9fb13ce659fe"
                  cdnCname="https://5kcn84nzfr.ucarecd.net/"
                  filesViewMode="grid"
                  multiple={true}
                  onFileUploadSuccess={handleSidebarUploadSuccess}
                  onDoneClick={handleSidebarDoneClick}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
