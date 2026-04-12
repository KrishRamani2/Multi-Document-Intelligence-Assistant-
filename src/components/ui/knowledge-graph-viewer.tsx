"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  SearchIcon,
  ActivityIcon,
  GitGraphIcon,
  Share2Icon,
  DownloadIcon,
  Loader2Icon,
  FileTextIcon,
  BookOpenIcon,
  MessageSquareIcon,
  TypeIcon,
  NetworkIcon,
  ZapIcon,
  XIcon,
  ChevronRightIcon,
  EyeIcon,
  RefreshCwIcon,
  ExpandIcon,
  AlertCircleIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// ─── Types ─────────────────────────────────────────────────────────────────

type GNode = {
  id: string;
  name: string;
  val: number;
  color: string;
  group: string;
  docId?: string;
  level?: string;
  text?: string;
  chunkId?: string;
  charRange?: string;
  headingPath?: string;
};

type GLink = {
  source: string;
  target: string;
  label?: string;
  color?: string;
};

type GraphData = { nodes: GNode[]; links: GLink[] };

type DocSummary = {
  document_id: string;
  source_name: string;
  source_type: string;
  sections_count: number;
  passages_count: number;
  sentences_count: number;
  recursive_chunks_count: number;
};

// ─── Colors ────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  document: "#ef4444",
  section: "#3b82f6",
  passage: "#10b981",
  sentence: "#f59e0b",
  recursive: "#8b5cf6",
  entity: "#ec4899",
  table: "#06b6d4",
  image: "#f97316",
};

const GROUP_LABELS: Record<string, { icon: any; label: string }> = {
  document: { icon: FileTextIcon, label: "Document" },
  section: { icon: BookOpenIcon, label: "Section" },
  passage: { icon: MessageSquareIcon, label: "Passage" },
  sentence: { icon: TypeIcon, label: "Sentence" },
  recursive: { icon: NetworkIcon, label: "Recursive" },
  entity: { icon: ZapIcon, label: "Entity" },
  table: { icon: ActivityIcon, label: "Table" },
  image: { icon: EyeIcon, label: "Image" },
};

// ─── Entity Extraction (lightweight NLP) ───────────────────────────────────

function extractEntities(text: string): string[] {
  if (!text || text.length < 10) return [];
  const entities: Set<string> = new Set();

  // Capitalized proper nouns (2+ words)
  const properNounRe = /(?:^|[.!?\n]\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
  let m;
  while ((m = properNounRe.exec(text)) !== null) {
    const name = m[1].trim();
    if (name.length > 3 && name.length < 60) entities.add(name);
  }

  // Single capitalized words that aren't sentence starters (heuristic)
  const words = text.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^a-zA-Z]/g, "");
    if (w.length >= 4 && /^[A-Z][a-z]+$/.test(w)) {
      // Skip common words
      const common = new Set(["This", "That", "These", "Those", "There", "Their", "Here", "When", "Where", "What", "Which", "With", "From", "About", "After", "Before", "During", "Between", "Through", "Above", "Below", "Under", "Over", "Each", "Every", "Some", "Many", "Most", "Such", "Other", "Another"]);
      if (!common.has(w)) entities.add(w);
    }
  }

  return Array.from(entities).slice(0, 8); // cap at 8 per chunk
}

// ─── Build Graph from Document Data ────────────────────────────────────────

