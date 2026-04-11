"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileTextIcon,
  FileImageIcon,
  FileArchiveIcon,
  FileIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Loader2Icon,
  DatabaseIcon,
  BrainCircuitIcon,
  FileSearchIcon,
  CpuIcon,
  CheckIcon,
  EyeIcon,
  XIcon,
  AlertCircleIcon,
  LayersIcon,
  TextIcon,
  BookOpenIcon,
  HashIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  ClockIcon,
  ZapIcon,
  DownloadIcon,
  CalendarIcon,
  ShieldCheckIcon,
  GitBranchIcon,
  ActivityIcon,
  HighlighterIcon,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type IngestionStatus = "pending" | "processing" | "completed" | "failed";

type StageInfo = {
  id: string;
  label: string;
  description: string;
  status: IngestionStatus;
  logs: string[];
  timeMs?: number;
};

type ChunkItem = {
  chunk_id: string;
  text: string;
  level: string;
  start_char: number;
  end_char: number;
  heading_path?: string | null;
};

type TemporalMetadata = {
  drift_status: string;
  version: number;
  parent_document_id: string | null;
  previous_versions: string[];
  created_at: string;
  last_verified_at: string;
  verified_by: string | null;
};

type DocumentData = {
  document_id: string;
  source_type: string;
  source_name: string;
  source_url: string | null;
  file_hash: string;
  file_size: number;
  local_path: string | null;
  hierarchical_chunks: {
    sections: ChunkItem[];
    passages: ChunkItem[];
    sentences: ChunkItem[];
  };
  sections_count: number;
  passages_count: number;
  sentences_count: number;
  recursive_chunks: ChunkItem[];
  recursive_chunks_count: number;
  embedding_info: {
    generated: boolean;
    provider: string;
    model: string;
    dimensions: number | null;
    chunks_embedded: number | null;
    file_path?: string;
  };
  temporal_metadata: TemporalMetadata;
  chunk_metadata: Record<string, any>;
  contradictions: any[];
  created_at: string;
  updated_at: string;
};

type FileIngestion = {
  id: string;
  job_id?: string;
  name: string;
  size: string;
  type: "pdf" | "image" | "docx" | "csv" | "other";
  status: IngestionStatus;
  uploadedAt: string;
  file_url?: string;
  stages: StageInfo[];
};

// ─── Mock Data ─────────────────────────────────────────────────────────────

