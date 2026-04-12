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
  NetworkIcon,
  SearchIcon,
  SplitIcon,
  BoxIcon,
  ShieldAlertIcon,
  FingerprintIcon,
  ScanEyeIcon,
  LinkIcon,
  AlertTriangleIcon,
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
  redaction_info?: any;
  pii_report?: any;
  redact?: any;
  redacted_content?: any;
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

// ─── Rich Chunk Text Renderer ───────────────────────────────────────────────
// Parses [TABLE: ...] into real tables and highlights [REDACTED]

function parseTableBlock(tableStr: string): { headers: string[]; rows: string[][] } | null {
  // e.g. "Customer Name City Phone Number Status Priya Nair Bangalore [REDACTED] Active ..."
  // The first row of words that repeat as keys = headers; rest = data rows
  const clean = tableStr.trim();
  if (!clean) return null;

  // Try to detect column count by looking for known header patterns or splitting smartly
  // Heuristic: split tokens, look for [REDACTED] as single tokens too
  const tokens: string[] = [];
  const re = /\[REDACTED\]|[^\s]+/g;
  let m;
  while ((m = re.exec(clean)) !== null) tokens.push(m[0]);

  if (tokens.length < 2) return null;

  // Strategy: try common column counts (2-8) and see which produces rows with consistent lengths
  // For now, we try to find a row of header words that repeats. Simple approach:
  // Assume table data in the text uses space-separated values and we can attempt to guess columns.
  // Best guess: look at the first few tokens until we hit a word that might be a value (capitalized, short)
  // Simplification: try column counts 2..8, pick the one that divides evenly (or closest)
  for (let cols = 2; cols <= 8; cols++) {
    if (tokens.length % cols === 0 || (tokens.length - cols) % (cols) === 0) {
      // First `cols` tokens = headers
      const hdrs = tokens.slice(0, cols);
      const dataTokens = tokens.slice(cols);
      if (dataTokens.length === 0) continue;
      if (dataTokens.length % cols !== 0) continue;
      const rows: string[][] = [];
      for (let i = 0; i < dataTokens.length; i += cols) {
        rows.push(dataTokens.slice(i, i + cols));
      }
      if (rows.length >= 1) return { headers: hdrs, rows };
    }
  }
  // Fallback: just return pairs
  return null;
}

