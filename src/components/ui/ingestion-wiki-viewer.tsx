"use client";

import React, { useState } from "react";
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
  ChevronRightIcon,
  DatabaseIcon,
  BrainCircuitIcon,
  FileSearchIcon,
  CpuIcon,
  CheckIcon
} from "lucide-react";

type IngestionStatus = "pending" | "processing" | "completed" | "failed";

type FileIngestion = {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "image" | "docx" | "csv" | "other";
  status: IngestionStatus;
  uploadedAt: string;
  stages: {
    id: string;
    label: string;
    description: string;
    status: IngestionStatus;
    logs: string[];
    timeMs?: number;
  }[];
};

const MOCK_FILES: FileIngestion[] = [
  {
    id: "f1",
    name: "Q1_Financial_Report.pdf",
    size: "4.2 MB",
    type: "pdf",
    status: "completed",
    uploadedAt: "10 mins ago",
    stages: [
      { id: "s1", label: "Document Ingestion", description: "Fetch from Uploadcare CDN", status: "completed", logs: ["Downloaded 4.2 MB across 1 chunk", "Verified SHA256 checksum"], timeMs: 450 },
      { id: "s2", label: "OCR & Parsing", description: "Extract text and layout", status: "completed", logs: ["Used PDFMiner wrapper", "Extracted 42 pages text", "Identified 14 tables"], timeMs: 2300 },
      { id: "s3", label: "Semantic Chunking", description: "Split doc safely", status: "completed", logs: ["Applied recursive character tri-split", "Created 185 semantic chunks"], timeMs: 890 },
      { id: "s4", label: "Entity Extraction", description: "Extract NLP entities", status: "completed", logs: ["Found 24 Organizations, 8 Persons, 12 Concepts", "Created relationship triplets"], timeMs: 3100 },
      { id: "s5", label: "Vector Embedding", description: "Generate dense vectors", status: "completed", logs: ["Used text-embedding-3-small (1536 dim)", "Embedded 185 chunks successfully"], timeMs: 1400 },
      { id: "s6", label: "DB Indexing", description: "Pinecone and Neo4j sync", status: "completed", logs: ["Upserted 185 vectors into Pinecone", "Created 44 property nodes in Neo4j"], timeMs: 600 },
    ]
  },
  {
    id: "f2",
    name: "System_Architecture_v2.docx",
    size: "1.8 MB",
    type: "docx",
    status: "processing",
    uploadedAt: "Just now",
    stages: [
      { id: "s1", label: "Document Ingestion", description: "Fetch from Uploadcare CDN", status: "completed", logs: ["Downloaded 1.8 MB"], timeMs: 250 },
      { id: "s2", label: "OCR & Parsing", description: "Extract text and layout", status: "completed", logs: ["Parsed XML structure"], timeMs: 500 },
      { id: "s3", label: "Semantic Chunking", description: "Split doc safely", status: "completed", logs: ["Generated 45 chunks"], timeMs: 400 },
      { id: "s4", label: "Entity Extraction", description: "Extract NLP entities", status: "processing", logs: ["Analyzing chunk 12/45...", "Found 3 novel architecture concepts"], timeMs: undefined },
      { id: "s5", label: "Vector Embedding", description: "Generate dense vectors", status: "pending", logs: [] },
      { id: "s6", label: "DB Indexing", description: "Pinecone and Neo4j sync", status: "pending", logs: [] },
    ]
  },
  {
    id: "f3",
    name: "Customer_Interviews_Transcript.csv",
    size: "890 KB",
    type: "csv",
    status: "pending",
    uploadedAt: "in queue",
    stages: [
      { id: "s1", label: "Document Ingestion", description: "Fetch from Uploadcare CDN", status: "pending", logs: [] },
      { id: "s2", label: "OCR & Parsing", description: "Extract text and layout", status: "pending", logs: [] },
      { id: "s3", label: "Semantic Chunking", description: "Split doc safely", status: "pending", logs: [] },
      { id: "s4", label: "Entity Extraction", description: "Extract NLP entities", status: "pending", logs: [] },
      { id: "s5", label: "Vector Embedding", description: "Generate dense vectors", status: "pending", logs: [] },
      { id: "s6", label: "DB Indexing", description: "Pinecone and Neo4j sync", status: "pending", logs: [] },
    ]
  }
];

const getFileIcon = (type: string) => {
  switch (type) {
    case "pdf": return <FileTextIcon className="text-red-500 w-5 h-5" />;
    case "image": return <FileImageIcon className="text-blue-500 w-5 h-5" />;
    case "docx": return <FileTextIcon className="text-blue-700 w-5 h-5" />;
    case "csv": return <FileArchiveIcon className="text-emerald-500 w-5 h-5" />;
    default: return <FileIcon className="text-[var(--muted)] w-5 h-5" />;
  }
};

const getStatusIcon = (status: IngestionStatus) => {
  switch (status) {
    case "completed": return <CheckCircle2Icon className="w-4 h-4 text-emerald-500" />;
    case "processing": return <Loader2Icon className="w-4 h-4 text-blue-500 animate-spin" />;
    case "failed": return <CircleDashedIcon className="w-4 h-4 text-red-500" />;
    default: return <CircleDashedIcon className="w-4 h-4 text-[var(--muted)]" />;
  }
};