const MOCK_FILES: FileIngestion[] = [
  {
    id: "f1",
    name: "Q1_Financial_Report.pdf",
    size: "4.2 MB",
    type: "pdf",
    status: "completed",
    uploadedAt: new Date(Date.now() - 600000).toISOString(),
    stages: [
      { id: "s1", label: "Document Ingestion", description: "Fetch from Uploadcare CDN", status: "completed", logs: ["Downloaded 4.2 MB", "Verified SHA256 checksum"], timeMs: 450 },
      { id: "s2", label: "OCR & Parsing", description: "Extract text and layout", status: "completed", logs: ["Used PDFMiner wrapper", "Extracted 42 pages"], timeMs: 2300 },
      { id: "s3", label: "Semantic Chunking", description: "Split doc safely", status: "completed", logs: ["Created 185 semantic chunks"], timeMs: 890 },
      { id: "s4", label: "Vector Embedding", description: "Generate dense vectors", status: "completed", logs: ["Embedded 185 chunks"], timeMs: 1400 },
      { id: "s5", label: "DB Indexing", description: "Database sync", status: "completed", logs: ["Upserted 185 vectors"], timeMs: 600 },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const isTerminalStatus = (status: string) => {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "success" || s === "failed";
};

const normalizeStatus = (status: string): IngestionStatus => {
  const s = (status || "pending").toLowerCase();
  if (s === "success" || s === "completed" || s === "done" || s === "finished") return "completed";
  if (s === "failed" || s === "error") return "failed";
  if (s === "processing" || s === "running" || s === "in_progress") return "processing";
  return "pending";
};

const fmtDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
};

const getFileIcon = (type: string) => {
  switch (type) {
    case "pdf": return <FileTextIcon className="text-red-500 w-5 h-5" />;
    case "image": return <FileImageIcon className="text-blue-500 w-5 h-5" />;
    case "docx": return <FileTextIcon className="text-blue-700 w-5 h-5" />;
    case "csv": return <FileArchiveIcon className="text-emerald-500 w-5 h-5" />;
    case "youtube": return <ExternalLinkIcon className="text-red-500 w-5 h-5" />;
    case "web pages": return <ExternalLinkIcon className="text-emerald-500 w-5 h-5" />;
    default: return <FileIcon className="text-[var(--muted)] w-5 h-5" />;
  }
};

const getStatusIcon = (status: IngestionStatus) => {
  switch (status) {
    case "completed": return <CheckCircle2Icon className="w-4 h-4 text-emerald-500" />;
    case "processing": return <Loader2Icon className="w-4 h-4 text-blue-500 animate-spin" />;
    case "failed": return <AlertCircleIcon className="w-4 h-4 text-red-500" />;
    default: return <CircleDashedIcon className="w-4 h-4 text-[var(--muted)]" />;
  }
};

const getStatusBadgeClass = (status: IngestionStatus) => {
  switch (status) {
    case "completed": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "processing": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "failed": return "bg-red-500/10 text-red-500 border-red-500/20";
    default: return "bg-[var(--surface-hover)] text-[var(--muted)] border-[var(--border)]";
  }
};

const getStageIcon = (index: number, status: IngestionStatus) => {
  if (status === "completed") return <CheckIcon className="w-4 h-4 text-white" />;
  if (status === "processing") return <Loader2Icon className="w-4 h-4 text-white animate-spin" />;
  if (status === "failed") return <XIcon className="w-4 h-4 text-white" />;
  const icons = [FileSearchIcon, CpuIcon, BrainCircuitIcon, DatabaseIcon, ZapIcon, DatabaseIcon];
  const Icon = icons[index] || FileIcon;
  return <Icon className="w-4 h-4 text-[var(--muted)]" />;
};

const buildPreviewUrl = (url: string, fileType: string): string => {
  if (!url) return "";
  if (fileType === "youtube") {
      let videoId = "";
      try {
          const urlObj = new URL(url);
          if (urlObj.hostname === "youtu.be") {
              videoId = urlObj.pathname.slice(1);
          } else {
              videoId = urlObj.searchParams.get("v") || "";
          }
      } catch(e) {}
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }
  if (fileType === "web pages") {
      return url;
  }
  if (!url.endsWith("/")) return url + "/";
  return url;
};

// ─── Chunk Level Styles ────────────────────────────────────────────────────

const CHUNK_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  section:  { bg: "bg-violet-500/5",  border: "border-violet-500/20", badge: "bg-violet-500/15 text-violet-400" },
  passage:  { bg: "bg-blue-500/5",    border: "border-blue-500/20",   badge: "bg-blue-500/15 text-blue-400" },
  sentence: { bg: "bg-amber-500/5",   border: "border-amber-500/20",  badge: "bg-amber-500/15 text-amber-400" },
};

// ─── Chunk Card ─────────────────────────────────────────────────────────────

function ChunkCard({ chunk, index }: { chunk: ChunkItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const colors = CHUNK_COLORS[chunk.level] || CHUNK_COLORS.sentence;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn("rounded-lg border p-4 cursor-pointer hover:shadow-md transition-all", colors.bg, colors.border)}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", colors.badge)}>
              {chunk.level}
            </span>
            <span className="text-[10px] font-mono text-[var(--muted)]">chars {chunk.start_char}–{chunk.end_char}</span>
            {chunk.chunk_id && (
              <span className="text-[10px] font-mono text-[var(--muted)] opacity-60">#{chunk.chunk_id.slice(0, 8)}</span>
            )}
          </div>
          {chunk.heading_path && (
            <div className="text-[11px] text-[var(--muted)] mb-1.5 flex items-center gap-1">
              <BookOpenIcon className="w-3 h-3 shrink-0" />
              <span className="truncate">{chunk.heading_path}</span>
            </div>
          )}
          <p className={cn("text-[13px] leading-relaxed text-[var(--foreground)]", expanded ? "" : "line-clamp-2")}>
            {chunk.text}
          </p>
        </div>
        <ChevronDownIcon className={cn("w-4 h-4 shrink-0 text-[var(--muted)] transition-transform", expanded ? "rotate-180" : "")} />
      </div>
    </motion.div>
  );
}

// ─── PDF Preview Modal ──────────────────────────────────────────────────────

