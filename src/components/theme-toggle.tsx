"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl bg-[var(--surface)] border border-[var(--border)]" />
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const getIcon = () => {
    if (theme === "light") return <Sun className="w-4 h-4" />;
    if (theme === "dark") return <Moon className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const getLabel = () => {
    if (theme === "light") return "Light";
    if (theme === "dark") return "Dark";
    return "System";
  };

  return (
    <motion.button
      onClick={cycleTheme}
      className="relative flex items-center gap-2 px-3 py-2 rounded-xl 
        bg-[var(--surface)] hover:bg-[var(--surface-hover)] 
        border border-[var(--border)] hover:border-[var(--border-hover)]
        text-[var(--foreground)] transition-all duration-200
        shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
      whileTap={{ scale: 0.95 }}
      aria-label={`Current theme: ${getLabel()}. Click to change.`}
      title={`Theme: ${getLabel()}`}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={theme}
          initial={{ rotate: -30, opacity: 0, scale: 0.8 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 30, opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center text-[var(--accent)]"
        >
          {getIcon()}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