const getStageIcon = (index: number, status: IngestionStatus) => {
  if (status === "completed") return <CheckIcon className="w-4 h-4 text-white" />;
  if (status === "processing") return <Loader2Icon className="w-4 h-4 text-white animate-spin" />;
  
  const icons = [FileSearchIcon, CpuIcon, BrainCircuitIcon, DatabaseIcon, CpuIcon, DatabaseIcon];
  const Icon = icons[index] || FileIcon;
  return <Icon className="w-4 h-4 text-[var(--muted)]" />;
};

export function IngestionWikiViewer() {
  const [selectedFileId, setSelectedFileId] = useState<string>(MOCK_FILES[0].id);

  const selectedFile = MOCK_FILES.find((f) => f.id === selectedFileId)!;

  return (
    <div className="flex h-full w-full bg-[var(--background)] overflow-hidden">
      {/* Sidebar / List of Files */}
      <div className="w-80 border-r border-[var(--border)] bg-[var(--surface-raised)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)] mb-1">
            Ingestion Wiki
          </h2>
          <p className="text-[13px] text-[var(--muted)]">
            Monitor chunking & vectorization pipelines.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {MOCK_FILES.map((file) => (
            <button
              key={file.id}
              onClick={() => setSelectedFileId(file.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors",
                selectedFileId === file.id
                  ? "bg-[var(--surface-hover)] border border-[var(--border)]"
                  : "hover:bg-[var(--surface-hover)] border border-transparent"
              )}
            >
              <div className="shrink-0">{getFileIcon(file.type)}</div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[13px] font-medium truncate",
                  selectedFileId === file.id ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                )}>
                  {file.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    {getStatusIcon(file.status)}
                    <span className="capitalize">{file.status}</span>
                  </span>
                  <span>•</span>
                  <span>{file.size}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Pipeline View */}
      <div className="flex-1 overflow-y-auto bg-[var(--background)] relative">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--border)] px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl">
              {getFileIcon(selectedFile.type)}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{selectedFile.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-[13px] text-[var(--muted)]">
                <span>{selectedFile.size}</span>
                <span>•</span>
                <span>Uploaded {selectedFile.uploadedAt}</span>
              </div>
            </div>
          </div>
          <div className={cn(
            "px-3 py-1.5 rounded-full text-[13px] font-medium flex items-center gap-1.5 border",
            selectedFile.status === "completed" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
            selectedFile.status === "processing" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
            "bg-[var(--surface-hover)] text-[var(--muted)] border-[var(--border)]"
          )}>
            {getStatusIcon(selectedFile.status)}
            <span className="capitalize">{selectedFile.status}</span>
          </div>
        </div>

        {/* Pipeline Timeline */}
        <div className="max-w-3xl mx-auto py-10 px-8">
          <h2 className="text-[13px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-6">
            Processing Pipeline
          </h2>
          
          <div className="space-y-6 relative">
            {/* Connecting line */}
            <div className="absolute left-[19px] top-4 bottom-10 w-0.5 bg-[var(--border)]" />

            {selectedFile.stages.map((stage, idx) => {
              const isCompleted = stage.status === "completed";
              const isProcessing = stage.status === "processing";
              const isPending = stage.status === "pending";

              return (
                <div key={stage.id} className="relative flex gap-6">
                  {/* Node icon */}
                  <div className={cn(
                    "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 shrink-0 transition-colors duration-500",
                    isCompleted ? "bg-emerald-500 border-emerald-500" :
                    isProcessing ? "bg-blue-500 border-blue-500" :
                    "bg-[var(--surface)] border-[var(--border)]"
                  )}>
                    {getStageIcon(idx, stage.status)}
                  </div>

                  {/* Node Content */}
                  <div className="flex-1 pt-1 pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className={cn(
                          "text-base font-medium",
                          isPending ? "text-[var(--muted)]" : "text-[var(--foreground)]"
                        )}>
                          {stage.label}
                        </h3>
                        <p className="text-[13px] text-[var(--muted)]">{stage.description}</p>
                      </div>
                      {stage.timeMs && (
                        <span className="text-[11px] font-mono text-[var(--muted)] bg-[var(--surface-hover)] px-2 py-1 rounded">
                          {stage.timeMs}ms
                        </span>
                      )}
                    </div>

                    {/* Output / terminal logs for this step */}
                    <AnimatePresence>
                      {!isPending && stage.logs.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 bg-[#0d0d0f] border border-[#27272a] rounded-lg p-3 text-[12px] font-mono text-[#a1a1aa] shadow-inner overflow-hidden"
                        >
                          <div className="space-y-1.5">
                            {stage.logs.map((log, i) => (
                              <div key={i} className="flex gap-2">
                                <span className="text-[#3f3f46]">›</span>
                                <span className="text-[#e4e4e7]">{log}</span>
                              </div>
                            ))}
                            {isProcessing && (
                              <div className="flex gap-2 animate-pulse">
                                <span className="text-[#3b82f6]">›</span>
                                <span className="text-[#3b82f6]">processing...</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