function PdfPreviewModal({ open, onClose, url, fileName, fileType }: {
  open: boolean; onClose: () => void; url: string; fileName: string; fileType: string;
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const viewerUrl = buildPreviewUrl(url, fileType);

  useEffect(() => {
    if (open) { setIframeLoaded(false); setIframeError(false); }
  }, [open, url]);

  return (
    <AnimatePresence>
      {open && url && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="relative w-full max-w-5xl h-[90vh] bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-raised)] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-[var(--surface-hover)] shrink-0">{getFileIcon(fileType)}</div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate text-[var(--foreground)]">{fileName}</h3>
                  <p className="text-[11px] text-[var(--muted)]">Document Preview</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={url} download={fileName}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-active)] transition-colors">
                  <DownloadIcon className="w-3.5 h-3.5" /> Download
                </a>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                  <ExternalLinkIcon className="w-3.5 h-3.5" /> Open
                </a>
                <button onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors border border-transparent hover:border-[var(--border)]">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 relative bg-[#111113]">
              {!iframeLoaded && !iframeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[#111113]">
                  <Loader2Icon className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-[13px] text-[var(--muted)]">Loading document…</p>
                </div>
              )}
              {iframeError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#111113]">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertCircleIcon className="w-8 h-8 text-red-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--foreground)]">Preview unavailable</p>
                    <p className="text-[13px] text-[var(--muted)] mt-1">The document may require direct download.</p>
                  </div>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    <ExternalLinkIcon className="w-4 h-4" /> Open in New Tab
                  </a>
                </div>
              ) : (
                <iframe
                  src={viewerUrl}
                  className={cn("w-full h-full border-0 transition-opacity duration-300", iframeLoaded ? "opacity-100" : "opacity-0")}
                  title="Document Preview"
                  onLoad={() => setIframeLoaded(true)}
                  onError={() => setIframeError(true)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                />
              )}
            </div>
            <div className="px-5 py-2.5 border-t border-[var(--border)] bg-[var(--surface-raised)] shrink-0 flex items-center gap-2">
              <span className="text-[11px] text-[var(--muted)] shrink-0">CDN URL:</span>
              <span className="text-[11px] font-mono text-[var(--muted)] truncate flex-1">{url}</span>
              <button onClick={() => navigator.clipboard.writeText(url)}
                className="text-[11px] text-blue-500 hover:text-blue-400 transition-colors shrink-0">Copy</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Live Polling Badge ──────────────────────────────────────────────────────

function LivePollingBadge({ isPolling }: { isPolling: boolean }) {
  const [countdown, setCountdown] = useState(2);
  useEffect(() => {
    if (!isPolling) return;
    setCountdown(2);
    const cd = setInterval(() => setCountdown((c) => (c <= 1 ? 2 : c - 1)), 1000);
    return () => clearInterval(cd);
  }, [isPolling]);

  if (!isPolling) return null;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[12px] font-medium">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
      Polling every 2s · next in {countdown}s
    </motion.div>
  );
}

// ─── Stage Row ───────────────────────────────────────────────────────────────

function StageRow({ stage, index, isLast }: { stage: StageInfo; index: number; isLast: boolean }) {
  const isCompleted = stage.status === "completed";
  const isProcessing = stage.status === "processing";
  const isPending = stage.status === "pending";
  const isFailed = stage.status === "failed";

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="relative flex gap-5"
    >
      {!isLast && <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-[var(--border)]" />}
      <div className={cn(
        "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 shrink-0 transition-all duration-500",
        isCompleted  ? "bg-emerald-500 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]" :
        isProcessing ? "bg-blue-500 border-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.5)]" :
        isFailed     ? "bg-red-500 border-red-500" :
        "bg-[var(--surface)] border-[var(--border)]"
      )}>
        {getStageIcon(index, stage.status)}
      </div>
      <div className="flex-1 pt-1 pb-6">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div>
            <h3 className={cn("text-sm font-semibold tracking-tight", isPending ? "text-[var(--muted)]" : "text-[var(--foreground)]")}>
              {stage.label}
            </h3>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">{stage.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stage.timeMs && (
              <span className="text-[11px] font-mono text-[var(--muted)] bg-[var(--surface-hover)] border border-[var(--border)] px-2 py-0.5 rounded-md">
                {stage.timeMs}ms
              </span>
            )}
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1", getStatusBadgeClass(stage.status))}>
              {getStatusIcon(stage.status)}
              <span className="capitalize">{stage.status}</span>
            </span>
          </div>
        </div>
        <AnimatePresence>
          {!isPending && stage.logs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-2 bg-[#0d0d0f] border border-[#27272a] rounded-xl p-3.5 text-[12px] font-mono text-[#a1a1aa] shadow-inner">
                <div className="space-y-1.5">
                  {stage.logs.map((log, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-2">
                      <span className={cn("shrink-0", isCompleted ? "text-emerald-500" : isFailed ? "text-red-500" : "text-[#3f3f46]")}>›</span>
                      <span className="text-[#e4e4e7]">{log}</span>
                    </motion.div>
                  ))}
                  {isProcessing && (
                    <motion.div className="flex gap-2 animate-pulse" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <span className="text-[#3b82f6]">›</span>
                      <span className="text-[#3b82f6]">processing…</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Temporal Metadata Card ──────────────────────────────────────────────────

function TemporalMetadataCard({ temporal }: { temporal: TemporalMetadata }) {
  const driftColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    new:      { bg: "bg-emerald-500/8",  border: "border-emerald-500/25", text: "text-emerald-400",  dot: "bg-emerald-500" },
    updated:  { bg: "bg-blue-500/8",     border: "border-blue-500/25",    text: "text-blue-400",     dot: "bg-blue-500" },
    stale:    { bg: "bg-amber-500/8",    border: "border-amber-500/25",   text: "text-amber-400",    dot: "bg-amber-500" },
    outdated: { bg: "bg-red-500/8",      border: "border-red-500/25",     text: "text-red-400",      dot: "bg-red-500" },
  };
  const dc = driftColors[temporal.drift_status] || driftColors.new;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border p-5", dc.bg, dc.border)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", dc.bg, "border", dc.border)}>
            <ActivityIcon className={cn("w-4 h-4", dc.text)} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Temporal Metadata</h3>
            <p className="text-[11px] text-[var(--muted)]">Document lifecycle tracking</p>
          </div>
        </div>
        {/* Drift Status Badge */}
        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-semibold uppercase tracking-wide", dc.bg, dc.border, dc.text)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", dc.dot)} />
          {temporal.drift_status}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Version */}
        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-violet-500/15 flex items-center justify-center shrink-0">
            <GitBranchIcon className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium">Version</p>
            <p className="text-[13px] font-bold text-[var(--foreground)]">v{temporal.version}</p>
          </div>
        </div>

        {/* Parent Document */}
        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-500/15 flex items-center justify-center shrink-0">
            <FileSearchIcon className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium">Parent Doc</p>
            <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
              {temporal.parent_document_id ? temporal.parent_document_id.slice(0, 16) + "…" : "Root document"}
            </p>
          </div>
        </div>

        {/* Created At */}
        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium">Created</p>
            <p className="text-[12px] font-medium text-[var(--foreground)]">{fmtDate(temporal.created_at)}</p>
          </div>
        </div>

        {/* Last Verified */}
        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-amber-500/15 flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium">Last Verified</p>
            <p className="text-[12px] font-medium text-[var(--foreground)]">{fmtDate(temporal.last_verified_at)}</p>
            {temporal.verified_by && (
              <p className="text-[10px] text-[var(--muted)]">by {temporal.verified_by}</p>
            )}
          </div>
        </div>
      </div>

      {/* Previous versions */}
      {temporal.previous_versions.length > 0 && (
        <div className="mt-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-3">
          <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium mb-2">Previous Versions ({temporal.previous_versions.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {temporal.previous_versions.map((v, i) => (
              <span key={i} className="text-[10px] font-mono bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--muted)] px-2 py-0.5 rounded">
                {v.slice(0, 12)}…
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function IngestionWikiViewer() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  // jobDetails: keyed by job_id → API response
  const [jobDetails, setJobDetails] = useState<Record<string, any>>({});
  // docData: keyed by document_id → DocumentData (fetched ONCE, never again)
  const [docData, setDocData] = useState<Record<string, DocumentData>>({});
  // Track which document IDs we've already fetched (prevent re-fetching)
  const fetchedDocIds = useRef<Set<string>>(new Set());

  const [showDocPreview, setShowDocPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [activeChunkTab, setActiveChunkTab] = useState<"sections" | "passages" | "sentences">("sections");
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Highlighted PDF state
  const [highlightedPdfUrl, setHighlightedPdfUrl] = useState<string | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlightStats, setHighlightStats] = useState<{ total_chunks: number; highlighted: number; missing: number; pages_processed: number } | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);

  // ── Load jobs ────────────────────────────────────────────────────────────
  const loadJobs = useCallback(() => {
    const local = JSON.parse(localStorage.getItem("axiom_ingestion_jobs") || "[]");
    if (local.length > 0) {
      setJobs(local);
      setSelectedFileId((prev) => prev || local[0].job_id);
    } else {
      setJobs(MOCK_FILES as any);
      setSelectedFileId((prev) => prev || MOCK_FILES[0].id);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    window.addEventListener("axiom_jobs_updated", loadJobs);
    return () => window.removeEventListener("axiom_jobs_updated", loadJobs);
  }, [loadJobs]);

  // ── Fetch document details ONCE per document_id ──────────────────────────
  const fetchDocumentDetails = useCallback(async (documentId: string) => {
    if (fetchedDocIds.current.has(documentId)) return; // ← already fetched, skip
    fetchedDocIds.current.add(documentId);
    try {
      console.log(`📄 [one-time] Fetching document: ${documentId}`);
      const res = await fetch(`/api/proxy/documents/${documentId}`);
      if (res.ok) {
        const data = await res.json();
        setDocData((prev) => ({ ...prev, [documentId]: data }));
      }
    } catch (err) {
      console.error(`Failed to fetch document ${documentId}`, err);
      // Remove from set so it can be retried if needed
      fetchedDocIds.current.delete(documentId);
    }
  }, []);

  // ── Poll job statuses every 2s — STOP once all are terminal ─────────────
  useEffect(() => {
    const realJobs = jobs.filter((j) => j.job_id);
    if (realJobs.length === 0) return;

    // Check if every real job is already done (terminal)
    const allDone = realJobs.every((j) => isTerminalStatus(j.status || ""));
    if (allDone) {
      // All completed/failed — no need to poll. Just ensure doc data is fetched.
      for (const job of realJobs) {
        const d = jobDetails[job.job_id];
        const docId = d?.document_id || job.document_id;
        if (docId) fetchDocumentDetails(docId);
      }
      return;
    }

    const fetchAllStatuses = async () => {
      setLastPollTime(new Date());

      for (const job of realJobs) {
        // Skip jobs that are already done — only poll pending/processing
        if (isTerminalStatus(job.status || "")) {
          // Ensure their doc is fetched
          const d = jobDetails[job.job_id];
          const docId = d?.document_id || job.document_id;
          if (docId) fetchDocumentDetails(docId);
          continue;
        }

        try {
          const res = await fetch(`/api/proxy/ingest/${job.job_id}`);
          if (!res.ok) continue;

          const data = await res.json();
          const newStatus = normalizeStatus(data.status);

          setJobDetails((prev) => ({ ...prev, [job.job_id]: data }));

          // Sync status back to jobs list + localStorage
          setJobs((prevJobs) => {
            const updated = prevJobs.map((j) =>
              j.job_id === job.job_id
                ? { ...j, status: newStatus, document_id: data.document_id || j.document_id }
                : j
            );
            localStorage.setItem(
              "axiom_ingestion_jobs",
              JSON.stringify(updated.filter((j) => j.job_id))
            );
            return updated;
          });

          // If this job just completed — fetch document details ONCE
          if (isTerminalStatus(newStatus) && data.document_id) {
            fetchDocumentDetails(data.document_id);
          }
        } catch (err) {
          console.error(`Failed to poll job ${job.job_id}`, err);
        }
      }
    };

    fetchAllStatuses();
    pollingRef.current = setInterval(fetchAllStatuses, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // NOTE: deliberately depend on jobs.length and the stringified statuses
    // so the effect re-runs when a job transitions to terminal and we can stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length, jobs.map((j) => j.status).join(",")]);

  // ── Derived state ────────────────────────────────────────────────────────
  const selectedJob = jobs.find((j) => (j.job_id || j.id) === selectedFileId);
  const hasRealJobs = jobs.some((j) => !!j.job_id);
  const activeJobCount = jobs.filter((j) => j.job_id && !isTerminalStatus(j.status || "")).length;

  const renderJob: FileIngestion | null = React.useMemo(() => {
    if (!selectedJob) return null;
    if (selectedJob.id?.startsWith("f") && !selectedJob.job_id) return selectedJob as FileIngestion;

    const d = jobDetails[selectedJob.job_id] || { status: selectedJob.status || "pending" };
    const st = normalizeStatus(d.status);
    const done = st === "completed";
    const fail = st === "failed";
    const proc = st === "processing";

    const dd: DocumentData | undefined = d.document_id
      ? docData[d.document_id]
      : selectedJob.document_id
        ? docData[selectedJob.document_id]
        : undefined;

    const stages: StageInfo[] = [
      {
        id: "s1",
        label: "Document Ingestion",
        description: "Fetching file from Uploadcare CDN",
        status: "completed",
        logs: [
          `Job ID: ${d.job_id || selectedJob.job_id}`,
          ...(d.document_id ? [`Document ID: ${d.document_id}`] : []),
          ...(d.started_at ? [`Started: ${fmtDate(d.started_at)}`] : []),
          ...(dd ? [`File size: ${dd.file_size} bytes`, `Hash: ${dd.file_hash?.slice(0, 16)}…`] : []),
          ...(selectedJob.file_url ? [`CDN: ${selectedJob.file_url.slice(0, 55)}…`] : []),
        ].filter(Boolean),
      },
      {
        id: "s2",
        label: "OCR & Text Extraction",
        description: "Parse document structure and extract text",
        status: done ? "completed" : proc ? "processing" : fail ? "failed" : "pending",
        logs: done
          ? ["Text extraction complete", ...(dd ? [`Source: ${dd.source_name}`, `Type: ${dd.source_type}`] : [])]
          : proc ? ["Analyzing document layout…"]
          : fail ? [d.error || "Extraction failed"] : [],
      },
      {
        id: "s3",
        label: "Hierarchical Chunking",
        description: "Split into sections, passages, and sentences",
        status: done ? "completed" : "pending",
        logs: done
          ? [
              `Total chunks: ${d.chunks_count || (dd ? dd.sections_count + dd.passages_count + dd.sentences_count : 0)}`,
              ...(dd ? [`Sections: ${dd.sections_count}`, `Passages: ${dd.passages_count}`, `Sentences: ${dd.sentences_count}`, `Recursive: ${dd.recursive_chunks_count}`] : []),
            ]
          : [],
      },
      {
        id: "s4",
        label: "Vector Embedding",
        description: "Generate dense vector embeddings",
        status: done ? "completed" : "pending",
        logs: done && dd?.embedding_info
          ? [
              `Provider: ${dd.embedding_info.provider}`,
              `Model: ${dd.embedding_info.model}`,
              `Generated: ${dd.embedding_info.generated ? "Yes" : "No"}`,
              ...(dd.embedding_info.dimensions ? [`Dimensions: ${dd.embedding_info.dimensions}`] : []),
            ]
          : done ? [`Embedded ${d.chunks_count || 0} chunks`] : [],
      },
      {
        id: "s5",
        label: "Indexing & Storage",
        description: "Store in database and build search index",
        status: done ? "completed" : fail ? "failed" : "pending",
        logs: done
          ? ["Indexed successfully", `Completed: ${fmtDate(d.completed_at || dd?.updated_at)}`]
          : fail ? [d.error ? `Error: ${d.error}` : "Indexing failed"] : [],
      },
    ];

    return {
      id: selectedJob.job_id,
      name: selectedJob.name,
      size: selectedJob.size || "Unknown",
      type: (selectedJob.type || "other") as any,
      status: done ? "completed" : fail ? "failed" : proc ? "processing" : "pending",
      uploadedAt: selectedJob.uploadedAt ? fmtDate(selectedJob.uploadedAt) : "Unknown",
      file_url: selectedJob.file_url,
      stages,
    };
  }, [selectedFileId, jobs, jobDetails, docData]);

  const currentDocData: DocumentData | undefined = React.useMemo(() => {
    if (!selectedJob) return undefined;
    const d = jobDetails[selectedJob.job_id];
    if (d?.document_id && docData[d.document_id]) return docData[d.document_id];
    if (selectedJob.document_id && docData[selectedJob.document_id]) return docData[selectedJob.document_id];
    return undefined;
  }, [selectedJob, jobDetails, docData]);

  // ─────────────────────────────────────────────────────────────────────────

  if (!renderJob) {
    return (
      <div className="flex h-full w-full bg-[var(--background)] items-center justify-center text-[var(--muted)]">
        <div className="text-center space-y-4 max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center mx-auto">
            <DatabaseIcon className="w-8 h-8 opacity-40" />
          </div>
          <p className="text-sm">No active ingestions yet.</p>
          <p className="text-[12px] opacity-60">Upload a file via the sidebar to begin.</p>
        </div>
      </div>
    );
  }

  const chunkTabs = [
    { key: "sections"  as const, label: "Sections",  icon: LayersIcon, count: currentDocData?.sections_count },
    { key: "passages"  as const, label: "Passages",  icon: TextIcon,   count: currentDocData?.passages_count },
    { key: "sentences" as const, label: "Sentences", icon: HashIcon,   count: currentDocData?.sentences_count },
  ];
  const activeChunks: ChunkItem[] = currentDocData?.hierarchical_chunks?.[activeChunkTab] || [];
  const completedStages = renderJob.stages.filter((s) => s.status === "completed").length;
  const isLivePolling = hasRealJobs && (renderJob.status === "pending" || renderJob.status === "processing");

  return (
    <div className="flex h-full w-full bg-[var(--background)] overflow-hidden">
      {/* PDF Preview Modal */}
      <PdfPreviewModal
        open={showDocPreview}
        onClose={() => setShowDocPreview(false)}
        url={previewUrl}
        fileName={renderJob.name}
        fileType={renderJob.type}
      />

      {/* ── Sidebar: Job List ── */}
      <div className="w-72 border-r border-[var(--border)] bg-[var(--surface-raised)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">Ingestion Wiki</h2>
          <p className="text-[12px] text-[var(--muted)] mt-0.5">Monitor chunking & vectorization pipelines</p>
          {hasRealJobs && (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                <ClockIcon className="w-3 h-3" />
                {lastPollTime ? `Polled: ${lastPollTime.toLocaleTimeString()}` : "Starting…"}
              </div>
              {activeJobCount > 0 ? (
                <span className="text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">
                  {activeJobCount} active
                </span>
              ) : (
                <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  All done ✓
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {jobs.map((file: any) => {
            const fileId = file.job_id || file.id;
            const isActive = selectedFileId === fileId;
            const status: IngestionStatus = normalizeStatus(file.status || "pending");
            return (
              <button
                key={fileId}
                onClick={() => setSelectedFileId(fileId)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all",
                  isActive
                    ? "bg-[var(--surface-hover)] border border-[var(--border)] shadow-sm"
                    : "hover:bg-[var(--surface-hover)] border border-transparent"
                )}
              >
                <div className="shrink-0 p-1.5 rounded-lg bg-[var(--surface-active)]">{getFileIcon(file.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[13px] font-medium truncate", isActive ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px]">
                    <span className="flex items-center gap-1">
                      {getStatusIcon(status)}
                      <span className={cn("capitalize font-medium",
                        status === "completed" ? "text-emerald-500" :
                        status === "processing" ? "text-blue-500 animate-pulse" :
                        status === "failed"     ? "text-red-500" :
                        "text-[var(--muted)]"
                      )}>{status}</span>
                    </span>
                    {file.size && <><span className="text-[var(--muted)]">·</span><span className="text-[var(--muted)]">{file.size}</span></>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main View ── */}
      <div className="flex-1 overflow-y-auto bg-[var(--background)] relative">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--border)] px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl shrink-0">
              {getFileIcon(renderJob.type)}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight truncate">{renderJob.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 text-[12px] text-[var(--muted)]">
                <span>{renderJob.size}</span>
                <span>·</span>
                <span>Uploaded {renderJob.uploadedAt}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
            <LivePollingBadge isPolling={isLivePolling} />

            {renderJob.file_url && (
              <button
                onClick={() => { setPreviewUrl(renderJob.file_url!); setShowDocPreview(true); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-[var(--border)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] transition-colors"
              >
                <EyeIcon className="w-4 h-4" />
                View Document
              </button>
            )}

            {/* View Highlighted PDF button — only if document is completed and has chunks */}
            {renderJob.status === "completed" && currentDocData && renderJob.file_url && (renderJob.type === "pdf" || renderJob.type === "docx" || renderJob.type === "other") && (
              <button
                onClick={async () => {
                  if (highlightedPdfUrl) {
                    setPreviewUrl(highlightedPdfUrl);
                    setShowDocPreview(true);
                    return;
                  }
                  setIsHighlighting(true);
                  setHighlightError(null);
                  try {
                    const allChunks = [
                      ...(currentDocData.hierarchical_chunks?.sections || []).map((c: any) => ({ ...c, level: "section" })),
                      ...(currentDocData.hierarchical_chunks?.passages || []).map((c: any) => ({ ...c, level: "passage" })),
                      ...(currentDocData.hierarchical_chunks?.sentences || []).map((c: any) => ({ ...c, level: "sentence" })),
                    ];
                    const res = await fetch("/api/highlight-pdf", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ pdf_url: renderJob.file_url, chunks: allChunks }),
                    });
                    if (!res.ok) {
                      const errData = await res.json().catch(() => ({}));
                      throw new Error(errData.error || `HTTP ${res.status}`);
                    }
                    const statsHeader = res.headers.get("X-Highlight-Stats");
                    if (statsHeader) {
                      try { setHighlightStats(JSON.parse(statsHeader)); } catch {}
                    }
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    setHighlightedPdfUrl(blobUrl);
                    setPreviewUrl(blobUrl);
                    setShowDocPreview(true);
                  } catch (err: any) {
                    console.error("Highlight failed:", err);
                    setHighlightError(err.message || "Failed to highlight PDF");
                  } finally {
                    setIsHighlighting(false);
                  }
                }}
                disabled={isHighlighting}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
                  highlightedPdfUrl
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "border-[var(--border)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]",
                  isHighlighting && "opacity-60 cursor-wait"
                )}
              >
                {isHighlighting ? (
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                ) : (
                  <HighlighterIcon className="w-4 h-4" />
                )}
                {isHighlighting ? "Highlighting…" : highlightedPdfUrl ? "View Highlighted" : "Highlight Chunks"}
              </button>
            )}

            <div className={cn("px-3 py-1.5 rounded-full text-[13px] font-medium flex items-center gap-1.5 border", getStatusBadgeClass(renderJob.status))}>
              {getStatusIcon(renderJob.status)}
              <span className="capitalize">{renderJob.status}</span>
            </div>
          </div>
        </div>

        {/* ── Highlight Error / Stats Banner ── */}
        {highlightError && (
          <div className="max-w-3xl mx-auto px-8 pt-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
              <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">Highlighting failed</p>
                <p className="text-[12px] text-[var(--muted)] mt-0.5">{highlightError}</p>
              </div>
            </div>
          </div>
        )}

        {highlightStats && (
          <div className="max-w-3xl mx-auto px-8 pt-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <HighlighterIcon className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-400">Chunk Highlighting Results</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Chunks", value: highlightStats.total_chunks, color: "text-[var(--foreground)]" },
                  { label: "Highlighted", value: highlightStats.highlighted, color: "text-emerald-400" },
                  { label: "Missing", value: highlightStats.missing, color: highlightStats.missing > 0 ? "text-red-400" : "text-[var(--muted)]" },
                  { label: "Pages", value: highlightStats.pages_processed, color: "text-blue-400" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Inline Highlighted PDF Viewer ── */}
        {highlightedPdfUrl && (
          <div className="max-w-3xl mx-auto px-8 pt-6">
            <div className="rounded-xl border border-amber-500/20 overflow-hidden">
              <div className="bg-amber-500/5 border-b border-amber-500/20 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HighlighterIcon className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-[var(--foreground)]">Highlighted Document</span>
                  <span className="text-[11px] text-[var(--muted)]">— Chunks are highlighted in yellow</span>
                </div>
                <div className="flex items-center gap-2">
                  <a href={highlightedPdfUrl} download="highlighted_document.pdf"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-active)] transition-colors">
                    <DownloadIcon className="w-3.5 h-3.5" /> Download
                  </a>
                  <button onClick={() => { setPreviewUrl(highlightedPdfUrl); setShowDocPreview(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                    <ExternalLinkIcon className="w-3.5 h-3.5" /> Fullscreen
                  </button>
                </div>
              </div>
              <iframe
                src={highlightedPdfUrl}
                className="w-full border-0"
                style={{ height: "600px" }}
                title="Highlighted PDF Preview"
              />
            </div>
          </div>
        )}

        {/* Pipeline */}
        <div className="max-w-3xl mx-auto py-10 px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--muted)] uppercase tracking-wider">Processing Pipeline</h2>
              <p className="text-[12px] text-[var(--muted)] mt-1 opacity-70">
                {completedStages} of {renderJob.stages.length} stages complete
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="w-40 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full",
                    renderJob.status === "completed" ? "bg-emerald-500" :
                    renderJob.status === "failed"    ? "bg-red-500" : "bg-blue-500"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedStages / renderJob.stages.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-[11px] text-[var(--muted)] font-mono">
                {Math.round((completedStages / renderJob.stages.length) * 100)}%
              </span>
            </div>
          </div>

          <div className="space-y-0 relative">
            {renderJob.stages.map((stage, idx) => (
              <StageRow key={stage.id} stage={stage} index={idx} isLast={idx === renderJob.stages.length - 1} />
            ))}
          </div>

          {/* ── Temporal Metadata ── */}
          {currentDocData?.temporal_metadata && (
            <div className="mt-10">
              <h2 className="text-[13px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">
                Temporal Metadata
              </h2>
              <TemporalMetadataCard temporal={currentDocData.temporal_metadata} />
            </div>
          )}
        </div>

        {/* ── Hierarchical Chunks ── */}
        {currentDocData && (
          <div className="max-w-3xl mx-auto px-8 pb-16">
            <div className="border-t border-[var(--border)] pt-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Hierarchical Chunks</h2>
                  <p className="text-[13px] text-[var(--muted)] mt-1">
                    {currentDocData.sections_count + currentDocData.passages_count + currentDocData.sentences_count} chunks across 3 semantic levels
                  </p>
                </div>
                {currentDocData.embedding_info && (
                  <div className="text-right text-[11px] text-[var(--muted)]">
                    <p>Embeddings: <span className={cn("font-medium", currentDocData.embedding_info.generated ? "text-emerald-500" : "text-amber-500")}>
                      {currentDocData.embedding_info.generated ? "Generated" : "Pending"}
                    </span></p>
                    <p className="mt-0.5 opacity-70">{currentDocData.embedding_info.model}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: "Sections",  count: currentDocData.sections_count,  colorClass: "border-violet-500/20 bg-violet-500/5 text-violet-400" },
                  { label: "Passages",  count: currentDocData.passages_count,  colorClass: "border-blue-500/20 bg-blue-500/5 text-blue-400" },
                  { label: "Sentences", count: currentDocData.sentences_count, colorClass: "border-amber-500/20 bg-amber-500/5 text-amber-400" },
                ].map(({ label, count, colorClass }) => (
                  <div key={label} className={cn("rounded-xl border p-4 text-center", colorClass)}>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-[11px] text-[var(--muted)] mt-1">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-1 mb-6 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-1">
                {chunkTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveChunkTab(tab.key)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-medium transition-colors",
                      activeChunkTab === tab.key
                        ? "bg-[var(--surface-hover)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full",
                        activeChunkTab === tab.key
                          ? "bg-[var(--foreground)]/10 text-[var(--foreground)]"
                          : "bg-[var(--surface-hover)] text-[var(--muted)]"
                      )}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {activeChunks.length > 0
                  ? activeChunks.map((chunk, idx) => <ChunkCard key={chunk.chunk_id || idx} chunk={chunk} index={idx} />)
                  : (
                    <div className="text-center py-12 text-[var(--muted)]">
                      <LayersIcon className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No {activeChunkTab} found.</p>
                    </div>
                  )
                }
              </div>

              {currentDocData.recursive_chunks?.length > 0 && (
                <div className="mt-10 border-t border-[var(--border)] pt-8">
                  <h3 className="text-[13px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">
                    Recursive Chunks ({currentDocData.recursive_chunks_count})
                  </h3>
                  <div className="space-y-3">
                    {currentDocData.recursive_chunks.map((chunk, idx) => (
                      <div key={chunk.chunk_id || idx} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">recursive</span>
                          <span className="text-[10px] font-mono text-[var(--muted)]">chars {chunk.start_char}–{chunk.end_char}</span>
                        </div>
                        <p className="text-[13px] text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{chunk.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
