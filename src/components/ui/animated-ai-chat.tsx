"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    ImageIcon,
    FileUp,
    LayoutTemplate,
    MonitorIcon,
    Paperclip,
    SendIcon,
    XIcon,
    LoaderIcon,
    Sparkles,
    Command,
    Mic,
    ArrowUpIcon,
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

interface CommandSuggestion {
    icon: React.ReactNode;
    label: string;
    description: string;
    prefix: string;
}

export function AnimatedAIChat() {
    const [value, setValue] = useState("");
    const [attachments, setAttachments] = useState<string[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [, startTransition] = useTransition();
    const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [recentCommand, setRecentCommand] = useState<string | null>(null);
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 44,
        maxHeight: 200,
    });
    const [inputFocused, setInputFocused] = useState(false);
    const commandPaletteRef = useRef<HTMLDivElement>(null);

    const commandSuggestions: CommandSuggestion[] = [
        {
            icon: <ImageIcon className="w-4 h-4" />,
            label: "Clone UI",
            description: "Generate UI from screenshot",
            prefix: "/clone",
        },
        {
            icon: <LayoutTemplate className="w-4 h-4" />,
            label: "Import Figma",
            description: "Import a design from Figma",
            prefix: "/figma",
        },
        {
            icon: <MonitorIcon className="w-4 h-4" />,
            label: "Create Page",
            description: "Generate a new web page",
            prefix: "/page",
        },
        {
            icon: <Sparkles className="w-4 h-4" />,
            label: "Improve",
            description: "Improve existing UI",
            prefix: "/improve",
        },
    ];

    useEffect(() => {
        if (value.startsWith("/") && !value.includes(" ")) {
            setShowCommandPalette(true);
            const idx = commandSuggestions.findIndex((cmd) => cmd.prefix.startsWith(value));
            setActiveSuggestion(idx >= 0 ? idx : -1);
        } else {
            setShowCommandPalette(false);
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const commandButton = document.querySelector("[data-command-button]");
            if (
                commandPaletteRef.current &&
                !commandPaletteRef.current.contains(target) &&
                !commandButton?.contains(target)
            ) {
                setShowCommandPalette(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCommandPalette) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveSuggestion((prev) =>
                    prev < commandSuggestions.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveSuggestion((prev) =>
                    prev > 0 ? prev - 1 : commandSuggestions.length - 1
                );
            } else if (e.key === "Tab" || e.key === "Enter") {
                e.preventDefault();
                if (activeSuggestion >= 0) {
                    selectCommandSuggestion(activeSuggestion);
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                setShowCommandPalette(false);
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) handleSendMessage();
        }
    };

    const handleSendMessage = () => {
        if (value.trim()) {
            startTransition(() => {
                setIsTyping(true);
                setTimeout(() => {
                    setIsTyping(false);
                    setValue("");
                    adjustHeight(true);
                }, 3000);
            });
        }
    };

    const handleAttachFile = () => {
        const mockFileName = `document-${Math.floor(Math.random() * 1000)}.pdf`;
        setAttachments((prev) => [...prev, mockFileName]);
    };

    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const selectCommandSuggestion = (index: number) => {
        const cmd = commandSuggestions[index];
        setValue(cmd.prefix + " ");
        setShowCommandPalette(false);
        setRecentCommand(cmd.label);
        setTimeout(() => setRecentCommand(null), 2000);
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
                    {/* Command Palette */}
                    <AnimatePresence>
                        {showCommandPalette && (
                            <motion.div
                                ref={commandPaletteRef}
                                className="absolute left-0 right-0 bottom-full mb-1.5 rounded-xl z-50 overflow-hidden bg-[var(--surface-raised)] border border-[var(--border)] shadow-[var(--shadow-lg)]"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.12 }}
                            >
                                <div className="p-1">
                                    {commandSuggestions.map((suggestion, index) => (
                                        <button
                                            key={suggestion.prefix}
                                            className={cn(
                                                "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors",
                                                activeSuggestion === index
                                                    ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                                                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                                            )}
                                            onClick={() => selectCommandSuggestion(index)}
                                        >
                                            <span className="flex-shrink-0">{suggestion.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-medium">{suggestion.label}</div>
                                                <div className="text-[11px] text-[var(--muted)] truncate">{suggestion.description}</div>
                                            </div>
                                            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--badge-bg)] text-[var(--badge-fg)] font-mono flex-shrink-0">
                                                {suggestion.prefix}
                                            </kbd>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

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
                                    data-command-button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCommandPalette((prev) => !prev);
                                    }}
                                    className={cn(
                                        "inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors",
                                        showCommandPalette && "bg-[var(--surface-hover)] text-[var(--foreground)]"
                                    )}
                                    title="Commands"
                                >
                                    <Command className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                                    title="Voice input"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={handleSendMessage}
                                disabled={isTyping || !value.trim()}
                                className={cn(
                                    "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                                    value.trim()
                                        ? "bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90"
                                        : "text-[var(--muted)] cursor-not-allowed"
                                )}
                            >
                                {isTyping ? (
                                    <LoaderIcon className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ArrowUpIcon className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Suggestions */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {commandSuggestions.map((suggestion, index) => (
                        <button
                            key={suggestion.prefix}
                            onClick={() => selectCommandSuggestion(index)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)] transition-colors"
                        >
                            {suggestion.icon}
                            <span>{suggestion.label}</span>
                        </button>
                    ))}
                </div>

                {/* Footer hint */}
                <p className="text-center text-[11px] text-[var(--muted)]">
                    Press{" "}
                    <kbd className="px-1 py-0.5 rounded bg-[var(--badge-bg)] text-[var(--badge-fg)] font-mono text-[10px]">/</kbd>
                    {" "}for commands ·{" "}
                    <kbd className="px-1 py-0.5 rounded bg-[var(--badge-bg)] text-[var(--badge-fg)] font-mono text-[10px]">↵</kbd>
                    {" "}to send
                </p>
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
