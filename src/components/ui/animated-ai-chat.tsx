"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    FileUp,
    Paperclip,
    XIcon,
    LoaderIcon,
    Mic,
    ArrowUpIcon,
    Square,
    CheckCircle2,
    LinkIcon,
    BarChart3Icon,
    PlayCircleIcon,
    FileTextIcon,
    BotIcon,
    UserIcon,
    SparklesIcon,
    WrenchIcon,
    ClockIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { FileUploaderRegular } from "@uploadcare/react-uploader/next";
import "@uploadcare/react-uploader/core.css";

// ── Chart.js setup ──
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Line, Bar, Pie, Doughnut } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// ── Types ──
interface UploadedFile {
    name: string;
    cdnUrl: string;
    uuid: string;
    size: number;
    isImage: boolean;
    mimeType: string;
}

interface ChartData {
    chart_type: string;
    title: string;
    labels: string[];
    datasets: any[];
    insight?: string;
}

interface VideoSegment {
    video_id: string;
    title: string;
    url: string;
    embed_url: string;
    start_time: number;
    end_time: number;
    transcript: string;
    thumbnail: string;
}

interface VideoData {
    segments: VideoSegment[];
    query: string;
    video_info?: {
        video_id: string;
        thumbnail: string;
        total_segments: number;
    };
}

interface SourceItem {
    document_name: string;
    score: number;
    text_preview: string;
}

interface AgentEvent {
    type: string;
    data: any;
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    charts?: ChartData[];
    video?: VideoData;
    sources?: SourceItem[];
    isStreaming?: boolean;
    thinkingMessage?: string;
    toolCalls?: { tool: string; input?: any }[];
}

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }
            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
            );
            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) textarea.style.height = `${minHeight}px`;
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

