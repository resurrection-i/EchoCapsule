"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CAPSULE_NFT_ADDRESS, CAPSULE_NFT_ABI } from "@/lib/contracts";

interface Props {
  address: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SuperComfortModal({ address, onClose, onSuccess }: Props) {
  const [message, setMessage] = useState("");

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  React.useEffect(() => {
    if (isSuccess) {
      setTimeout(onSuccess, 1200);
    }
  }, [isSuccess]);

  const handleSend = () => {
    writeContract({
      address: CAPSULE_NFT_ADDRESS,
      abi: CAPSULE_NFT_ABI,
      functionName: "superComfort",
      args: [message],
      value: parseEther("0.0001"),
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-md p-6 rounded-2xl bg-[#0d0d1a] border border-purple-500/30 shadow-2xl"
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Super comfort</h2>
            <p className="text-white/40 text-xs">On-chain message · 0.0001 Sepolia ETH</p>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-5">
          <p className="text-white/60 text-xs leading-relaxed">
            ✨ Your message is stored on-chain forever. The idol sees it on the Echo wall.
            Each super comfort costs <span className="text-purple-400 font-bold">0.0001 ETH</span>.
          </p>
        </div>

        {/* Input */}
        <div className="space-y-2 mb-5">
          <label className="text-white/60 text-sm">Say something to the idol</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Thanks for the show today — get some rest!"
            maxLength={100}
            rows={3}
            disabled={isPending || isConfirming || isSuccess}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/20 text-sm resize-none focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
          />
          <p className="text-white/20 text-xs text-right">{message.length}/100</p>
        </div>

        {/* Status */}
        {isSuccess && (
          <div className="flex items-center gap-2 text-green-400 text-sm mb-4">
            <CheckCircle className="w-4 h-4" />
            <span>On-chain! The idol will see your message ✨</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs mb-4">
            <AlertCircle className="w-4 h-4" />
            <span className="truncate">{error.message.slice(0, 80)}</span>
          </div>
        )}
        {hash && !isSuccess && (
          <div className="mb-4">
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 text-xs hover:underline font-mono"
            >
              Tx: {hash.slice(0, 14)}...{hash.slice(-8)}
            </a>
          </div>
        )}

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || isPending || isConfirming || isSuccess}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isPending || isConfirming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isPending ? "Awaiting signature…" : "Confirming…"}
            </>
          ) : isSuccess ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Sent
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Send super comfort
            </>
          )}
        </button>

        {/* Address */}
        <p className="text-white/20 text-xs text-center mt-3 font-mono truncate">
          {address}
        </p>
      </motion.div>
    </motion.div>
  );
}
