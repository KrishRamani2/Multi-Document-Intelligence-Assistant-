"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquareIcon,
  SendIcon,
  PhoneIcon,
  SmartphoneIcon,
  BotIcon,
  HashIcon,
  PlusIcon,
  SettingsIcon,
  CheckCheckIcon,
  ClockIcon,
  XIcon,
  LinkIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  Loader2Icon,
  CopyIcon,
  ExternalLinkIcon,
  ChevronRightIcon,
  SearchIcon,
  ZapIcon,
  GlobeIcon,
  ArrowRightIcon,
  MailIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ─────────────────────────────────────────────────────────────────

type ChannelType = "whatsapp" | "telegram" | "slack" | "discord" | "email" | "webchat";

type ChannelConfig = {
  id: string;
  type: ChannelType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  connected: boolean;
  config?: {
    apiKey?: string;
    webhookUrl?: string;
    botToken?: string;
    phoneNumber?: string;
    channelId?: string;
  };
  stats?: {
    messagesSent: number;
    messagesReceived: number;
    activeUsers: number;
    lastActivity: string;
  };
};

type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  channel: ChannelType;
  status: "sending" | "sent" | "delivered" | "read";
  senderName?: string;
};

// ─── Channel Definitions ───────────────────────────────────────────────────

const CHANNEL_DEFS: Omit<ChannelConfig, "connected" | "config" | "stats">[] = [
  {
    id: "whatsapp",
    type: "whatsapp",
    name: "WhatsApp",
    description: "Connect your WhatsApp Business API for direct customer messaging",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    color: "#25D366",
    gradient: "from-[#25D366] to-[#128C7E]",
  },
  {
    id: "telegram",
    type: "telegram",
    name: "Telegram",
    description: "Deploy a Telegram bot to serve your knowledge base in real-time",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    color: "#0088CC",
    gradient: "from-[#0088CC] to-[#005FAD]",
  },
  {
    id: "slack",
    type: "slack",
    name: "Slack",
    description: "Integrate with Slack workspaces for team-based AI interactions",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>
    ),
    color: "#4A154B",
    gradient: "from-[#4A154B] to-[#611F69]",
  },
  {
    id: "discord",
    type: "discord",
    name: "Discord",
    description: "Add an AI-powered bot to your Discord server channels",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
    color: "#5865F2",
    gradient: "from-[#5865F2] to-[#4752C4]",
  },
  {
    id: "email",
    type: "email",
    name: "Email",
    description: "Set up an email channel for automated AI-powered responses",
    icon: <MailIcon className="w-6 h-6" />,
    color: "#EA4335",
    gradient: "from-[#EA4335] to-[#C5221F]",
  },
  {
    id: "webchat",
    type: "webchat",
    name: "Web Chat Widget",
    description: "Embed an AI chat widget directly on your website",
    icon: <GlobeIcon className="w-6 h-6" />,
    color: "#06B6D4",
    gradient: "from-[#06B6D4] to-[#0891B2]",
  },
];

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "sending" | "sent" | "delivered" | "read" }) {
  if (status === "read") return <CheckCheckIcon className="w-3.5 h-3.5 text-blue-400" />;
  if (status === "delivered") return <CheckCheckIcon className="w-3.5 h-3.5 text-[var(--muted)]" />;
  if (status === "sent") return <CheckCheckIcon className="w-3.5 h-3.5 text-[var(--muted)] opacity-50" />;
  return <ClockIcon className="w-3 h-3 text-[var(--muted)] animate-pulse" />;
}

// ─── Chat Simulator ────────────────────────────────────────────────────────

