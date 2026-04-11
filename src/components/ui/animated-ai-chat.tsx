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
    Square
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";

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
    const [attachments, setAttachments] = useState<string[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [, startTransition] = useTransition();
    
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
        if (value.trim() || attachments.length > 0) {
            startTransition(() => {
                setIsTyping(true);
                setTimeout(() => {
                    setIsTyping(false);
                    setValue("");
                    setAttachments([]);
                    adjustHeight(true);
                }, 3000);
            });
        }
    };

    const handleAttachFile = () => {
        const mockFileName = `document-${Math.floor(Math.random() * 1000)}.pdf`;
        setAttachments((prev) => [...prev, mockFileName]);
    };

    const handleToggleAudio = () => {
        if (isRecording) {
            setIsRecording(false);
            setAttachments((prev) => [...prev, `audio-message-${Math.floor(Math.random() * 1000)}.mp3`]);
        } else {
            setIsRecording(true);
            
            // Auto stop recording after 5 seconds for demonstration purposes
            setTimeout(() => {
                setIsRecording(current => {
                    if (current) {
                        setAttachments((prev) => [...prev, `audio-message-${Math.floor(Math.random() * 1000)}.mp3`]);
                        return false;
                    }
                    return current;
                });
            }, 5000);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
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

                        {/* Attachments */}
                        <AnimatePresence>
                            {attachments.length > 0 && (
                                <motion.div
                                    className="px-4 pb-1 flex gap-1.5 flex-wrap"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    {attachments.map((file, index) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center gap-1.5 text-[12px] bg-[var(--badge-bg)] text-[var(--badge-fg)] py-1 px-2.5 rounded-md font-medium"
                                        >
                                            <FileUp className="w-3 h-3" />
                                            {file}
                                            <button
                                                onClick={() => removeAttachment(index)}
                                                className="hover:text-[var(--foreground)] transition-colors"
                                            >
                                                <XIcon className="w-3 h-3" />
                                            </button>
                                        </span>
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
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                                    title="Attach file"
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
                                disabled={isTyping || (!value.trim() && attachments.length === 0)}
                                className={cn(
                                    "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors border",
                                    value.trim() || attachments.length > 0
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
        </div>
    );
}