function buildGraphFromDocument(docData: any): GraphData {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const entityMap = new Map<string, string>(); // entity name -> node id

  const docId = docData.document_id;
  const docName = docData.source_name || docId.slice(0, 8);

  // Document root node
  nodes.push({
    id: docId,
    name: docName,
    val: 12,
    color: NODE_COLORS.document,
    group: "document",
    docId,
    text: `Source: ${docData.source_type} | Sections: ${docData.sections_count} | Passages: ${docData.passages_count} | Sentences: ${docData.sentences_count}`,
  });

  const processChunks = (chunks: any[], level: string, parentId: string) => {
    if (!chunks) return;
    chunks.forEach((chunk: any, idx: number) => {
      const nodeId = chunk.chunk_id || `${parentId}-${level}-${idx}`;
      const label = chunk.heading_path
        ? chunk.heading_path.split(" > ").pop() || `${level} ${idx + 1}`
        : `${level.charAt(0).toUpperCase() + level.slice(1)} ${idx + 1}`;

      nodes.push({
        id: nodeId,
        name: label.length > 40 ? label.slice(0, 37) + "…" : label,
        val: level === "section" ? 8 : level === "passage" ? 5 : 3,
        color: NODE_COLORS[level] || NODE_COLORS.sentence,
        group: level,
        docId,
        level,
        text: chunk.text?.slice(0, 200),
        chunkId: chunk.chunk_id,
        charRange: `${chunk.start_char}–${chunk.end_char}`,
        headingPath: chunk.heading_path,
      });

      links.push({
        source: parentId,
        target: nodeId,
        label: `has_${level}`,
        color: `${NODE_COLORS[level]}66`,
      });

      // Extract entities from chunk text
      const entities = extractEntities(chunk.text || "");
      entities.forEach((entityName) => {
        const entityKey = entityName.toLowerCase();
        let entityNodeId = entityMap.get(entityKey);
        if (!entityNodeId) {
          entityNodeId = `entity-${entityKey.replace(/\s+/g, "-")}`;
          entityMap.set(entityKey, entityNodeId);
          nodes.push({
            id: entityNodeId,
            name: entityName,
            val: 4,
            color: NODE_COLORS.entity,
            group: "entity",
          });
        }
        links.push({
          source: nodeId,
          target: entityNodeId,
          label: "mentions",
          color: `${NODE_COLORS.entity}44`,
        });
      });

      // Process nested tables
      if (chunk.tables && Array.isArray(chunk.tables)) {
        chunk.tables.forEach((t: any, ti: number) => {
          const tableNodeId = `${nodeId}-table-${ti}`;
          nodes.push({
            id: tableNodeId,
            name: `Table (p.${t.page || "?"})`,
            val: 4,
            color: NODE_COLORS.table,
            group: "table",
            text: t.text?.slice(0, 150),
          });
          links.push({ source: nodeId, target: tableNodeId, label: "contains_table", color: `${NODE_COLORS.table}66` });
        });
      }
      // Process nested images
      if (chunk.images && Array.isArray(chunk.images)) {
        chunk.images.forEach((img: any, ii: number) => {
          const imgNodeId = `${nodeId}-img-${ii}`;
          nodes.push({
            id: imgNodeId,
            name: `Image (p.${img.page || "?"})`,
            val: 3,
            color: NODE_COLORS.image,
            group: "image",
            text: img.text?.slice(0, 150),
          });
          links.push({ source: nodeId, target: imgNodeId, label: "contains_image", color: `${NODE_COLORS.image}66` });
        });
      }
    });
  };

  // Process hierarchical chunks
  const hier = docData.hierarchical_chunks;
  if (hier) {
    processChunks(hier.sections, "section", docId);

    // Connect sections to their passages (by heading path proximity)
    if (hier.sections && hier.passages) {
      hier.passages.forEach((passage: any, idx: number) => {
        const passageId = passage.chunk_id || `${docId}-passage-${idx}`;
        // Find closest section by character position
        let bestSection = docId;
        let bestDist = Infinity;
        hier.sections.forEach((sec: any) => {
          const dist = Math.abs((passage.start_char || 0) - (sec.start_char || 0));
          if (dist < bestDist && (passage.start_char || 0) >= (sec.start_char || 0)) {
            bestDist = dist;
            bestSection = sec.chunk_id || docId;
          }
        });
        processChunks([passage], "passage", bestSection);
      });
    } else {
      processChunks(hier.passages, "passage", docId);
    }

    // Connect sentences similarly
    if (hier.sections && hier.sentences) {
      hier.sentences.forEach((sent: any, idx: number) => {
        let bestPassage = docId;
        let bestDist = Infinity;
        (hier.passages || []).forEach((p: any) => {
          const dist = Math.abs((sent.start_char || 0) - (p.start_char || 0));
          if (dist < bestDist && (sent.start_char || 0) >= (p.start_char || 0)) {
            bestDist = dist;
            bestPassage = p.chunk_id || docId;
          }
        });
        processChunks([sent], "sentence", bestPassage);
      });
    } else {
      processChunks(hier.sentences, "sentence", docId);
    }
  }

  // Process recursive chunks
  if (docData.recursive_chunks) {
    processChunks(docData.recursive_chunks, "recursive", docId);
  }

  // Deduplicate nodes (by id)
  const seen = new Set<string>();
  const uniqueNodes = nodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  return { nodes: uniqueNodes, links };
}