function ChatSimulator({ channel, onBack }: { channel: ChannelConfig; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Seed with a welcome message
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        text: `👋 Welcome to the ${channel.name} integration! I'm your AI assistant powered by your ingested knowledge base. Ask me anything about your documents.`,
        sender: "bot",
        timestamp: new Date(),
        channel: channel.type,
        status: "read",
        senderName: "Akarshak AI",
      },
    ]);
  }, [channel]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      text: input.trim(),
      sender: "user",
      timestamp: new Date(),
      channel: channel.type,
      status: "sent",
      senderName: "You",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Simulate delivery
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, status: "delivered" as const } : m)));
    }, 500);
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, status: "read" as const } : m)));
    }, 1000);

    // Simulate AI typing
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const responses = [
        "Based on the documents in your knowledge base, I can provide you with detailed information on that topic. Let me search through the ingested data...",
        "I've found relevant information from your uploaded PDFs. The key findings suggest multiple interconnected data points that relate to your query.",
        "Great question! According to the hierarchical chunks processed from your documents, here's what I found...",
        "Let me cross-reference this with the entity graph from your ingested documents. I see several relevant connections...",
        "I've analyzed the passages and sections from your uploaded files. Here's a comprehensive summary...",
      ];
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        text: responses[Math.floor(Math.random() * responses.length)],
        sender: "bot",
        timestamp: new Date(),
        channel: channel.type,
        status: "read",
        senderName: "Akarshak AI",
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 1500 + Math.random() * 1500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-raised)] shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)] transition-colors">
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: channel.color }}>
          {channel.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">{channel.name} Chat</p>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Connected · AI Active
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)]">
            <PhoneIcon className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)]">
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ backgroundColor: "var(--background)" }}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", damping: 20 }}
            className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}
          >
            <div className={cn(
              "max-w-[75%] rounded-2xl px-4 py-2.5 relative",
              msg.sender === "user"
                ? "bg-gradient-to-br text-white rounded-br-md"
                : "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--foreground)] rounded-bl-md"
            )}
              style={msg.sender === "user" ? { background: `linear-gradient(135deg, ${channel.color}, ${channel.color}dd)` } : undefined}
            >
              {msg.sender === "bot" && (
                <p className="text-[10px] font-semibold text-[var(--muted)] mb-1 flex items-center gap-1">
                  <BotIcon className="w-3 h-3" />
                  {msg.senderName}
                </p>
              )}
              <p className="text-[13px] leading-relaxed">{msg.text}</p>
              <div className={cn(
                "flex items-center gap-1 mt-1",
                msg.sender === "user" ? "justify-end" : "justify-start"
              )}>
                <span className={cn("text-[10px]", msg.sender === "user" ? "text-white/70" : "text-[var(--muted)]")}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {msg.sender === "user" && <StatusBadge status={msg.status} />}
              </div>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1">
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 rounded-full bg-[var(--muted)]" />
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="w-2 h-2 rounded-full bg-[var(--muted)]" />
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-2 h-2 rounded-full bg-[var(--muted)]" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-raised)] shrink-0">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={`Message via ${channel.name}...`}
            className="flex-1 px-4 py-2.5 text-[13px] bg-[var(--background)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-blue-500/50 transition-colors text-[var(--foreground)] placeholder:text-[var(--muted)]"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="p-2.5 rounded-xl text-white transition-all disabled:opacity-30"
            style={{ backgroundColor: input.trim() ? channel.color : undefined }}
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Setup Modal ───────────────────────────────────────────────────────────

