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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { FileUploaderRegular } from "@uploadcare/react-uploader/next";
import "@uploadcare/react-uploader/core.css";

interface UploadedFile {
    name: string;
    cdnUrl: string;
    uuid: string;
    size: number;
    isImage: boolean;
    mimeType: string;
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

export function AnimatedAIChat() {
    const [value, setValue] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showUploader, setShowUploader] = useState(false);
    const [, startTransition] = useTransition();

    // Audio refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // AutoResize
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 44,
        maxHeight: 200,
    });
    const [inputFocused, setInputFocused] = useState(false);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) handleSendMessage();
        }
    };

    const handleSendMessage = () => {
        if (value.trim() || uploadedFiles.length > 0) {
            // Log all uploaded file URLs to console for retrieval
            if (uploadedFiles.length > 0) {
                console.log("📎 Attached files being sent:");
                uploadedFiles.forEach((f) => {
                    console.log(`  → ${f.name}: ${f.cdnUrl}`);
                });
            }

            startTransition(() => {
                setIsTyping(true);
                setTimeout(() => {
                    setIsTyping(false);
                    setValue("");
                    setUploadedFiles([]);
                    adjustHeight(true);
                }, 3000);
            });
        }
    };

    const handleAttachFile = () => {
        setShowUploader(true);
    };

    // Helper to determine the source_type for the backend
    const determineSourceType = (fileName: string) => {
        const fn = fileName.toLowerCase();
        if (fn.endsWith('.pdf')) return 'pdf';
        if (fn.endsWith('.docx') || fn.endsWith('.doc')) return 'docx';
        if (fn.endsWith('.csv')) return 'csv';
        if (fn.match(/\.(jpeg|jpg|gif|png|webp)$/)) return 'image';
        return 'document';
    };

    // Called per individual file upload success
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

            // Log the CDN URL to console
            console.log(`✅ File uploaded successfully: ${newFile.name}`);
            console.log(`   CDN URL: ${newFile.cdnUrl}`);
            
            const payload = {
                source_type: determineSourceType(newFile.name),
                file_url: newFile.cdnUrl
            };
            
            try {
                console.log(`🚀 Sending ingestion request to backend proxy:`, payload);
                const res = await fetch("/api/proxy/ingest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    const data = await res.json();
                    console.log(`✅ Backend successfully queued ingestion for ${newFile.name}`, data);
                    
                    if (data.job_id) {
                         const newJob = {
                            job_id: data.job_id,
                            document_id: data.document_id || "",
                            name: newFile.name,
                            type: determineSourceType(newFile.name),
                            size: (newFile.size ? (newFile.size / 1024).toFixed(1) + " KB" : "Unknown"),
                            uploadedAt: new Date().toISOString(),
                            status: data.status || "pending",
                            file_url: newFile.cdnUrl
                         };
                         const existing = JSON.parse(localStorage.getItem('axiom_ingestion_jobs') || '[]');
                         localStorage.setItem('axiom_ingestion_jobs', JSON.stringify([newJob, ...existing]));
                         window.dispatchEvent(new Event('axiom_jobs_updated'));
                    }
                } else {
                    console.error(`❌ Ingestion API returned an error: ${res.status}`);
                }
            } catch (err) {
                console.error("❌ Failed to reach the /ingest API endpoint:", err);
            }
        }
    };

    // Called when user clicks "Done" in the uploader
    const handleDoneClick = (e: any) => {
        console.log("📦 Upload batch complete. All file URLs:");
        const allFiles = e?.allEntries?.filter((f: any) => f.status === "success") || [];
        allFiles.forEach((f: any) => {
            console.log(`  🔗 ${f.name}: ${f.cdnUrl}`);
        });
        setShowUploader(false);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());

                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');

                try {
                    setValue(v => v + (v ? " " : "") + "*(Transcribing...)*");

                    const response = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData,
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setValue(v => v.replace("*(Transcribing...)*", data.transcript || ""));
                    } else {
                        console.error('Transcription failed');
                        setValue(v => v.replace("*(Transcribing...)*", "*(Error transcribing audio)*"));
                    }
                } catch (error) {
                    console.error('Error during transcription fetch:', error);
                    setValue(v => v.replace("*(Transcribing...)*", "*(Error transcribing audio)*"));
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
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
            console.log(`🗑️ Removed attachment: ${removed.name} (${removed.cdnUrl})`);
        }
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="h-full flex flex-col w-full items-center justify-center p-4 sm:p-8 relative">
            <div className="w-full max-w-[640px] mx-auto space-y-8">
                {/* Welcome */}
                <div className="text-center space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                        {getGreeting()}
                    </h1>
                    <p className="text-[var(--muted)] text-sm">
                        What would you like to work on?
                    </p>
                </div>

                {/* Input Card */}
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
                                            <span className="truncate max-w-[120px]">{file.name}</span>
                                            <span className="text-[10px] text-[var(--muted)] tabular-nums">
                                                {formatFileSize(file.size)}
                                            </span>
                                            <button
                                                onClick={() => removeUploadedFile(index)}
                                                className="ml-0.5 p-0.5 rounded hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                                                title="Remove attachment"
                                            >
                                                <XIcon className="w-3 h-3" />
                                            </button>

                                            {/* Tooltip with CDN URL on hover */}
                                            <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-50">
                                                <div className="bg-[var(--surface-raised)] text-[var(--foreground)] text-[10px] px-2.5 py-1.5 rounded-md shadow-lg border border-[var(--border)] whitespace-nowrap flex items-center gap-1.5 max-w-[300px]">
                                                    <LinkIcon className="w-3 h-3 text-[var(--muted)] flex-shrink-0" />
                                                    <span className="truncate">{file.cdnUrl}</span>
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
                                    title={isRecording ? "Stop recording" : "Record audio"}
                                >
                                    {isRecording ? <Square className="w-4 h-4" fill="currentColor" /> : <Mic className="w-4 h-4" />}
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={handleSendMessage}
                                disabled={isTyping || (!value.trim() && uploadedFiles.length === 0)}
                                className={cn(
                                    "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors border",
                                    value.trim() || uploadedFiles.length > 0
                                        ? "bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)] hover:opacity-90"
                                        : "bg-transparent text-[var(--muted)] border-transparent cursor-not-allowed"
                                )}
                            >
                                {isTyping ? (
                                    <LoaderIcon className="w-4 h-4 animate-spin text-[var(--muted)]" />
                                ) : (
                                    <ArrowUpIcon className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Typing indicator */}
            <AnimatePresence>
                {isTyping && (
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
                                <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Upload Files</h2>
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
                                                <span className="truncate flex-1 text-[var(--foreground)]">{file.name}</span>
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