// ─── Build a combined graph from multiple documents ────────────────────────

function buildCombinedGraph(docs: any[]): GraphData {
  const allNodes: GNode[] = [];
  const allLinks: GLink[] = [];

  docs.forEach((doc) => {
    const { nodes, links } = buildGraphFromDocument(doc);
    allNodes.push(...nodes);
    allLinks.push(...links);
  });

  // Cross-document entity linking — entities with same name get merged
  const entityIds = new Map<string, string>();
  const finalNodes: GNode[] = [];
  
  allNodes.forEach((node) => {
    if (node.group === "entity") {
      const key = node.name.toLowerCase();
      if (entityIds.has(key)) {
        // Merge: update links to point to existing entity
        const existingId = entityIds.get(key)!;
        allLinks.forEach((link) => {
          if (link.source === node.id) link.source = existingId;
          if (link.target === node.id) link.target = existingId;
        });
        // Increase size of existing entity
        const existing = finalNodes.find((n) => n.id === existingId);
        if (existing) existing.val = Math.min(existing.val + 2, 14);
      } else {
        entityIds.set(key, node.id);
        finalNodes.push(node);
      }
    } else {
      finalNodes.push(node);
    }
  });

  // Filter out self-links and duplicates
  const linkSet = new Set<string>();
  const finalLinks = allLinks.filter((l) => {
    const key = `${typeof l.source === 'object' ? (l.source as any).id : l.source}-${typeof l.target === 'object' ? (l.target as any).id : l.target}`;
    if (l.source === l.target) return false;
    if (linkSet.has(key)) return false;
    linkSet.add(key);
    return true;
  });

  return { nodes: finalNodes, links: finalLinks };
}

// ─── Node Detail Panel ────────────────────────────────────────────────────