function SetupModal({ channel, onClose, onConnect }: { channel: ChannelConfig; onClose: () => void; onConnect: () => void }) {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl] = useState(`https://api.akarshak.ai/webhooks/${channel.type}/${Math.random().toString(36).slice(2, 10)}`);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      onConnect();
    }, 2000);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 24 }}
        className="w-full max-w-lg bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("px-6 py-5 bg-gradient-to-r text-white relative overflow-hidden", channel.gradient)}>
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -right-4 -bottom-12 w-24 h-24 rounded-full bg-white/5" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                {channel.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold">Connect {channel.name}</h2>
                <p className="text-white/70 text-[12px]">Step {step} of 3</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          {/* Progress */}
          <div className="mt-4 flex gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={cn("h-1 rounded-full flex-1 transition-all", s <= step ? "bg-white" : "bg-white/20")} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">API Configuration</h3>
                <p className="text-[12px] text-[var(--muted)] mb-4">
                  Enter your {channel.name} {channel.type === "telegram" ? "Bot Token" : "API Key"} to establish the connection.
                </p>
                <label className="block text-[11px] text-[var(--muted)] uppercase tracking-wider font-semibold mb-1.5">
                  {channel.type === "telegram" ? "Bot Token" : "API Key / Access Token"}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={channel.type === "telegram" ? "123456:ABC-DEF1234ghIkl-zyx57W2v..." : "sk-xxxx..."}
                  className="w-full px-3 py-2.5 text-[13px] bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-blue-500/50 text-[var(--foreground)] placeholder:text-[var(--muted)] font-mono"
                />
                {channel.type === "whatsapp" && (
                  <div className="mt-4">
                    <label className="block text-[11px] text-[var(--muted)] uppercase tracking-wider font-semibold mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      placeholder="+91 9876543210"
                      className="w-full px-3 py-2.5 text-[13px] bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-blue-500/50 text-[var(--foreground)] placeholder:text-[var(--muted)]"
                    />
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">Webhook Setup</h3>
                <p className="text-[12px] text-[var(--muted)] mb-4">
                  Copy this webhook URL and add it to your {channel.name} settings. Messages will be forwarded to your Akarshak AI.
                </p>
                <label className="block text-[11px] text-[var(--muted)] uppercase tracking-wider font-semibold mb-1.5">Webhook URL</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={webhookUrl}
                    className="flex-1 px-3 py-2.5 text-[12px] bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] font-mono"
                  />
                  <button onClick={copyWebhook} className={cn(
                    "px-3 py-2.5 rounded-lg text-[12px] font-medium border transition-all",
                    copied ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                  )}>
                    {copied ? "Copied!" : <CopyIcon className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[12px] text-amber-400">
                  <p className="font-semibold mb-1">💡 Instructions</p>
                  <p className="text-[var(--muted)] text-[11px] leading-relaxed">
                    {channel.type === "telegram"
                      ? "Go to @BotFather → Select your bot → Bot Settings → Set Webhook → Paste the URL above."
                      : channel.type === "whatsapp"
                      ? "Go to Meta Developer Console → WhatsApp → Configuration → Webhook → Paste the URL and subscribe to messages."
                      : channel.type === "slack"
                      ? "Go to api.slack.com → Your App → Event Subscriptions → Enable Events → Paste the Request URL."
                      : `Configure the webhook URL in your ${channel.name} developer dashboard settings.`}
                  </p>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${channel.color}20` }}>
                  <ShieldCheckIcon className="w-8 h-8" style={{ color: channel.color }} />
                </div>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">Ready to Connect</h3>
                <p className="text-[12px] text-[var(--muted)] mb-6">
                  Your {channel.name} channel is configured. Click connect to activate the integration and start receiving messages.
                </p>
                <div className="flex flex-col gap-2 text-left text-[12px] text-[var(--muted)] mb-4 p-3 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)]">
                  <div className="flex items-center gap-2"><ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" /> End-to-end encrypted pipeline</div>
                  <div className="flex items-center gap-2"><ZapIcon className="w-3.5 h-3.5 text-amber-400" /> Real-time message forwarding</div>
                  <div className="flex items-center gap-2"><BotIcon className="w-3.5 h-3.5 text-blue-400" /> AI responses from your knowledge base</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !apiKey.trim()}
              className="px-5 py-2 rounded-lg text-white text-[13px] font-medium transition-all disabled:opacity-40 flex items-center gap-2"
              style={{ backgroundColor: channel.color }}
            >
              Continue <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-5 py-2 rounded-lg text-white text-[13px] font-medium transition-all flex items-center gap-2"
              style={{ backgroundColor: channel.color }}
            >
              {connecting ? <><Loader2Icon className="w-4 h-4 animate-spin" /> Connecting…</> : <><LinkIcon className="w-3.5 h-3.5" /> Connect</>}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────

export function ChannelsDashboard() {
  const [channels, setChannels] = useState<ChannelConfig[]>(() =>
    CHANNEL_DEFS.map((d) => ({ ...d, connected: false }))
  );
  const [selectedChannel, setSelectedChannel] = useState<ChannelConfig | null>(null);
  const [setupChannel, setSetupChannel] = useState<ChannelConfig | null>(null);
  const [chatChannel, setChatChannel] = useState<ChannelConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const connectedCount = channels.filter((c) => c.connected).length;

  const handleConnect = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channelId
          ? {
              ...c,
              connected: true,
              stats: {
                messagesSent: Math.floor(Math.random() * 200) + 10,
                messagesReceived: Math.floor(Math.random() * 500) + 50,
                activeUsers: Math.floor(Math.random() * 50) + 5,
                lastActivity: new Date().toISOString(),
              },
            }
          : c
      )
    );
    setSetupChannel(null);
  };

  const handleDisconnect = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, connected: false, stats: undefined, config: undefined } : c))
    );
    setSelectedChannel(null);
  };

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If chatting, show full-screen chat
  if (chatChannel) {
    return (
      <div className="h-full w-full bg-[var(--background)]">
        <ChatSimulator channel={chatChannel} onBack={() => setChatChannel(null)} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[var(--background)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-[var(--border)] bg-[var(--surface-raised)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)] mb-1">Channels</h2>
          <p className="text-[13px] text-[var(--muted)]">Connect messaging platforms</p>
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <div className="text-[10px] text-[var(--muted)] mb-1 flex items-center gap-1.5">
                <LinkIcon className="w-3 h-3" /> Connected
              </div>
              <div className="text-xl font-bold text-emerald-400">{connectedCount}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <div className="text-[10px] text-[var(--muted)] mb-1 flex items-center gap-1.5">
                <HashIcon className="w-3 h-3" /> Available
              </div>
              <div className="text-xl font-bold">{channels.length}</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="relative">
            <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels..."
              className="w-full pl-8 pr-3 py-2 text-[12px] bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-blue-500/30"
            />
          </div>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                selectedChannel?.id === ch.id
                  ? "bg-[var(--surface-hover)] border border-[var(--border)] shadow-sm"
                  : "hover:bg-[var(--surface-hover)] border border-transparent"
              )}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: ch.color }}>
                <div className="w-4 h-4 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{ch.icon}</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px] font-medium", selectedChannel?.id === ch.id ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>
                  {ch.name}
                </p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5 flex items-center gap-1">
                  {ch.connected ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Connected</>
                  ) : (
                    <><span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] inline-block opacity-40" /> Not connected</>
                  )}
                </p>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
        {selectedChannel ? (
          <div className="max-w-3xl mx-auto w-full py-10 px-8">
            {/* Channel Hero */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("rounded-2xl p-6 bg-gradient-to-br text-white relative overflow-hidden mb-8", selectedChannel.gradient)}
            >
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
              <div className="absolute -right-4 -bottom-16 w-32 h-32 rounded-full bg-white/5" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm mb-4">
                  <div className="[&>svg]:w-7 [&>svg]:h-7">{selectedChannel.icon}</div>
                </div>
                <h1 className="text-2xl font-bold mb-1">{selectedChannel.name}</h1>
                <p className="text-white/70 text-[13px] max-w-md">{selectedChannel.description}</p>
                <div className="flex items-center gap-3 mt-5">
                  {selectedChannel.connected ? (
                    <>
                      <button
                        onClick={() => setChatChannel(selectedChannel)}
                        className="px-4 py-2 rounded-lg bg-white text-black text-[13px] font-semibold flex items-center gap-2 hover:bg-white/90 transition-colors"
                      >
                        <MessageSquareIcon className="w-4 h-4" /> Open Chat
                      </button>
                      <button
                        onClick={() => handleDisconnect(selectedChannel.id)}
                        className="px-4 py-2 rounded-lg bg-white/15 text-white text-[13px] font-medium flex items-center gap-2 hover:bg-white/25 transition-colors backdrop-blur-sm"
                      >
                        <XIcon className="w-4 h-4" /> Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSetupChannel(selectedChannel)}
                      className="px-5 py-2.5 rounded-lg bg-white text-black text-[13px] font-semibold flex items-center gap-2 hover:bg-white/90 transition-colors"
                    >
                      <LinkIcon className="w-4 h-4" /> Connect Now
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Stats (connected only) */}
            {selectedChannel.connected && selectedChannel.stats && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <h3 className="text-[12px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Channel Analytics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                  {[
                    { label: "Messages Sent", value: selectedChannel.stats.messagesSent, color: "text-blue-400" },
                    { label: "Received", value: selectedChannel.stats.messagesReceived, color: "text-emerald-400" },
                    { label: "Active Users", value: selectedChannel.stats.activeUsers, color: "text-amber-400" },
                    { label: "Last Active", value: "Just now", color: "text-violet-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                      <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium mb-1">{stat.label}</p>
                      <p className={cn("text-xl font-bold", stat.color)}>
                        {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Features */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="text-[12px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Integration Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { icon: BotIcon, title: "AI-Powered Responses", desc: "Automatic answers from your knowledge base" },
                  { icon: ZapIcon, title: "Real-Time Sync", desc: "Instant message delivery and processing" },
                  { icon: ShieldCheckIcon, title: "Secure Pipeline", desc: "End-to-end encrypted message handling" },
                  { icon: SmartphoneIcon, title: "Multi-Device", desc: "Works across all connected devices" },
                ].map((feat) => (
                  <div key={feat.title} className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${selectedChannel.color}15` }}>
                      <feat.icon className="w-4 h-4" style={{ color: selectedChannel.color }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--foreground)]">{feat.title}</p>
                      <p className="text-[11px] text-[var(--muted)] mt-0.5">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          /* Empty state — Grid of all channels */
          <div className="max-w-4xl mx-auto w-full py-10 px-8">
            <div className="text-center mb-10">
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                  <MessageSquareIcon className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Messaging Channels</h1>
                <p className="text-[var(--muted)] text-[14px] max-w-md mx-auto">
                  Connect your favorite messaging platforms and let your AI assistant respond using your knowledge base.
                </p>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map((ch, idx) => (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] hover:shadow-lg hover:shadow-black/20 transition-all overflow-hidden cursor-pointer"
                  onClick={() => setSelectedChannel(ch)}
                >
                  <div className={cn("h-1.5 bg-gradient-to-r", ch.gradient)} />
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: ch.color }}>
                        <div className="w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">{ch.icon}</div>
                      </div>
                      {ch.connected ? (
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          Connected
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--surface-hover)] text-[var(--muted)] border border-[var(--border)] group-hover:text-[var(--foreground)]">
                          Available
                        </span>
                      )}
                    </div>
                    <h3 className="text-[15px] font-semibold text-[var(--foreground)] mb-1">{ch.name}</h3>
                    <p className="text-[12px] text-[var(--muted)] leading-relaxed line-clamp-2">{ch.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Setup Modal */}
      <AnimatePresence>
        {setupChannel && (
          <SetupModal
            channel={setupChannel}
            onClose={() => setSetupChannel(null)}
            onConnect={() => handleConnect(setupChannel.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
