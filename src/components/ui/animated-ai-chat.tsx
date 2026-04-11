"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    ImageIcon,
    FileUp,
    LayoutTemplate,
    MonitorIcon,
    CircleUserRound,
    ArrowUpIcon,
    Paperclip,
    PlusIcon,
    SendIcon,
    XIcon,
    LoaderIcon,
    Sparkles,
    Command,
    Mic,
    BotIcon,
    ZapIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react"

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
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
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
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
    const [isPending, startTransition] = useTransition();
    const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [recentCommand, setRecentCommand] = useState<string | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 56,
        maxHeight: 200,
    });
    const [inputFocused, setInputFocused] = useState(false);
    const commandPaletteRef = useRef<HTMLDivElement>(null);

    const commandSuggestions: CommandSuggestion[] = [
        {
            icon: <ImageIcon className="w-4 h-4" />,
            label: "Clone UI",
            description: "Generate a UI from a screenshot",
            prefix: "/clone"
        },
        {
            icon: <LayoutTemplate className="w-4 h-4" />,
            label: "Import Figma",
            description: "Import a design from Figma",
            prefix: "/figma"
        },
        {
            icon: <MonitorIcon className="w-4 h-4" />,
            label: "Create Page",
            description: "Generate a new web page",
            prefix: "/page"
        },
        {
            icon: <Sparkles className="w-4 h-4" />,
            label: "Improve",
            description: "Improve existing UI design",
            prefix: "/improve"
        },
    ];

    useEffect(() => {
        if (value.startsWith('/') && !value.includes(' ')) {
            setShowCommandPalette(true);

            const matchingSuggestionIndex = commandSuggestions.findIndex(
                (cmd) => cmd.prefix.startsWith(value)
            );

            if (matchingSuggestionIndex >= 0) {
                setActiveSuggestion(matchingSuggestionIndex);
            } else {
                setActiveSuggestion(-1);
            }
        } else {
            setShowCommandPalette(false);
        }
    }, [value]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const commandButton = document.querySelector('[data-command-button]');

            if (commandPaletteRef.current &&
                !commandPaletteRef.current.contains(target) &&
                !commandButton?.contains(target)) {
                setShowCommandPalette(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCommandPalette) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestion(prev =>
                    prev < commandSuggestions.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestion(prev =>
                    prev > 0 ? prev - 1 : commandSuggestions.length - 1
                );
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (activeSuggestion >= 0) {
                    const selectedCommand = commandSuggestions[activeSuggestion];
                    setValue(selectedCommand.prefix + ' ');
                    setShowCommandPalette(false);

                    setRecentCommand(selectedCommand.label);
                    setTimeout(() => setRecentCommand(null), 3500);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowCommandPalette(false);
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                handleSendMessage();
            }
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
        const mockFileName = `file-${Math.floor(Math.random() * 1000)}.pdf`;
        setAttachments(prev => [...prev, mockFileName]);
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const selectCommandSuggestion = (index: number) => {
        const selectedCommand = commandSuggestions[index];
        setValue(selectedCommand.prefix + ' ');
        setShowCommandPalette(false);

        setRecentCommand(selectedCommand.label);
        setTimeout(() => setRecentCommand(null), 2000);
    };

    return (
        <div className="h-full flex flex-col w-full items-center justify-center bg-transparent p-4 sm:p-6 relative overflow-hidden">
            {/* Ambient Glow Effects */}
            <div className="absolute inset-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06] rounded-full filter blur-[120px] animate-pulse" />
                <div className="absolute bottom-[10%] right-[15%] w-[400px] h-[400px] bg-violet-500/[0.04] dark:bg-violet-500/[0.06] rounded-full filter blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-[40%] right-[25%] w-[300px] h-[300px] bg-fuchsia-500/[0.03] dark:bg-fuchsia-500/[0.04] rounded-full filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="w-full max-w-2xl mx-auto relative z-10">
                <motion.div
                    className="relative z-10 space-y-10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    {/* Welcome Section */}
                    <div className="text-center space-y-4">
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.15, duration: 0.5 }}
                            className="inline-flex flex-col items-center"
                        >
                            {/* Logo Icon */}
                            <motion.div
                                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 dark:shadow-indigo-500/10 mb-5"
                                initial={{ rotate: -10 }}
                                animate={{ rotate: 0 }}
                                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                            >
                                <BotIcon className="w-7 h-7 text-white" />
                            </motion.div>

                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight gradient-text-light pb-1">
                                Good afternoon
                            </h1>
                            <p className="text-base font-medium text-[var(--muted)] mt-1.5">
                                How can I assist you today?
                            </p>
                        </motion.div>

                        <motion.div
                            className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-[var(--border-hover)] to-transparent"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 128, opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                        />

                        <motion.p
                            className="text-[13px] text-[var(--muted)]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            Type a command or ask a question to get started
                        </motion.p>
                    </div>

                    {/* Chat Input Card */}
                    <motion.div
                        className={cn(
                            "relative rounded-2xl overflow-hidden transition-all duration-300",
                            "bg-[var(--surface)] dark:bg-[rgba(255,255,255,0.03)]",
                            "border border-[var(--border)]",
                            "shadow-[var(--shadow-lg)]",
                            inputFocused && "shadow-[var(--glow)] border-[var(--accent)]/30"
                        )}
                        initial={{ scale: 0.98, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        {/* Command Palette */}
                        <AnimatePresence>
                            {showCommandPalette && (
                                <motion.div
                                    ref={commandPaletteRef}
                                    className="absolute left-3 right-3 bottom-full mb-2 rounded-xl z-50 overflow-hidden bg-[var(--surface)] dark:bg-[rgba(20,20,24,0.98)] border border-[var(--border)] shadow-[var(--shadow-xl)] backdrop-blur-xl"
                                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div className="p-1.5">
                                        <div className="px-3 py-2">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Commands</span>
                                        </div>
                                        {commandSuggestions.map((suggestion, index) => (
                                            <motion.div
                                                key={suggestion.prefix}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all duration-150",
                                                    activeSuggestion === index
                                                        ? "bg-[var(--accent-light)] text-[var(--accent)]"
                                                        : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                                                )}
                                                onClick={() => selectCommandSuggestion(index)}
                                                initial={{ opacity: 0, x: -4 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.03 }}
                                            >
                                                <div className={cn(
                                                    "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
                                                    activeSuggestion === index
                                                        ? "bg-[var(--accent-medium)]"
                                                        : "bg-[var(--surface-hover)]"
                                                )}>
                                                    {suggestion.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-[13px]">{suggestion.label}</div>
                                                    <div className="text-[11px] text-[var(--muted)] truncate">{suggestion.description}</div>
                                                </div>
                                                <code className="text-[11px] px-1.5 py-0.5 rounded-md bg-[var(--surface-hover)] text-[var(--muted)] font-mono">
                                                    {suggestion.prefix}
                                                </code>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Textarea Area */}
                        <div className="p-4 pb-2">
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
                                placeholder="Ask me anything..."
                                className={cn(
                                    "w-full px-2 py-2 resize-none",
                                    "bg-transparent border-none",
                                    "text-[var(--foreground)] text-[15px] leading-relaxed",
                                    "focus:outline-none focus:ring-0",
                                    "placeholder:text-[var(--muted)]/60",
                                    "font-medium"
                                )}
                                style={{ overflow: "hidden" }}
                            />
                        </div>

                        {/* Attachments */}
                        <AnimatePresence>
                            {attachments.length > 0 && (
                                <motion.div
                                    className="px-4 pb-2 flex gap-2 flex-wrap"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    {attachments.map((file, index) => (
                                        <motion.div
                                            key={index}
                                            className="flex items-center gap-2 text-xs bg-[var(--surface-hover)] py-1.5 px-3 rounded-lg text-[var(--muted)] border border-[var(--border)] font-medium"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                        >
                                            <FileUp className="w-3 h-3" />
                                            <span>{file}</span>
                                            <button
                                                onClick={() => removeAttachment(index)}
                                                className="text-[var(--muted)] hover:text-red-500 transition-colors ml-1"
                                            >
                                                <XIcon className="w-3 h-3" />
                                            </button>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Action Bar */}
                        <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1">
                                <motion.button
                                    type="button"
                                    onClick={handleAttachFile}
                                    whileTap={{ scale: 0.92 }}
                                    className="p-2.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-xl transition-all duration-200"
                                    title="Attach file"
                                >
                                    <Paperclip className="w-[18px] h-[18px]" />
                                </motion.button>
                                <motion.button
                                    type="button"
                                    data-command-button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCommandPalette(prev => !prev);
                                    }}
                                    whileTap={{ scale: 0.92 }}
                                    className={cn(
                                        "p-2.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-xl transition-all duration-200",
                                        showCommandPalette && "bg-[var(--accent-light)] text-[var(--accent)]"
                                    )}
                                    title="Commands"
                                >
                                    <Command className="w-[18px] h-[18px]" />
                                </motion.button>
                                <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.92 }}
                                    className="p-2.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-xl transition-all duration-200"
                                    title="Voice Input"
                                >
                                    <Mic className="w-[18px] h-[18px]" />
                                </motion.button>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Character count */}
                                {value.length > 0 && (
                                    <motion.span
                                        className="text-[11px] text-[var(--muted)] font-mono tabular-nums"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        {value.length}
                                    </motion.span>
                                )}

                                <motion.button
                                    type="button"
                                    onClick={handleSendMessage}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.96 }}
                                    disabled={isTyping || !value.trim()}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                                        value.trim()
                                            ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
                                            : "bg-[var(--surface-hover)] text-[var(--muted)] cursor-not-allowed"
                                    )}
                                >
                                    {isTyping ? (
                                        <LoaderIcon className="w-4 h-4 animate-[spin_2s_linear_infinite]" />
                                    ) : (
                                        <SendIcon className="w-4 h-4" />
                                    )}
                                    <span className="hidden sm:inline">Send</span>
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Quick Action Chips */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {commandSuggestions.map((suggestion, index) => (
                            <motion.button
                                key={suggestion.prefix}
                                onClick={() => selectCommandSuggestion(index)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium",
                                    "bg-[var(--surface)] dark:bg-[rgba(255,255,255,0.03)]",
                                    "border border-[var(--border)] hover:border-[var(--border-hover)]",
                                    "text-[var(--muted)] hover:text-[var(--foreground)]",
                                    "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
                                    "transition-all duration-200 group"
                                )}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.08 }}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                <span className="text-[var(--accent)] group-hover:scale-110 transition-transform">
                                    {suggestion.icon}
                                </span>
                                <span>{suggestion.label}</span>
                            </motion.button>
                        ))}
                    </div>

                    {/* Keyboard hint */}
                    <motion.div
                        className="text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                    >
                        <div className="inline-flex items-center gap-2 text-[11px] text-[var(--muted)]">
                            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--surface-hover)] border border-[var(--border)] font-mono text-[10px] font-medium">
                                /
                            </kbd>
                            <span>for commands</span>
                            <span className="text-[var(--border-hover)]">·</span>
                            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--surface-hover)] border border-[var(--border)] font-mono text-[10px] font-medium">
                                Enter
                            </kbd>
                            <span>to send</span>
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            {/* Typing Indicator */}
            <AnimatePresence>
                {isTyping && (
                    <motion.div
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 rounded-2xl px-5 py-3 shadow-[var(--shadow-xl)] border border-[var(--border)] z-50 bg-[var(--surface)] dark:bg-[rgba(20,20,24,0.95)] backdrop-blur-xl"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                                <ZapIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                                <span>Thinking</span>
                                <TypingDots />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mouse-following glow */}
            {inputFocused && (
                <motion.div
                    className="fixed w-[40rem] h-[40rem] rounded-full pointer-events-none z-0 opacity-[0.015] dark:opacity-[0.025] bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 blur-[120px]"
                    animate={{
                        x: mousePosition.x - 320,
                        y: mousePosition.y - 320,
                    }}
                    transition={{
                        type: "spring",
                        damping: 30,
                        stiffness: 120,
                        mass: 0.5,
                    }}
                />
            )}
        </div>
    );
}

function TypingDots() {
    return (
        <div className="flex items-center ml-1">
            {[1, 2, 3].map((dot) => (
                <motion.div
                    key={dot}
                    className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full mx-0.5"
                    initial={{ opacity: 0.3 }}
                    animate={{
                        opacity: [0.3, 1, 0.3],
                        scale: [0.85, 1.15, 0.85]
                    }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: dot * 0.15,
                        ease: "easeInOut",
                    }}
                />
            ))}
        </div>
    );
}