// ── Format helpers ──
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Chart Widget ──
function ChartWidget({ chart }: { chart: ChartData }) {
    const chartType = chart.chart_type || "bar";
    const data = {
        labels: chart.labels || [],
        datasets: (chart.datasets || []).map((ds: any) => ({
            ...ds,
            // Make sure colors exist
            backgroundColor: ds.backgroundColor || [
                "rgba(88, 166, 255, 0.6)",
                "rgba(163, 113, 247, 0.6)",
                "rgba(63, 185, 80, 0.6)",
                "rgba(210, 153, 34, 0.6)",
                "rgba(248, 81, 73, 0.6)",
            ],
            borderColor: ds.borderColor || "rgba(88, 166, 255, 1)",
        })),
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: !!chart.title,
                text: chart.title,
                color: "var(--foreground)",
                font: { size: 13, weight: 600 as const },
                padding: { bottom: 12 },
            },
            legend: {
                position: "bottom" as const,
                labels: { color: "var(--muted)", font: { size: 11 } },
            },
        },
        scales:
            chartType === "doughnut" || chartType === "pie"
                ? {}
                : {
                      x: {
                          ticks: { color: "var(--muted)", font: { size: 11 } },
                          grid: { color: "var(--border)" },
                      },
                      y: {
                          ticks: { color: "var(--muted)", font: { size: 11 } },
                          grid: { color: "var(--border)" },
                      },
                  },
    };

    const ChartComponent =
        chartType === "line"
            ? Line
            : chartType === "doughnut"
            ? Doughnut
            : chartType === "pie"
            ? Pie
            : Bar;

    return (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="p-4 h-[260px]">
                <ChartComponent data={data} options={options} />
            </div>
            {chart.insight && (
                <div className="px-4 pb-3">
                    <div className="flex items-start gap-2 text-[12px] rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <SparklesIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>{chart.insight}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Video Widget ──
function VideoWidget({ videoData }: { videoData: VideoData }) {
    const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const segments = videoData.segments || [];
    if (segments.length === 0) return null;

    const activeSeg = segments[activeSegmentIndex] || segments[0];

    const seekTo = (index: number) => {
        setActiveSegmentIndex(index);
    };

    return (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            {/* Player */}
            <div className="relative" style={{ paddingBottom: "56.25%", height: 0 }}>
                <iframe
                    ref={iframeRef}
                    src={activeSeg.embed_url || ""}
                    className="absolute top-0 left-0 w-full h-full border-none"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
            </div>

            {/* Video info */}
            <div className="px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <PlayCircleIcon className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
                    <span className="text-[13px] font-semibold text-[var(--foreground)] line-clamp-1">
                        {activeSeg.title || "YouTube Video"}
                    </span>
                </div>
            </div>

            {/* Transcript segments */}
            <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                {segments.map((seg, i) => (
                    <button
                        key={`${seg.video_id}-${seg.start_time}-${i}`}
                        onClick={() => seekTo(i)}
                        className={cn(
                            "w-full text-left px-4 py-3 border-b border-[var(--border)] transition-colors",
                            i === activeSegmentIndex
                                ? "bg-[var(--primary)]/5"
                                : "hover:bg-[var(--surface-hover)]"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    "text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded",
                                    i === activeSegmentIndex
                                        ? "bg-[var(--primary)] text-[var(--primary-fg)]"
                                        : "bg-[var(--badge-bg)] text-[var(--primary)]"
                                )}
                            >
                                {formatTime(seg.start_time)}
                            </span>
                            {seg.end_time > 0 && (
                                <span className="text-[10px] text-[var(--muted)]">
                                    → {formatTime(seg.end_time)}
                                </span>
                            )}
                        </div>
                        <p className="text-[12px] text-[var(--muted-foreground)] mt-1.5 line-clamp-3 leading-relaxed">
                            {seg.transcript}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Sources Widget ──
function SourcesWidget({ sources }: { sources: SourceItem[] }) {
    if (!sources.length) return null;
    return (
        <div className="mt-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">
                <FileTextIcon className="w-3 h-3" />
                Sources ({sources.length})
            </div>
            {sources.map((s, i) => (
                <div
                    key={`source-${i}`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-medium text-[var(--primary)]">
                            {s.document_name}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-500">
                            {(s.score || 0).toFixed(2)}
                        </span>
                    </div>
                    <p className="text-[12px] text-[var(--muted)] leading-relaxed line-clamp-3">
                        {(s.text_preview || "").slice(0, 200)}
                    </p>
                </div>
            ))}
        </div>
    );
}

// ── Thinking / Tool Call pills ──
function ThinkingPill({ message }: { message: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 text-[12px] text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 mb-2"
        >
            <LoaderIcon className="w-3 h-3 animate-spin" />
            <span>{message}</span>
        </motion.div>
    );
}

function ToolCallPill({ tool }: { tool: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1.5 text-[11px] text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1 mr-1.5 mb-1.5"
        >
            <WrenchIcon className="w-3 h-3" />
            <span>{tool}</span>
        </motion.div>
    );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
export function AnimatedAIChat() {
    const [value, setValue] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showUploader, setShowUploader] = useState(false);
    const [linkInput, setLinkInput] = useState("");
    const [linkType, setLinkType] = useState<"youtube" | "html">("youtube");
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Audio refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Scroll ref
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // AutoResize
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 44,
        maxHeight: 200,
    });
    const [inputFocused, setInputFocused] = useState(false);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ── Keyboard ──
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) handleSendMessage();
        }
    };

    // ── Streaming submit ──
    const handleSendMessage = async () => {
        const query = value.trim();
        if (!query && uploadedFiles.length === 0) return;

        // Log attached files
        if (uploadedFiles.length > 0) {
            console.log("📎 Attached files being sent:");
            uploadedFiles.forEach((f) => console.log(`  → ${f.name}: ${f.cdnUrl}`));
        }

        // Add user message
        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: query,
        };

        // Add placeholder assistant message
        const assistantId = `assistant-${Date.now()}`;
        const assistantMsg: ChatMessage = {
            id: assistantId,
            role: "assistant",
            content: "",
            isStreaming: true,
            thinkingMessage: "Analyzing query...",
            toolCalls: [],
            charts: [],
            sources: [],
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        setValue("");
        setUploadedFiles([]);
        adjustHeight(true);
        setIsStreaming(true);

        try {
            const response = await fetch("/api/proxy/agent/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, stream: true }),
            });

            if (!response.ok) {
                const errText = await response.text();
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? {
                                  ...m,
                                  content: `⚠️ Error: ${response.status} — ${errText}`,
                                  isStreaming: false,
                                  thinkingMessage: undefined,
                              }
                            : m
                    )
                );
                setIsStreaming(false);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                setIsStreaming(false);
                return;
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value: chunk } = await reader.read();
                if (done) break;

                buffer += decoder.decode(chunk, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const raw = line.slice(6).trim();
                        if (!raw) continue;
                        try {
                            const event: AgentEvent = JSON.parse(raw);
                            handleSSEEvent(assistantId, event);
                        } catch {
                            // skip malformed JSON
                        }
                    }
                }
            }

            // Finalize streaming
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId
                        ? { ...m, isStreaming: false, thinkingMessage: undefined }
                        : m
                )
            );
        } catch (err: any) {
            console.error("Stream error:", err);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId
                        ? {
                              ...m,
                              content: `⚠️ Connection error: ${err.message}`,
                              isStreaming: false,
                              thinkingMessage: undefined,
                          }
                        : m
                )
            );
        } finally {
            setIsStreaming(false);
        }
    };

    // ── Handle individual SSE events ──
    const handleSSEEvent = (msgId: string, event: AgentEvent) => {
        const { type, data } = event;

        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== msgId) return m;

                switch (type) {
                    case "thinking":
                        return {
                            ...m,
                            thinkingMessage: data.message || "Thinking...",
                        };

                    case "tool_call":
                        return {
                            ...m,
                            thinkingMessage: `Using ${data.tool}...`,
                            toolCalls: [
                                ...(m.toolCalls || []),
                                { tool: data.tool, input: data.input },
                            ],
                        };

                    case "tool_result":
                        return {
                            ...m,
                            thinkingMessage: `Processing ${data.tool} results...`,
                        };

                    case "chart":
                        return {
                            ...m,
                            charts: data.charts || [],
                        };

                    case "video":
                        return {
                            ...m,
                            video: data,
                        };

                    case "complete":
                        return {
                            ...m,
                            content: data.answer || m.content || "",
                            charts:
                                m.charts && m.charts.length > 0
                                    ? m.charts
                                    : data.charts || [],
                            video: m.video || data.video || undefined,
                            sources: data.sources || [],
                            isStreaming: false,
                            thinkingMessage: undefined,
                        };

                    default:
                        return m;
                }
            })
        );
    };

    // ── File upload ──
    const handleAttachFile = () => {
        setShowUploader(true);
    };

    const determineSourceType = (fileName: string) => {
        const fn = fileName.toLowerCase();
        if (fn.endsWith(".pdf")) return "pdf";
        if (fn.match(/\.(mp3|wav|m4a|aac|ogg)$/)) return "audio";
        if (fn.match(/\.(jpeg|jpg|png|webp|gif)$/)) return "image";
        if (fn.endsWith(".csv")) return "csv";
        if (fn.endsWith(".json")) return "json";
        if (fn.endsWith(".md")) return "md";
        if (fn.match(/\.(html|htm)$/)) return "html";
        if (fn.match(/\.(txt|text)$/)) return "text";
        if (fn.endsWith(".docx") || fn.endsWith(".doc")) return "docx";
        return "document";
    };

    const handleFileUploadSuccess = async (e: any) => {
        const entry = e;
        if (entry && entry.cdnUrl) {
            const newFile: UploadedFile = {
                name: entry.name || "Uploaded file",
                cdnUrl: entry.cdnUrl,
                uuid: entry.uuid || "",
                size: entry.size || 0,
                isImage: entry.isImage ?? false,
                mimeType: entry.mimeType || "",
            };
            setUploadedFiles((prev) => [...prev, newFile]);

            console.log(`✅ File uploaded successfully: ${newFile.name}`);
            console.log(`   CDN URL: ${newFile.cdnUrl}`);

            const sourceType = determineSourceType(newFile.name);
            const payload = {
                source_type: sourceType,
                file_url: newFile.cdnUrl,
                source_location: "cdn",
                redact: true,
            };

            try {
                console.log(`🚀 Sending ingestion request to backend proxy:`, payload);
                const res = await fetch("/api/proxy/ingest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log(
                        `✅ Backend successfully queued ingestion for ${newFile.name}`,
                        data
                    );

                    if (data.job_id) {
                        const newJob = {
                            job_id: data.job_id,
                            document_id: data.document_id || "",
                            name: newFile.name,
                            type: determineSourceType(newFile.name),
                            size: newFile.size
                                ? (newFile.size / 1024).toFixed(1) + " KB"
                                : "Unknown",
                            uploadedAt: new Date().toISOString(),
                            status: data.status || "pending",
                            file_url: newFile.cdnUrl,
                        };
                        const existing = JSON.parse(
                            localStorage.getItem("axiom_ingestion_jobs") || "[]"
                        );
                        localStorage.setItem(
                            "axiom_ingestion_jobs",
                            JSON.stringify([newJob, ...existing])
                        );
                        window.dispatchEvent(new Event("axiom_jobs_updated"));
                    }
                } else {
                    console.error(
                        `❌ Ingestion API returned an error: ${res.status}`
                    );
                }
            } catch (err) {
                console.error("❌ Failed to reach the /ingest API endpoint:", err);
            }
        }
    };

    const handleAddLink = async () => {
        if (!linkInput.trim()) return;

        const newFile: UploadedFile = {
            name: linkInput,
            cdnUrl: linkInput,
            uuid: Math.random().toString(36).substring(2, 9),
            size: 0,
            isImage: false,
            mimeType: "text/uri-list",
        };
        setUploadedFiles((prev) => [...prev, newFile]);

        const sourceType = linkType === "youtube" ? "youtube" : "html";

        const payload = {
            source_type: sourceType,
            file_url: linkInput,
            source_location: "url",
            redact: true,
        };

        try {
            console.log(`🚀 Sending ingestion request to backend proxy:`, payload);
            const res = await fetch("/api/proxy/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const data = await res.json();
                console.log(
                    `✅ Backend successfully queued ingestion for link`,
                    data
                );

                if (data.job_id) {
                    const newJob = {
                        job_id: data.job_id,
                        document_id: data.document_id || "",
                        name: linkInput,
                        type: sourceType,
                        size: "Link",
                        uploadedAt: new Date().toISOString(),
                        status: data.status || "pending",
                        file_url: linkInput,
                    };
                    const existing = JSON.parse(
                        localStorage.getItem("axiom_ingestion_jobs") || "[]"
                    );
                    localStorage.setItem(
                        "axiom_ingestion_jobs",
                        JSON.stringify([newJob, ...existing])
                    );
                    window.dispatchEvent(new Event("axiom_jobs_updated"));
                }
            } else {
                console.error(
                    `❌ Ingestion API returned an error: ${res.status}`
                );
            }
        } catch (err) {
            console.error("❌ Failed to reach the /ingest API endpoint:", err);
        }

        setLinkInput("");
    };

    const handleDoneClick = (e: any) => {
        console.log("📦 Upload batch complete. All file URLs:");
        const allFiles =
            e?.allEntries?.filter((f: any) => f.status === "success") || [];
        allFiles.forEach((f: any) => {
            console.log(`  🔗 ${f.name}: ${f.cdnUrl}`);
        });
        setShowUploader(false);
    };

    // ── Audio recording ──
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, {
                    type: "audio/webm",
                });
                stream.getTracks().forEach((track) => track.stop());

                const formData = new FormData();
                formData.append("audio", audioBlob, "recording.webm");

                try {
                    setValue((v) => v + (v ? " " : "") + "*(Transcribing...)*");

                    const response = await fetch("/api/transcribe", {
                        method: "POST",
                        body: formData,
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setValue((v) =>
                            v.replace("*(Transcribing...)*", data.transcript || "")
                        );
                    } else {
                        console.error("Transcription failed");
                        setValue((v) =>
                            v.replace(
                                "*(Transcribing...)*",
                                "*(Error transcribing audio)*"
                            )
                        );
                    }
                } catch (error) {
                    console.error("Error during transcription fetch:", error);
                    setValue((v) =>
                        v.replace(
                            "*(Transcribing...)*",
                            "*(Error transcribing audio)*"
                        )
                    );
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
        ) {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const handleToggleAudio = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const removeUploadedFile = (index: number) => {
        const removed = uploadedFiles[index];
        if (removed) {
            console.log(
                `🗑️ Removed attachment: ${removed.name} (${removed.cdnUrl})`
            );
        }
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    // ── Has messages? ──
    const hasMessages = messages.length > 0;

    return (
        <div className="h-full flex flex-col w-full relative">
            {/* ── Messages area ── */}
            {hasMessages ? (
                <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-6"
                >
                    <div className="max-w-[760px] mx-auto space-y-6">
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25 }}
                                className="flex gap-3"
                            >
                                {/* Avatar */}
                                <div
                                    className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                                        msg.role === "user"
                                            ? "bg-[var(--primary)] text-[var(--primary-fg)]"
                                            : "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                                    )}
                                >
                                    {msg.role === "user" ? (
                                        <UserIcon className="w-3.5 h-3.5" />
                                    ) : (
                                        <BotIcon className="w-3.5 h-3.5" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5">
                                        {msg.role === "user" ? "You" : "Axiom"}
                                    </div>

                                    {/* Thinking indicator */}
                                    {msg.isStreaming && msg.thinkingMessage && (
                                        <ThinkingPill
                                            message={msg.thinkingMessage}
                                        />
                                    )}

                                    {/* Tool call pills */}
                                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                                        <div className="flex flex-wrap mb-2">
                                            {msg.toolCalls.map((tc, i) => (
                                                <ToolCallPill
                                                    key={`tool-${i}`}
                                                    tool={tc.tool}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Text content */}
                                    {msg.content && (
                                        <div className="text-[14px] text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                                            {msg.content}
                                        </div>
                                    )}

                                    {/* Charts */}
                                    {msg.charts && msg.charts.length > 0 && (
                                        <div className="space-y-3 mt-2">
                                            {msg.charts.map((chart, i) => (
                                                <ChartWidget
                                                    key={`chart-${msg.id}-${i}`}
                                                    chart={chart}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Video */}
                                    {msg.video &&
                                        msg.video.segments &&
                                        msg.video.segments.length > 0 && (
                                            <VideoWidget videoData={msg.video} />
                                        )}

                                    {/* Sources */}
                                    {msg.sources && msg.sources.length > 0 && (
                                        <SourcesWidget sources={msg.sources} />
                                    )}

                                    {/* Empty streaming placeholder */}
                                    {msg.isStreaming &&
                                        !msg.content &&
                                        !msg.thinkingMessage && (
                                            <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                                                <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                                                <span>Thinking...</span>
                                            </div>
                                        )}
                                </div>
                            </motion.div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            ) : (
                /* ── Empty state ── */
                <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                            {getGreeting()}
                        </h1>
                        <p className="text-[var(--muted)] text-sm">
                            What would you like to work on?
                        </p>
                    </div>
                </div>
            )}

            {/* ── Input area ── */}
            <div
                className={cn(
                    "w-full px-4 sm:px-6 pb-4 sm:pb-6",
                    hasMessages ? "pt-2" : ""
                )}
            >
                <div className="max-w-[640px] mx-auto">
                    <div className="relative">
                        <div
                            className={cn(
                                "rounded-xl border transition-colors",
                                "bg-[var(--input-bg)] shadow-[var(--shadow-sm)]",
                                inputFocused
                                    ? "border-[var(--input-focus)] shadow-[0_0_0_1px_var(--ring)]"
                                    : "border-[var(--input-border)]"
                            )}
                        >
                            {/* Textarea */}
                            <div className="px-4 pt-3 pb-1">
                                <textarea
                                    ref={textareaRef}
                                    value={value}
                                    onChange={(e) => {
                                        setValue(e.target.value);
                                        adjustHeight();
                                    }}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setInputFocused(true)}
                                    onBlur={() => setInputFocused(false)}
                                    placeholder="Ask anything..."
                                    className="w-full resize-none bg-transparent text-[15px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none leading-relaxed"
                                    style={{ overflow: "hidden" }}
                                />
                            </div>

                            {/* Uploaded File Attachments */}
                            <AnimatePresence>
                                {uploadedFiles.length > 0 && (
                                    <motion.div
                                        className="px-4 pb-2 flex gap-2 flex-wrap"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        {uploadedFiles.map((file, index) => (
                                            <motion.div
                                                key={`${file.uuid}-${index}`}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="group relative inline-flex items-center gap-2 text-[12px] bg-[var(--badge-bg)] text-[var(--badge-fg)] py-1.5 px-3 rounded-lg font-medium border border-[var(--border)] hover:border-[var(--primary)] transition-all cursor-default"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                                <span className="truncate max-w-[120px]">
                                                    {file.name}
                                                </span>
                                                <span className="text-[10px] text-[var(--muted)] tabular-nums">
                                                    {formatFileSize(file.size)}
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        removeUploadedFile(index)
                                                    }
                                                    className="ml-0.5 p-0.5 rounded hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                                                    title="Remove attachment"
                                                >
                                                    <XIcon className="w-3 h-3" />
                                                </button>

                                                {/* Tooltip with CDN URL on hover */}
                                                <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-50">
                                                    <div className="bg-[var(--surface-raised)] text-[var(--foreground)] text-[10px] px-2.5 py-1.5 rounded-md shadow-lg border border-[var(--border)] whitespace-nowrap flex items-center gap-1.5 max-w-[300px]">
                                                        <LinkIcon className="w-3 h-3 text-[var(--muted)] flex-shrink-0" />
                                                        <span className="truncate">
                                                            {file.cdnUrl}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Recording Indicator */}
                            <AnimatePresence>
                                {isRecording && (
                                    <motion.div
                                        className="px-4 pb-2"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        <div className="flex items-center gap-2 text-sm text-red-500 font-medium">
                                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                            Recording audio...
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Actions */}
                            <div className="px-3 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-0.5">
                                    <button
                                        type="button"
                                        onClick={handleAttachFile}
                                        className={cn(
                                            "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                                            showUploader
                                                ? "text-[var(--primary)] bg-[var(--primary)]/10"
                                                : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                        )}
                                        title="Attach file via Uploadcare"
                                    >
                                        <Paperclip className="w-4 h-4" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleToggleAudio}
                                        className={cn(
                                            "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                                            isRecording
                                                ? "text-red-500 bg-red-500/10 hover:bg-red-500/20"
                                                : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                        )}
                                        title={
                                            isRecording
                                                ? "Stop recording"
                                                : "Record audio"
                                        }
                                    >
                                        {isRecording ? (
                                            <Square
                                                className="w-4 h-4"
                                                fill="currentColor"
                                            />
                                        ) : (
                                            <Mic className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSendMessage}
                                    disabled={
                                        isStreaming ||
                                        (!value.trim() &&
                                            uploadedFiles.length === 0)
                                    }
                                    className={cn(
                                        "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors border",
                                        value.trim() || uploadedFiles.length > 0
                                            ? "bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)] hover:opacity-90"
                                            : "bg-transparent text-[var(--muted)] border-transparent cursor-not-allowed"
                                    )}
                                >
                                    {isStreaming ? (
                                        <LoaderIcon className="w-4 h-4 animate-spin text-[var(--muted)]" />
                                    ) : (
                                        <ArrowUpIcon className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Streaming indicator */}
            <AnimatePresence>
                {isStreaming && (
                    <motion.div
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2.5 border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-md)] z-50"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                    >
                        <div className="flex items-center gap-2.5 text-[13px] font-medium text-[var(--muted-foreground)]">
                            <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                            <span>Axiom is thinking...</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Uploadcare Modal */}
            <AnimatePresence>
                {showUploader && (
                    <motion.div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowUploader(false)}
                    >
                        <motion.div
                            className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 shadow-2xl"
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                                    Upload Files
                                </h2>
                                <button
                                    onClick={() => setShowUploader(false)}
                                    className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="uploadcare-chat-wrapper">
                                <FileUploaderRegular
                                    sourceList="local, camera, facebook, gdrive"
                                    classNameUploader="uc-light uc-purple"
                                    pubkey="f25db25b9fb13ce659fe"
                                    cdnCname="https://5kcn84nzfr.ucarecd.net/"
                                    filesViewMode="grid"
                                    multiple={true}
                                    onFileUploadSuccess={handleFileUploadSuccess}
                                    onDoneClick={handleDoneClick}
                                />
                            </div>

                            <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border)] pt-4">
                                <h3 className="text-sm font-medium text-[var(--foreground)]">
                                    Or add a link
                                </h3>
                                <div className="flex gap-2">
                                    <select
                                        className="bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--primary)]"
                                        value={linkType}
                                        onChange={(e) =>
                                            setLinkType(
                                                e.target.value as
                                                    | "youtube"
                                                    | "html"
                                            )
                                        }
                                    >
                                        <option value="youtube">YouTube</option>
                                        <option value="html">Web Page</option>
                                    </select>
                                    <input
                                        type="url"
                                        placeholder="Paste link here..."
                                        className="flex-1 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted)]"
                                        value={linkInput}
                                        onChange={(e) =>
                                            setLinkInput(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                handleAddLink();
                                        }}
                                    />
                                    <button
                                        onClick={handleAddLink}
                                        disabled={!linkInput.trim()}
                                        className="bg-[var(--primary)] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {uploadedFiles.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-[var(--border)]">
                                    <p className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                                        Uploaded ({uploadedFiles.length})
                                    </p>
                                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                                        {uploadedFiles.map((file, idx) => (
                                            <div
                                                key={`modal-${file.uuid}-${idx}`}
                                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--surface-hover)] text-[12px]"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                                <span className="truncate flex-1 text-[var(--foreground)]">
                                                    {file.name}
                                                </span>
                                                <span className="text-[var(--muted)] tabular-nums flex-shrink-0">
                                                    {formatFileSize(file.size)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
