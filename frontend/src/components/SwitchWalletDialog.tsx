"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, LogIn, X } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

export const SwitchWalletDialog: React.FC = () => {
  const { showSwitchDialog, pendingAddress, confirmSwitch, cancelSwitch } = useAuthStore();
  const router = useRouter();

  const handleConfirm = () => {
    confirmSwitch();
    router.push("/login");
  };

  return (
    <AnimatePresence>
      {showSwitchDialog && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-sm rounded-3xl border border-white/10 p-6 space-y-5"
            style={{
              background: "rgba(15,15,20,0.95)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px rgba(0,0,0,0.6)",
            }}
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
          >
            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Account changed</h3>
                <p className="text-white/40 text-xs mt-0.5">MetaMask switched to a new address</p>
              </div>
              <button
                onClick={cancelSwitch}
                className="ml-auto text-white/30 hover:text-white/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New address */}
            {pendingAddress && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/40 text-xs mb-1">New address</p>
                <p className="text-white/80 text-xs font-mono break-all">{pendingAddress}</p>
              </div>
            )}

            <p className="text-white/50 text-sm leading-relaxed">
              Switch to this account and sign in again? Your current session will end.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={cancelSwitch}
                className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm hover:bg-white/5 transition"
              >
                Stay on current account
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
              >
                <LogIn className="w-4 h-4" />
                Switch & sign in
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