function NodeDetailPanel({ node, onClose }: { node: GNode | null; onClose: () => void }) {
  if (!node) return null;
  const groupInfo = GROUP_LABELS[node.group] || GROUP_LABELS.entity;
  const Icon = groupInfo.icon;

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: "spring", damping: 24 }}
      className="absolute top-14 right-0 bottom-0 w-80 bg-[var(--surface-raised)] border-l border-[var(--border)] z-20 flex flex-col shadow-2xl"
    >
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${node.color}20` }}>
            <Icon className="w-4 h-4" style={{ color: node.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-[var(--foreground)]">{node.name}</p>
            <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: node.color }}>{groupInfo.label}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] text-[var(--muted)]">
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {node.chunkId && (
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold mb-1">Chunk ID</p>
            <p className="text-[11px] font-mono text-[var(--foreground)] break-all bg-[var(--surface-hover)] px-2 py-1.5 rounded-md">{node.chunkId}</p>
          </div>
        )}
        {node.headingPath && (
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold mb-1">Heading Path</p>
            <p className="text-[12px] text-[var(--foreground)]">{node.headingPath}</p>
          </div>
        )}
        {node.charRange && (
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold mb-1">Character Range</p>
            <p className="text-[12px] font-mono text-[var(--foreground)]">{node.charRange}</p>
          </div>
        )}
        {node.text && (
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold mb-1">Text Preview</p>
            <p className="text-[12px] text-[var(--foreground)]/80 leading-relaxed bg-[var(--surface-hover)] p-3 rounded-lg border border-[var(--border)]">
              {node.text}
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
            <p className="text-[10px] text-[var(--muted)] mb-1">Size</p>
            <p className="text-lg font-bold" style={{ color: node.color }}>{node.val}</p>
          </div>
          <div className="flex-1 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
            <p className="text-[10px] text-[var(--muted)] mb-1">Group</p>
            <p className="text-lg font-bold capitalize" style={{ color: node.color }}>{node.group}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function KnowledgeGraphDashboard() {
  const [documents, setDocuments] = useState<DocSummary[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docDataCache, setDocDataCache] = useState<Record<string, any>>({});
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);

  // ── Load documents from localStorage (same source as IngestionWiki) ──
  useEffect(() => {
    const loadDocs = () => {
      const jobs = JSON.parse(localStorage.getItem("axiom_ingestion_jobs") || "[]");
      const completedDocs: DocSummary[] = jobs
        .filter((j: any) => j.document_id && (j.status === "completed" || j.status === "done"))
        .map((j: any) => ({
          document_id: j.document_id,
          source_name: j.name || j.document_id.slice(0, 12),
          source_type: j.type || "unknown",
          sections_count: 0,
          passages_count: 0,
          sentences_count: 0,
          recursive_chunks_count: 0,
        }));
      
      setDocuments(completedDocs);
      if (completedDocs.length > 0 && !selectedDocId) {
        setSelectedDocId(completedDocs[0].document_id);
      }
    };
    loadDocs();
    window.addEventListener("axiom_jobs_updated", loadDocs);
    return () => window.removeEventListener("axiom_jobs_updated", loadDocs);
  }, []);

  // ── Fetch document details and build graph ──
  useEffect(() => {
    if (!selectedDocId && !showAll) return;

    const fetchAndBuild = async () => {
      setLoading(true);
      setError(null);
      setSelectedNode(null);

      try {
        if (showAll) {
          // Fetch ALL documents
          const allDocs: any[] = [];
          for (const doc of documents) {
            if (docDataCache[doc.document_id]) {
              allDocs.push(docDataCache[doc.document_id]);
            } else {
              const res = await fetch(`/api/proxy/documents/${doc.document_id}`);
              if (res.ok) {
                const data = await res.json();
                allDocs.push(data);
                setDocDataCache((prev) => ({ ...prev, [doc.document_id]: data }));
              }
            }
          }
          if (allDocs.length > 0) {
            setGraphData(buildCombinedGraph(allDocs));
          } else {
            setError("No document data available");
          }
        } else if (selectedDocId) {
          if (docDataCache[selectedDocId]) {
            setGraphData(buildGraphFromDocument(docDataCache[selectedDocId]));
          } else {
            const res = await fetch(`/api/proxy/documents/${selectedDocId}`);
            if (!res.ok) throw new Error(`API returned ${res.status}`);
            const data = await res.json();
            setDocDataCache((prev) => ({ ...prev, [selectedDocId]: data }));
            setGraphData(buildGraphFromDocument(data));
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAndBuild();
  }, [selectedDocId, showAll, documents]);

  // ── Resize observer ──
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Node click ──
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as GNode);
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(6, 1000);
    }
  }, []);

  // ── Search filter ──
  const filteredGraphData = useMemo(() => {
    if (!searchQuery.trim()) return graphData;
    const q = searchQuery.toLowerCase();
    const matchingNodeIds = new Set(
      graphData.nodes.filter((n) => n.name.toLowerCase().includes(q) || n.group.includes(q)).map((n) => n.id)
    );
    // Also include nodes connected to matches
    graphData.links.forEach((l) => {
      const src = typeof l.source === "object" ? (l.source as any).id : l.source;
      const tgt = typeof l.target === "object" ? (l.target as any).id : l.target;
      if (matchingNodeIds.has(src)) matchingNodeIds.add(tgt);
      if (matchingNodeIds.has(tgt)) matchingNodeIds.add(src);
    });
    return {
      nodes: graphData.nodes.filter((n) => matchingNodeIds.has(n.id)),
      links: graphData.links.filter((l) => {
        const src = typeof l.source === "object" ? (l.source as any).id : l.source;
        const tgt = typeof l.target === "object" ? (l.target as any).id : l.target;
        return matchingNodeIds.has(src) && matchingNodeIds.has(tgt);
      }),
    };
  }, [graphData, searchQuery]);

  // ── Stats ──
  const stats = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredGraphData.nodes.forEach((n) => {
      groups[n.group] = (groups[n.group] || 0) + 1;
    });
    return groups;
  }, [filteredGraphData]);

  // ── Custom node painting ──
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const size = node.val || 4;
    const isSelected = selectedNode?.id === node.id;

    // Glow
    if (isSelected) {
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 20;
    }

    // Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.globalAlpha = isSelected ? 1 : 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Border
    ctx.strokeStyle = isSelected ? "#ffffff" : `${node.color}88`;
    ctx.lineWidth = isSelected ? 2 : 0.5;
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Label for larger nodes
    if (size >= 5 || isSelected) {
      ctx.font = `${isSelected ? "bold " : ""}${Math.max(3, size * 0.6)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(node.name, node.x, node.y + size + 2);
    }
  }, [selectedNode]);

  return (
    <div className="flex h-full w-full bg-[var(--background)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-[var(--border)] bg-[var(--surface-raised)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)] mb-1">
            Knowledge Graph
          </h2>
          <p className="text-[13px] text-[var(--muted)]">
            Explore document entity relationships
          </p>
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
            Graph Analytics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <div className="text-[10px] text-[var(--muted)] mb-1 flex items-center gap-1.5">
                <GitGraphIcon className="w-3.5 h-3.5" />
                Nodes
              </div>
              <div className="text-xl font-bold">{filteredGraphData.nodes.length}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <div className="text-[10px] text-[var(--muted)] mb-1 flex items-center gap-1.5">
                <Share2Icon className="w-3.5 h-3.5" />
                Edges
              </div>
              <div className="text-xl font-bold">{filteredGraphData.links.length}</div>
            </div>
          </div>

          {/* Type breakdown */}
          <div className="mt-3 space-y-1.5">
            {Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([group, count]) => {
              const info = GROUP_LABELS[group];
              if (!info) return null;
              return (
                <div key={group} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS[group] }} />
                    <span className="text-[var(--muted)]">{info.label}</span>
                  </div>
                  <span className="font-semibold text-[var(--foreground)] tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider px-2 pt-2 pb-1 flex items-center justify-between">
            Documents
            <button
              onClick={() => { setShowAll(!showAll); if (!showAll) setSelectedDocId(null); }}
              className={cn(
                "text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase transition-colors",
                showAll
                  ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {showAll ? "All ✓" : "Show All"}
            </button>
          </h3>

          {documents.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)]">
              <FileTextIcon className="w-8 h-8 mx-auto mb-2 opacity-25" />
              <p className="text-[12px]">No completed documents yet.</p>
              <p className="text-[11px] opacity-60 mt-1">Ingest documents first.</p>
            </div>
          ) : (
            documents.map((doc) => (
              <button
                key={doc.document_id}
                onClick={() => { setShowAll(false); setSelectedDocId(doc.document_id); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                  selectedDocId === doc.document_id && !showAll
                    ? "bg-[var(--surface-hover)] border border-[var(--border)]"
                    : "hover:bg-[var(--surface-hover)] border border-transparent text-[var(--muted)]"
                )}
              >
                <div className="shrink-0 p-1.5 rounded-lg bg-[var(--surface-active)]">
                  <FileTextIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13px] font-medium truncate",
                    selectedDocId === doc.document_id && !showAll ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                  )}>
                    {doc.source_name}
                  </p>
                  <p className="text-[10px] text-[var(--muted)] mt-0.5">
                    {doc.source_type} · {doc.document_id.slice(0, 8)}
                  </p>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Graph View */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-[var(--background)]">
        {/* Top bar */}
        <div className="h-14 border-b border-[var(--border)] flex items-center justify-between px-4 bg-[var(--header-bg)] backdrop-blur-md z-10 absolute top-0 left-0 right-0">
          <div className="flex items-center gap-2.5">
            <ActivityIcon className="w-4 h-4 text-[var(--primary)]" />
            <h1 className="text-sm font-semibold">
              {showAll ? "All Documents" : documents.find((d) => d.document_id === selectedDocId)?.source_name || "Select a document"}
            </h1>
            {filteredGraphData.nodes.length > 0 && (
              <span className="text-[10px] bg-[var(--surface-hover)] border border-[var(--border)] px-2 py-0.5 rounded-full text-[var(--muted)] font-medium">
                {filteredGraphData.nodes.length} nodes · {filteredGraphData.links.length} edges
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 pl-8 pr-3 py-1.5 text-[13px] bg-[var(--surface-raised)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)] transition-colors text-[var(--foreground)] placeholder:text-[var(--muted)]"
              />
            </div>
            <button
              onClick={() => {
                if (selectedDocId) {
                  setDocDataCache((prev) => { const n = { ...prev }; delete n[selectedDocId]; return n; });
                  setSelectedDocId(selectedDocId); // re-trigger fetch
                }
              }}
              className="p-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Refresh"
            >
              <RefreshCwIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => fgRef.current?.zoomToFit(400, 60)}
              className="p-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Fit to view"
            >
              <ExpandIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Graph Container */}
        <div ref={containerRef} className="flex-1 w-full bg-[var(--background)] pt-14">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                <Loader2Icon className="w-8 h-8 text-blue-500" />
              </motion.div>
              <p className="ml-3 text-sm text-[var(--muted)]">Building knowledge graph…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--muted)]">
              <AlertCircleIcon className="w-10 h-10 mb-3 text-red-400" />
              <p className="text-sm font-medium text-red-400">Failed to load graph</p>
              <p className="text-[12px] mt-1">{error}</p>
            </div>
          ) : filteredGraphData.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--muted)]">
              <NetworkIcon className="w-12 h-12 mb-3 opacity-25" />
              <p className="text-sm font-medium">No graph data</p>
              <p className="text-[12px] mt-1 opacity-60">Select a completed document to visualize</p>
            </div>
          ) : typeof window !== "undefined" && containerDimensions.width > 0 ? (
            <ForceGraph2D
              ref={fgRef}
              width={containerDimensions.width}
              height={containerDimensions.height - 56}
              graphData={filteredGraphData}
              nodeLabel=""
              nodeCanvasObject={paintNode}
              nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val + 4, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
              }}
              linkColor={(link: any) => link.color || "rgba(100, 100, 100, 0.2)"}
              linkWidth={1}
              linkDirectionalParticles={1}
              linkDirectionalParticleWidth={2}
              linkDirectionalParticleSpeed={0.005}
              onNodeClick={handleNodeClick}
              onBackgroundClick={() => setSelectedNode(null)}
              backgroundColor="transparent"
              d3VelocityDecay={0.4}
              cooldownTicks={100}
              onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
            />
          ) : null}
        </div>

        {/* Floating Legend */}
        <div className="absolute bottom-6 left-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/90 backdrop-blur-sm shadow-lg w-44 pointer-events-none">
          <h4 className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
            Node Types
          </h4>
          <div className="space-y-2">
            {Object.entries(GROUP_LABELS).map(([key, info]) => (
              <div key={key} className="flex items-center gap-2 text-[12px]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[key] }} />
                <span className="text-[var(--foreground)]">{info.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Node Detail Panel */}
        <AnimatePresence>
          {selectedNode && <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
