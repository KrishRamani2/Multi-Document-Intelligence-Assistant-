"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { SearchIcon, ActivityIcon, GitGraphIcon, Share2Icon, DownloadIcon } from "lucide-react";
import { motion } from "framer-motion";

// Dynamically import react-force-graph-2d so it works with Next.js SSR
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Node = {
  id: string;
  name: string;
  val: number;
  color?: string;
  group?: number;
  x?: number;
  y?: number;
};

type Link = {
  source: string;
  target: string;
  value?: number;
  color?: string;
};

type GraphData = {
  nodes: Node[];
  links: Link[];
};

// Mock Data
const MOCK_CHATS = [
  { id: "c1", title: "Q1 Earnings Discussion", nodesCount: 24, edgesCount: 35 },
  { id: "c2", title: "Onboarding Docs Review", nodesCount: 45, edgesCount: 68 },
  { id: "c3", title: "Architecture Decisions", nodesCount: 82, edgesCount: 140 },
  { id: "c4", title: "API Refactoring Plan", nodesCount: 15, edgesCount: 18 },
];

const generateMockGraphData = (chatId: string): GraphData => {
  const seed = parseInt(chatId.replace(/\D/g, "")) || 1;
  const nodes: Node[] = [];
  const links: Link[] = [];

  const types = ["Person", "Organization", "Technology", "Location", "Concept"];
  const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

  const numNodes = 10 + (seed * 10);
  for (let i = 0; i < numNodes; i++) {
    nodes.push({
      id: `node-${i}`,
      name: `Entity ${i}`,
      val: Math.random() * 5 + 1,
      group: i % types.length,
      color: colors[i % colors.length],
    });
  }

  const numLinks = numNodes * 1.5;
  for (let i = 0; i < numLinks; i++) {
    const source = `node-${Math.floor(Math.random() * numNodes)}`;
    let target = `node-${Math.floor(Math.random() * numNodes)}`;
    while (source === target) {
      target = `node-${Math.floor(Math.random() * numNodes)}`;
    }
    links.push({
      source,
      target,
      color: "var(--border)",
    });
  }

  return { nodes, links };
};

export function KnowledgeGraphDashboard() {
  const [selectedChat, setSelectedChat] = useState<string>(MOCK_CHATS[0].id);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);

  useEffect(() => {
    // Generate data when chat changes
    setGraphData(generateMockGraphData(selectedChat));
  }, [selectedChat]);

  useEffect(() => {
    const updateDimensions = (e?: Event) => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleNodeClick = useCallback(
    (node: any) => {
      // Center and zoom on node
      if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 1000);
        fgRef.current.zoom(8, 2000);
      }
    },
    [fgRef]
  );

  const activeChatDetails = MOCK_CHATS.find((c) => c.id === selectedChat);

  return (
    <div className="flex h-full w-full bg-[var(--background)] overflow-hidden">
      {/* Sidebar / List of Chats */}
      <div className="w-80 border-r border-[var(--border)] bg-[var(--surface-raised)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)] mb-1">
            Knowledge Graphs
          </h2>
          <p className="text-[13px] text-[var(--muted)]">
            Explore relationships per conversation.
          </p>
        </div>

        {/* Dashboard Analytics summary */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
            Overall Analytics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <div className="text-[10px] text-[var(--muted)] mb-1 flex items-center gap-1.5">
                <GitGraphIcon className="w-3.5 h-3.5" />
                Total Entities
              </div>
              <div className="text-xl font-bold">3,492</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <div className="text-[10px] text-[var(--muted)] mb-1 flex items-center gap-1.5">
                <Share2Icon className="w-3.5 h-3.5" />
                Relationships
              </div>
              <div className="text-xl font-bold">12,840</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider px-2 pt-2 pb-1">
            Chat Graphs
          </h3>
          {MOCK_CHATS.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat.id)}
              className={cn(
                "w-full flex flex-col items-start px-3 py-2.5 rounded-lg text-left transition-colors",
                selectedChat === chat.id
                  ? "bg-[var(--surface-hover)] border border-[var(--border)]"
                  : "hover:bg-[var(--surface-hover)] border border-transparent text-[var(--muted)]"
              )}
            >
              <span
                className={cn(
                  "text-[13px] font-medium truncate w-full mb-1",
                  selectedChat === chat.id ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                )}
              >
                {chat.title}
              </span>
              <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  {chat.nodesCount} Nodes
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  {chat.edgesCount} Edges
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Graph View */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-[var(--background)]">
        {/* Top bar */}
        <div className="h-14 border-b border-[var(--border)] flex items-center justify-between px-4 bg-[var(--header-bg)] backdrop-blur-md z-10 absolute top-0 left-0 right-0">
          <div className="flex items-center gap-2.5">
            <ActivityIcon className="w-4 h-4 text-[var(--primary)]" />
            <h1 className="text-sm font-semibold">{activeChatDetails?.title || "Graph"}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search entities..."
                className="w-48 pl-8 pr-3 py-1.5 text-[13px] bg-[var(--surface-raised)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)] transition-colors text-[var(--foreground)] placeholder:text-[var(--muted)]"
              />
            </div>
            <button className="p-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              <DownloadIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Graph Container */}
        <div ref={containerRef} className="flex-1 w-full bg-[var(--background)]">
          {typeof window !== "undefined" && containerDimensions.width > 0 && (
            <ForceGraph2D
              ref={fgRef}
              width={containerDimensions.width}
              height={containerDimensions.height}
              graphData={graphData}
              nodeLabel="name"
              nodeColor="color"
              linkColor={(link: any) => {
                // If it's a string, meaning custom color hasn't resolved
                return link.color || "rgba(100, 100, 100, 0.4)";
              }}
              linkWidth={1.5}
              nodeRelSize={6}
              onNodeClick={handleNodeClick}
              backgroundColor="transparent"
              d3VelocityDecay={0.3}
            />
          )}
        </div>
        
        {/* Floating Legend */}
        <div className="absolute bottom-6 right-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/90 backdrop-blur-sm shadow-[var(--shadow-lg)] w-48 pointer-events-none">
          <h4 className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
            Entity Types
          </h4>
          <div className="space-y-2">
            {[
              { type: "Person", color: "#ef4444" },
              { type: "Organization", color: "#3b82f6" },
              { type: "Technology", color: "#10b981" },
              { type: "Location", color: "#f59e0b" },
              { type: "Concept", color: "#8b5cf6" },
            ].map((item) => (
              <div key={item.type} className="flex items-center gap-2 text-[12px]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
