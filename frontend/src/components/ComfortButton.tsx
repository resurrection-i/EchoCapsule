"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

interface Props {
  onSendComfort: () => Promise<void>;
  disabled?: boolean;
}

export const ComfortButton: React.FC<Props> = ({ onSendComfort, disabled }) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [ripples, setRipples] = useState<number[]>([]);

  const handleClick = async () => {
    if (sending || disabled) return;

    setSending(true);
    const rippleId = Date.now();
    setRipples((prev) => [...prev, rippleId]);

    try {
      await onSendComfort();
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch {
      setRipples((prev) => prev.filter((id) => id !== rippleId));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative inline-block">
      {/* Ripple effect */}
      <AnimatePresence>
        {ripples.map((id) => (
          <motion.div
            key={id}
            initial={{ scale: 0.5, opacity: 0.8 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            onAnimationComplete={() => setRipples((prev) => prev.filter((r) => r !== id))}
            className="absolute inset-0 rounded-full border-2 border-pink-400 pointer-events-none"
          />
        ))}
      </AnimatePresence>

      <motion.button
        onClick={handleClick}
        disabled={sending || disabled}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-300 ${
          sent
            ? "bg-pink-500 text-white"
            : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Heart
          className={`w-5 h-5 transition-all ${sent ? "fill-white" : ""}`}
        />
        {sent ? "Comfort sent" : sending ? "Sending…" : "Send comfort"}
      </motion.button>
    </div>
  );
};

export default ComfortButton;