function RichChunkText({ text, expanded }: { text: string; expanded?: boolean }) {
  if (!text) return null;

  // Split text around [TABLE: ...] blocks
  const tableRegex = /\[TABLE:\s*([\s\S]*?)\]/g;
  const parts: { type: "text" | "table"; content: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = tableRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "table", content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", content: text });
  }

  // Render [REDACTED] within text as black badges
  const renderTextWithRedacted = (t: string) => {
    const segs = t.split(/(\[REDACTED\])/g);
    return segs.map((seg, i) =>
      seg === "[REDACTED]" ? (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[11px] font-bold text-white bg-black border border-white/10 mx-0.5 align-middle"
          title="Redacted content"
        >
          ██ REDACTED
        </span>
      ) : (
        <span key={i}>{seg}</span>
      )
    );
  };

  return (
    <div>
      {parts.map((part, pi) => {
        if (part.type === "table") {
          const parsed = parseTableBlock(part.content);
          if (parsed) {
            return (
              <div key={pi} className="my-3 rounded-lg border border-cyan-500/25 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border-b border-cyan-500/20">
                  <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                  </svg>
                  <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">Table Data</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] text-left">
                    <thead>
                      <tr className="bg-[var(--surface-hover)]">
                        {parsed.headers.map((h, hi) => (
                          <th key={hi} className="px-3 py-2 font-semibold text-[var(--foreground)] border-b border-[var(--border)] whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? "bg-transparent" : "bg-[var(--surface-raised)]"}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2 text-[var(--foreground)]/90 border-b border-[var(--border)]/50 whitespace-nowrap">
                              {cell === "[REDACTED]" ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-black border border-white/10">
                                  ██ REDACTED
                                </span>
                              ) : cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          // Couldn't parse — render as text
          return <span key={pi}>{renderTextWithRedacted(part.content)}</span>;
        }
        return <span key={pi}>{renderTextWithRedacted(part.content)}</span>;
      })}
    </div>
  );
}

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
          <div className={cn("text-[13px] leading-relaxed text-[var(--foreground)]", expanded ? "" : "line-clamp-2")}>
            <RichChunkText text={chunk.text} expanded={expanded} />
          </div>
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

// ─── Connected Node Chunk Card ──────────────────────────────────────────────

function ChunkExplorerCard({ chunk, index, variant, totalChunks, maxChar }: {
  chunk: any; index: number; variant: "hierarchical" | "recursive";
  totalChunks: number; maxChar: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isHier = variant === "hierarchical";
  const isLast = index === totalChunks - 1;

  const accentRgb = isHier ? "59,130,246" : "16,185,129"; // blue-500 / emerald-500
  const dotColor = isHier ? "bg-blue-500" : "bg-emerald-500";
  const lineColor = isHier ? "bg-blue-500/20" : "bg-emerald-500/20";
  const borderGradient = isHier
    ? "from-blue-500/30 via-blue-500/10 to-transparent"
    : "from-emerald-500/30 via-emerald-500/10 to-transparent";
  const badgeBg = isHier ? "bg-blue-500/12 text-blue-400 border-blue-500/25" : "bg-emerald-500/12 text-emerald-400 border-emerald-500/25";

  const charSpan = (chunk.end_char || 0) - (chunk.start_char || 0);
  const startPct = maxChar > 0 ? ((chunk.start_char || 0) / maxChar) * 100 : 0;
  const widthPct = maxChar > 0 ? Math.max((charSpan / maxChar) * 100, 1) : 100;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(chunk.text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 200 }}
      className="relative flex gap-0"
    >
      {/* ── Left: Timeline Node + Line ── */}
      <div className="flex flex-col items-center w-12 shrink-0 pt-5 relative">
        {/* Connecting line above */}
        {index > 0 && <div className={cn("absolute top-0 w-0.5 h-5", lineColor)} />}
        {/* Glowing node */}
        <div className="relative z-10">
          <div className={cn("w-4 h-4 rounded-full border-2 transition-all duration-300", dotColor,
            expanded ? `shadow-[0_0_12px_rgba(${accentRgb},0.6)]` : `shadow-[0_0_6px_rgba(${accentRgb},0.3)]`
          )} />
          {/* Pulse ring on hover */}
          <div className={cn("absolute inset-0 rounded-full animate-ping opacity-20", dotColor)} style={{ animationDuration: "3s" }} />
        </div>
        {/* Connecting line below */}
        {!isLast && <div className={cn("flex-1 w-0.5 min-h-[20px]", lineColor)} />}
      </div>

      {/* ── Right: Card ── */}
      <div
        className={cn(
          "flex-1 mb-3 rounded-xl overflow-hidden cursor-pointer transition-all duration-200",
          "border border-[var(--border)] hover:shadow-lg",
          expanded && `shadow-[0_4px_24px_rgba(${accentRgb},0.08)]`
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Gradient accent bar */}
        <div className={cn("h-0.5 bg-gradient-to-r", borderGradient)} />

        {/* Card content */}
        <div className="px-4 py-3.5 bg-[var(--surface-raised)]">
          {/* Top row: index, badge, char range */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-bold text-[var(--foreground)] tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", badgeBg)}>
                {chunk.level || variant}
              </span>
              {chunk.heading_path && (
                <span className="text-[10px] text-[var(--muted)] flex items-center gap-1 max-w-[200px]">
                  <BookOpenIcon className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  <span className="truncate">{chunk.heading_path}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCopy}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-md border transition-all duration-200",
                  copied
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 scale-105"
                    : "bg-transparent border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20"
                )}
              >
                {copied ? "✓" : "Copy"}
              </button>
              <ChevronDownIcon className={cn("w-3.5 h-3.5 text-[var(--muted)] transition-transform duration-200", expanded ? "rotate-180" : "")} />
            </div>
          </div>

          {/* Text preview */}
          <div className={cn("text-[13px] leading-relaxed text-[var(--foreground)]/90", expanded ? "" : "line-clamp-2")}>
            <RichChunkText text={chunk.text} expanded={expanded} />
          </div>

          {/* Document position bar — shows where this chunk sits in the full document */}
          <div className="mt-3 relative">
            <div className="flex items-center justify-between text-[9px] text-[var(--muted)] mb-1 font-mono">
              <span>{chunk.start_char}</span>
              <span className="opacity-50">{charSpan} chars</span>
              <span>{chunk.end_char}</span>
            </div>
            <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${widthPct}%` }}
                transition={{ delay: index * 0.05 + 0.2, duration: 0.5, ease: "easeOut" }}
                className={cn("absolute h-full rounded-full", isHier ? "bg-blue-500" : "bg-emerald-500")}
                style={{ left: `${startPct}%`, opacity: 0.7 }}
              />
            </div>
          </div>
        </div>

        {/* Expanded metadata panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 border-t border-[var(--border)] bg-[#0d0d0f]">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {chunk.chunk_id && (
                    <div className="col-span-2">
                      <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider font-semibold">Chunk ID</span>
                      <p className="text-[11px] font-mono text-[var(--foreground)] mt-0.5 break-all opacity-80">{chunk.chunk_id}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider font-semibold">Level</span>
                    <p className={cn("text-[11px] font-semibold mt-0.5", isHier ? "text-blue-400" : "text-emerald-400")}>{chunk.level || variant}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider font-semibold">Character Range</span>
                    <p className="text-[11px] font-mono text-[var(--foreground)] mt-0.5">{chunk.start_char} → {chunk.end_char}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider font-semibold">Span Length</span>
                    <p className="text-[11px] font-mono text-[var(--foreground)] mt-0.5">{charSpan} characters</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider font-semibold">Position</span>
                    <p className="text-[11px] font-mono text-[var(--foreground)] mt-0.5">{Math.round(startPct)}% into document</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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

  // Main view tab: Pipeline vs Chunk Explorer vs ZeroClaw
  const [mainViewTab, setMainViewTab] = useState<"pipeline" | "chunks" | "zeroclaw">("pipeline");

  // Chunk Explorer API data (fetched from dedicated endpoints)
  const [apiHierarchicalChunks, setApiHierarchicalChunks] = useState<any[]>([]);
  const [apiRecursiveChunks, setApiRecursiveChunks] = useState<any[]>([]);
  const [chunkExplorerLoading, setChunkExplorerLoading] = useState(false);
  const [chunkExplorerLoaded, setChunkExplorerLoaded] = useState<string | null>(null);
  const [chunkSearchQuery, setChunkSearchQuery] = useState("");

  // ZeroClaw state
  const [zeroClawData, setZeroClawData] = useState<any>(null);
  const [zeroClawLoading, setZeroClawLoading] = useState(false);
  const [zeroClawError, setZeroClawError] = useState<string | null>(null);
  const [zeroClawRanFor, setZeroClawRanFor] = useState<string | null>(null);
  const [zeroClawFilter, setZeroClawFilter] = useState<"all" | "verified" | "unverified" | "conflicts">("all");

  // ── Load jobs ────────────────────────────────────────────────────────────
  const loadJobs = useCallback(() => {
    const local = JSON.parse(localStorage.getItem("axiom_ingestion_jobs") || "[]");
    if (local.length > 0) {
      // Deduplicate by job_id to prevent duplicate React keys
      const seen = new Set<string>();
      const deduped = local.filter((j: any) => {
        const key = j.job_id || j.id;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // Persist the cleaned list back
      if (deduped.length !== local.length) {
        localStorage.setItem("axiom_ingestion_jobs", JSON.stringify(deduped));
      }
      setJobs(deduped);
      setSelectedFileId((prev) => prev || deduped[0]?.job_id);
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
          
          if (res.status === 404) {
            // Stop polling immediately and mark as failed if the API returns 404
            setJobs((prevJobs) => {
              const updated = prevJobs.map((j) =>
                j.job_id === job.job_id ? { ...j, status: "failed", document_id: undefined } : j
              );
              localStorage.setItem("axiom_ingestion_jobs", JSON.stringify(updated.filter((j) => j.job_id)));
              return updated;
            });
            continue;
          }

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
                    // Extract chunks and flatten tables if they exist
                    const allChunks: any[] = [];
                    const processGroup = (group: any[], level: string) => {
                      if (!group) return;
                      group.forEach((c: any) => {
                        allChunks.push({ ...c, level });
                        if (c.tables && Array.isArray(c.tables)) {
                          c.tables.forEach((t: any) => {
                            if (t.text) {
                              allChunks.push({ chunk_id: c.chunk_id + "-table", text: t.text, start_char: t.start_char || 0, end_char: t.end_char || 0, isTable: true });
                            }
                          });
                        }
                      });
                    };

                    processGroup(currentDocData.hierarchical_chunks?.sections, "section");
                    processGroup(currentDocData.hierarchical_chunks?.passages, "passage");
                    processGroup(currentDocData.hierarchical_chunks?.sentences, "sentence");

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

        {/* ── Top-Level View Tabs ── */}
        <div className="sticky top-[73px] z-[9] bg-[var(--background)] border-b border-[var(--border)] px-8">
          <div className="max-w-3xl mx-auto flex gap-1 py-1">
            {[
              { key: "pipeline" as const, label: "Pipeline", icon: CpuIcon },
              { key: "chunks" as const, label: "Chunk Explorer", icon: NetworkIcon },
              { key: "zeroclaw" as const, label: "Akarshak", icon: ShieldAlertIcon },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setMainViewTab(tab.key);
                  const docId = (() => {
                    if (!selectedJob) return null;
                    const d = jobDetails[selectedJob.job_id];
                    return d?.document_id || selectedJob.document_id || null;
                  })();
                  // Auto-fetch chunk explorer data when switching to it
                  if (tab.key === "chunks" && renderJob.status === "completed") {
                    if (docId && chunkExplorerLoaded !== docId) {
                      setChunkExplorerLoading(true);
                      Promise.all([
                        fetch(`/api/proxy/documents/${docId}/hierarchical`).then(r => r.ok ? r.json() : null),
                        fetch(`/api/proxy/documents/${docId}/recursive`).then(r => r.ok ? r.json() : null),
                      ]).then(([hier, rec]) => {
                        setApiHierarchicalChunks(hier?.chunks || []);
                        setApiRecursiveChunks(rec?.chunks || []);
                        setChunkExplorerLoaded(docId);
                      }).catch(console.error).finally(() => setChunkExplorerLoading(false));
                    }
                  }
                  // Auto-run ZeroClaw when switching to it
                  if (tab.key === "zeroclaw" && renderJob.status === "completed") {
                    if (docId && zeroClawRanFor !== docId) {
                      setZeroClawLoading(true);
                      setZeroClawError(null);
                      setZeroClawData(null);
                      // Fetch chunks first, then run ZeroClaw
                      Promise.all([
                        fetch(`/api/proxy/documents/${docId}/hierarchical`).then(r => r.ok ? r.json() : null),
                        fetch(`/api/proxy/documents/${docId}/recursive`).then(r => r.ok ? r.json() : null),
                      ]).then(async ([hier, rec]) => {
                        const allChunks = [...(hier?.chunks || []), ...(rec?.chunks || [])];
                        if (allChunks.length === 0) {
                          throw new Error("No chunks found for this document");
                        }
                        // Build full text from all chunks for verification
                        const fullText = allChunks.map((c: any) => c.text || "").join(" ");
                        // Run ZeroClaw
                        const zcRes = await fetch("/api/zeroclaw", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ chunks: allChunks, full_text: fullText }),
                        });
                        if (!zcRes.ok) throw new Error(`ZeroClaw API returned ${zcRes.status}`);
                        const zcData = await zcRes.json();
                        setZeroClawData(zcData);
                        setZeroClawRanFor(docId);
                      }).catch((err) => {
                        setZeroClawError(err.message);
                      }).finally(() => setZeroClawLoading(false));
                    }
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-lg transition-all",
                  mainViewTab === tab.key
                    ? "bg-[var(--surface-hover)] text-[var(--foreground)] shadow-sm border border-[var(--border)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] border border-transparent"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════ PIPELINE VIEW ═══════════════ */}
        {mainViewTab === "pipeline" && (
          <>
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

              {/* ── Redaction Security ── */}
              {(() => {
                const redactData = currentDocData?.pii_report || currentDocData?.redaction_info || currentDocData?.redact || currentDocData?.redacted_content || currentDocData?.chunk_metadata?.redact || currentDocData?.chunk_metadata?.redaction_info;
                if (!redactData || (redactData.redaction_count === 0 && !redactData.redactions)) return null;
                return (
                  <div className="mt-10">
                    <h2 className="text-[13px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">
                      Redaction Security
                    </h2>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 relative overflow-hidden">
                      <div className="absolute -right-4 -bottom-4 p-4 opacity-[0.03]">
                        <ShieldAlertIcon className="w-32 h-32 text-rose-500" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldAlertIcon className="w-4 h-4 text-rose-400" />
                          <h3 className="text-sm font-semibold text-rose-400">Content Redaction Applied</h3>
                        </div>
                        <div className="text-[12px] bg-black/40 p-3 rounded-lg border border-white/5 text-[var(--foreground)] opacity-90 leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto">
                          {typeof redactData === "object" ? JSON.stringify(redactData, null, 2) : String(redactData)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── Hierarchical Chunks (inline) ── */}
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
                            <div className="text-[13px] text-[var(--foreground)] leading-relaxed"><RichChunkText text={chunk.text} expanded={true} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════ CHUNK EXPLORER VIEW ═══════════════ */}
        {mainViewTab === "chunks" && (() => {
          // Compute maxChar for document position visualization
          const allChunksForMap = [...apiHierarchicalChunks, ...apiRecursiveChunks];
          const maxCharValue = Math.max(...allChunksForMap.map((c: any) => c.end_char || 0), 1);
          const hierMaxChar = Math.max(...apiHierarchicalChunks.map((c: any) => c.end_char || 0), 1);
          const recMaxChar = Math.max(...apiRecursiveChunks.map((c: any) => c.end_char || 0), 1);

          const filteredHier = chunkSearchQuery
            ? apiHierarchicalChunks.filter((c: any) =>
                c.text?.toLowerCase().includes(chunkSearchQuery.toLowerCase()) ||
                c.heading_path?.toLowerCase().includes(chunkSearchQuery.toLowerCase()) ||
                c.chunk_id?.toLowerCase().includes(chunkSearchQuery.toLowerCase())
              )
            : apiHierarchicalChunks;

          const filteredRec = chunkSearchQuery
            ? apiRecursiveChunks.filter((c: any) =>
                c.text?.toLowerCase().includes(chunkSearchQuery.toLowerCase()) ||
                c.chunk_id?.toLowerCase().includes(chunkSearchQuery.toLowerCase())
              )
            : apiRecursiveChunks;

          return (
            <div className="max-w-4xl mx-auto py-8 px-8 pb-16">
              {renderJob.status !== "completed" ? (
                <div className="text-center py-20 text-[var(--muted)]">
                  <NetworkIcon className="w-12 h-12 mx-auto mb-4 opacity-25" />
                  <p className="text-sm font-medium">Waiting for ingestion to complete</p>
                  <p className="text-[12px] opacity-60 mt-1">Chunk data will be available once processing finishes.</p>
                </div>
              ) : chunkExplorerLoading ? (
                <div className="text-center py-20">
                  <Loader2Icon className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                  <p className="text-sm text-[var(--muted)]">Fetching chunk data from API…</p>
                </div>
              ) : (
                <>
                  {/* Search Bar */}
                  <div className="mb-6">
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                      <input
                        type="text"
                        placeholder="Search chunks by text, heading, or ID…"
                        value={chunkSearchQuery}
                        onChange={(e) => setChunkSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 placeholder:text-[var(--muted)] transition-all"
                      />
                    </div>
                  </div>

                  {/* ── Document Coverage Map ── */}
                  <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <NetworkIcon className="w-4 h-4 text-[var(--muted)]" />
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">Document Coverage Map</h3>
                      </div>
                      <span className="text-[11px] font-mono text-[var(--muted)]">{maxCharValue.toLocaleString()} total chars</span>
                    </div>
                    {/* Coverage bar */}
                    <div className="relative w-full h-8 bg-[#111113] rounded-lg overflow-hidden border border-[var(--border)]">
                      {/* Hierarchical chunk positions */}
                      {apiHierarchicalChunks.map((c: any, i: number) => {
                        const left = ((c.start_char || 0) / maxCharValue) * 100;
                        const width = Math.max(((c.end_char - c.start_char) / maxCharValue) * 100, 0.5);
                        return (
                          <motion.div
                            key={`h-${i}`}
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            transition={{ delay: i * 0.05 + 0.1, duration: 0.3 }}
                            className="absolute top-0 h-[45%] rounded-sm bg-blue-500"
                            style={{ left: `${left}%`, width: `${width}%`, opacity: 0.6 }}
                            title={`Hierarchical #${i + 1}: ${c.start_char}–${c.end_char}`}
                          />
                        );
                      })}
                      {/* Recursive chunk positions */}
                      {apiRecursiveChunks.map((c: any, i: number) => {
                        const left = ((c.start_char || 0) / maxCharValue) * 100;
                        const width = Math.max(((c.end_char - c.start_char) / maxCharValue) * 100, 0.5);
                        return (
                          <motion.div
                            key={`r-${i}`}
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            transition={{ delay: i * 0.05 + 0.3, duration: 0.3 }}
                            className="absolute bottom-0 h-[45%] rounded-sm bg-emerald-500"
                            style={{ left: `${left}%`, width: `${width}%`, opacity: 0.6 }}
                            title={`Recursive #${i + 1}: ${c.start_char}–${c.end_char}`}
                          />
                        );
                      })}
                      {/* Center divider */}
                      <div className="absolute top-[45%] left-0 right-0 h-[10%] bg-[var(--border)] opacity-30" />
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-6 mt-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-2 rounded-sm bg-blue-500 opacity-60" />
                        <span className="text-[10px] text-[var(--muted)]">Hierarchical ({apiHierarchicalChunks.length})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-2 rounded-sm bg-emerald-500 opacity-60" />
                        <span className="text-[10px] text-[var(--muted)]">Recursive ({apiRecursiveChunks.length})</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-center">
                      <SplitIcon className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-400">{apiHierarchicalChunks.length}</p>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">Hierarchical</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                      <BoxIcon className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-emerald-400">{apiRecursiveChunks.length}</p>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">Recursive</p>
                    </div>
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-center">
                      <FileTextIcon className="w-5 h-5 text-violet-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-violet-400">{maxCharValue.toLocaleString()}</p>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">Total Characters</p>
                    </div>
                  </div>

                  {/* ── Hierarchical Chunks — Connected Timeline ── */}
                  <div className="mb-10">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                        <SplitIcon className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Hierarchical Passages</h2>
                        <p className="text-[11px] text-[var(--muted)]">Document structure → semantic passages</p>
                      </div>
                    </div>
                    <div className="pl-0">
                      {filteredHier.map((chunk: any, idx: number) => (
                        <ChunkExplorerCard
                          key={chunk.chunk_id || idx}
                          chunk={chunk}
                          index={idx}
                          variant="hierarchical"
                          totalChunks={filteredHier.length}
                          maxChar={hierMaxChar}
                        />
                      ))}
                      {apiHierarchicalChunks.length === 0 && (
                        <div className="text-center py-10 text-[var(--muted)]">
                          <SplitIcon className="w-8 h-8 mx-auto mb-2 opacity-25" />
                          <p className="text-sm">No hierarchical chunks available.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Visual Separator ── */}
                  <div className="flex items-center gap-4 my-8">
                    <div className="flex-1 h-px bg-gradient-to-r from-blue-500/30 to-transparent" />
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-raised)] border border-[var(--border)] rounded-full">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-[10px] text-[var(--muted)] font-medium">→</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-l from-emerald-500/30 to-transparent" />
                  </div>

                  {/* ── Recursive Chunks — Connected Timeline ── */}
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                        <BoxIcon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Recursive Blocks</h2>
                        <p className="text-[11px] text-[var(--muted)]">Full document merged into contiguous blocks</p>
                      </div>
                    </div>
                    <div className="pl-0">
                      {filteredRec.map((chunk: any, idx: number) => (
                        <ChunkExplorerCard
                          key={chunk.chunk_id || idx}
                          chunk={chunk}
                          index={idx}
                          variant="recursive"
                          totalChunks={filteredRec.length}
                          maxChar={recMaxChar}
                        />
                      ))}
                      {apiRecursiveChunks.length === 0 && (
                        <div className="text-center py-10 text-[var(--muted)]">
                          <BoxIcon className="w-8 h-8 mx-auto mb-2 opacity-25" />
                          <p className="text-sm">No recursive chunks available.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}
        {/* ═══════════════ ZEROCLAW GOVERNANCE VIEW ═══════════════ */}
        {mainViewTab === "zeroclaw" && (
          <div className="max-w-4xl mx-auto py-8 px-8 pb-16">
            {renderJob.status !== "completed" ? (
              <div className="text-center py-20 text-[var(--muted)]">
                <ShieldAlertIcon className="w-12 h-12 mx-auto mb-4 opacity-25" />
                <p className="text-sm font-medium">Waiting for ingestion to complete</p>
                <p className="text-[12px] opacity-60 mt-1">Akarshak will audit chunks once processing finishes.</p>
              </div>
            ) : zeroClawLoading ? (
              <div className="text-center py-20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="w-12 h-12 mx-auto mb-4"
                >
                  <ScanEyeIcon className="w-12 h-12 text-cyan-500" />
                </motion.div>
                <p className="text-sm text-[var(--foreground)] font-medium">Running Akarshak Audit…</p>
                <p className="text-[12px] text-[var(--muted)] mt-1">Verifying, checksumming, and scanning for conflicts</p>
              </div>
            ) : zeroClawError ? (
              <div className="text-center py-20 text-[var(--muted)]">
                <AlertCircleIcon className="w-10 h-10 mx-auto mb-4 text-red-400" />
                <p className="text-sm font-medium text-red-400">Akarshak Audit Failed</p>
                <p className="text-[12px] text-[var(--muted)] mt-1">{zeroClawError}</p>
                <button
                  onClick={() => { setZeroClawRanFor(null); setMainViewTab("zeroclaw"); }}
                  className="mt-4 px-4 py-2 text-sm bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : zeroClawData ? (() => {
              const summary = zeroClawData.summary;
              const chunks = zeroClawData.chunks || [];

              // Filter chunks
              const filteredChunks = chunks.filter((c: any) => {
                if (zeroClawFilter === "verified") return c.verified;
                if (zeroClawFilter === "unverified") return !c.verified;
                if (zeroClawFilter === "conflicts") return c.conflicts.length > 0;
                return true;
              });

              // Integrity score gradient
              const score = summary.integrity_score || 0;
              const scoreColor = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
              const scoreBg = score >= 80 ? "from-emerald-500/20" : score >= 50 ? "from-amber-500/20" : "from-red-500/20";
              const scoreRingColor = score >= 80 ? "stroke-emerald-500" : score >= 50 ? "stroke-amber-500" : "stroke-red-500";

              return (
                <>
                  {/* ── Integrity Score Hero ── */}
                  <div className={cn("rounded-2xl border border-[var(--border)] bg-gradient-to-b to-transparent p-8 mb-8 text-center", scoreBg)}>
                    <div className="flex items-center justify-center gap-8">
                      {/* Score Ring */}
                      <div className="relative w-32 h-32">
                        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-[var(--border)]" />
                          <motion.circle
                            cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round"
                            className={scoreRingColor}
                            strokeDasharray={`${2 * Math.PI * 52}`}
                            initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - score / 100) }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={cn("text-3xl font-bold", scoreColor)}>{score}</span>
                          <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Score</span>
                        </div>
                      </div>
                      {/* Summary Stats */}
                      <div className="text-left space-y-3">
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">Akarshak Integrity Report</h2>
                        <p className="text-[12px] text-[var(--muted)]">
                          Audit completed at {new Date(summary.timestamp).toLocaleTimeString()}
                        </p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-[12px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[var(--muted)]">Verified:</span>
                            <span className="font-semibold text-emerald-400">{summary.verified_count}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[var(--muted)]">Unverified:</span>
                            <span className="font-semibold text-red-400">{summary.unverified_count}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-[var(--muted)]">Conflicts:</span>
                            <span className="font-semibold text-amber-400">{summary.conflict_pairs} pairs</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-cyan-500" />
                            <span className="text-[var(--muted)]">Avg Confidence:</span>
                            <span className="font-semibold text-cyan-400">{Math.round(summary.avg_confidence * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Stat Cards ── */}
                  <div className="grid grid-cols-4 gap-3 mb-8">
                    {[
                      { icon: CheckCircle2Icon, label: "Verified", value: summary.verified_count, color: "emerald" },
                      { icon: AlertCircleIcon, label: "Unverified", value: summary.unverified_count, color: "red" },
                      { icon: AlertTriangleIcon, label: "Conflicts", value: summary.conflicting_chunks, color: "amber" },
                      { icon: FingerprintIcon, label: "Checksummed", value: summary.total_chunks, color: "cyan" },
                    ].map(({ icon: Icon, label, value, color }) => (
                      <div key={label} className={cn("rounded-xl border p-4 text-center",
                        `border-${color}-500/20 bg-${color}-500/5`
                      )}>
                        <Icon className={cn("w-5 h-5 mx-auto mb-2", `text-${color}-400`)} />
                        <p className={cn("text-xl font-bold", `text-${color}-400`)}>{value}</p>
                        <p className="text-[10px] text-[var(--muted)] mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Filter Tabs ── */}
                  <div className="flex gap-1 mb-6 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-1">
                    {[
                      { key: "all" as const, label: "All", count: chunks.length },
                      { key: "verified" as const, label: "Verified", count: summary.verified_count },
                      { key: "unverified" as const, label: "Unverified", count: summary.unverified_count },
                      { key: "conflicts" as const, label: "Conflicts", count: summary.conflicting_chunks },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setZeroClawFilter(f.key)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[12px] font-medium transition-colors",
                          zeroClawFilter === f.key
                            ? "bg-[var(--surface-hover)] text-[var(--foreground)] shadow-sm"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        )}
                      >
                        {f.label}
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full",
                          zeroClawFilter === f.key
                            ? "bg-[var(--foreground)]/10 text-[var(--foreground)]"
                            : "bg-[var(--surface-hover)] text-[var(--muted)]"
                        )}>{f.count}</span>
                      </button>
                    ))}
                  </div>

                  {/* ── Chunk Audit Cards (Connected Timeline) ── */}
                  <div>
                    {filteredChunks.map((chunk: any, idx: number) => {
                      const isVerified = chunk.verified;
                      const hasConflicts = chunk.conflicts.length > 0;
                      const confidencePct = Math.round(chunk.confidence * 100);
                      const isLast = idx === filteredChunks.length - 1;

                      return (
                        <motion.div
                          key={chunk.chunk_id || idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04, type: "spring", stiffness: 200 }}
                          className="relative flex gap-0"
                        >
                          {/* Timeline node */}
                          <div className="flex flex-col items-center w-12 shrink-0 pt-5 relative">
                            {idx > 0 && <div className={cn("absolute top-0 w-0.5 h-5",
                              isVerified ? "bg-emerald-500/20" : "bg-red-500/20"
                            )} />}
                            <div className="relative z-10">
                              <div className={cn("w-4 h-4 rounded-full border-2 transition-all",
                                isVerified
                                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                  : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                              )}>
                                {isVerified
                                  ? <CheckIcon className="w-2.5 h-2.5 text-white absolute top-[3px] left-[3px]" />
                                  : <XIcon className="w-2.5 h-2.5 text-white absolute top-[3px] left-[3px]" />
                                }
                              </div>
                            </div>
                            {!isLast && <div className={cn("flex-1 w-0.5 min-h-[20px]",
                              isVerified ? "bg-emerald-500/15" : "bg-red-500/15"
                            )} />}
                          </div>

                          {/* Card */}
                          <div className="flex-1 mb-3 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface-raised)] hover:shadow-lg transition-all">
                            {/* Gradient bar */}
                            <div className={cn("h-0.5 bg-gradient-to-r",
                              isVerified
                                ? "from-emerald-500/40 via-emerald-500/15 to-transparent"
                                : "from-red-500/40 via-red-500/15 to-transparent"
                            )} />

                            <div className="px-4 py-3.5">
                              {/* Header row */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[14px] font-bold text-[var(--foreground)] tabular-nums">
                                    {String(idx + 1).padStart(2, "0")}
                                  </span>
                                  {/* Verified badge */}
                                  <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                    isVerified
                                      ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/25"
                                      : "bg-red-500/12 text-red-400 border-red-500/25"
                                  )}>
                                    {isVerified ? "VERIFIED" : "UNVERIFIED"}
                                  </span>
                                  {/* Level */}
                                  <span className="text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--muted)] border border-[var(--border)]">
                                    {chunk.level || "chunk"}
                                  </span>
                                  {/* Conflict badge */}
                                  {hasConflicts && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-400 border border-amber-500/25 flex items-center gap-1">
                                      <AlertTriangleIcon className="w-2.5 h-2.5" />
                                      {chunk.conflicts.length} CONFLICT{chunk.conflicts.length > 1 ? "S" : ""}
                                    </span>
                                  )}
                                </div>
                                {/* Confidence meter */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="w-16 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${confidencePct}%` }}
                                      transition={{ delay: idx * 0.04 + 0.3, duration: 0.5 }}
                                      className={cn("h-full rounded-full",
                                        confidencePct >= 80 ? "bg-emerald-500" :
                                        confidencePct >= 50 ? "bg-amber-500" : "bg-red-500"
                                      )}
                                    />
                                  </div>
                                  <span className={cn("text-[10px] font-mono font-bold",
                                    confidencePct >= 80 ? "text-emerald-400" :
                                    confidencePct >= 50 ? "text-amber-400" : "text-red-400"
                                  )}>{confidencePct}%</span>
                                </div>
                              </div>

                              {/* Text preview */}
                              <div className="text-[13px] leading-relaxed text-[var(--foreground)]/90 line-clamp-2 mb-3">
                                <RichChunkText text={chunk.text} />
                              </div>

                              {/* Meta row */}
                              <div className="flex items-center gap-4 text-[10px] text-[var(--muted)] font-mono flex-wrap">
                                <span className="flex items-center gap-1">
                                  <FingerprintIcon className="w-3 h-3 opacity-50" />
                                  {chunk.checksum?.slice(0, 12)}…
                                </span>
                                <span>chars {chunk.start_char}–{chunk.end_char}</span>
                                <span>{chunk.text_length} chars</span>
                                {chunk.source_coverage > 0 && (
                                  <span>{chunk.source_coverage}% coverage</span>
                                )}
                              </div>

                              {/* Conflict Details */}
                              {hasConflicts && (
                                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <LinkIcon className="w-3 h-3 text-amber-400" />
                                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                                      Conflict Details
                                    </span>
                                  </div>
                                  {chunk.conflict_details?.map((cd: any, ci: number) => (
                                    <div key={ci} className="flex items-start gap-2 text-[11px] text-[var(--muted)] mt-1">
                                      <AlertTriangleIcon className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                                      <span>{cd.reason}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    {filteredChunks.length === 0 && (
                      <div className="text-center py-12 text-[var(--muted)]">
                        <ShieldAlertIcon className="w-8 h-8 mx-auto mb-3 opacity-25" />
                        <p className="text-sm">No chunks match the selected filter.</p>
                      </div>
                    )}
                  </div>
                </>
              );
            })() : (
              <div className="text-center py-20 text-[var(--muted)]">
                <ShieldAlertIcon className="w-12 h-12 mx-auto mb-4 opacity-25" />
                <p className="text-sm font-medium">No audit data available</p>
                <p className="text-[12px] opacity-60 mt-1">Switch to a completed document to run Akarshak.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
