"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Clock, Zap } from "lucide-react";
import { getSuperComforts } from "@/lib/api";

/* Types */
interface SuperComfort {
  id: number;
  wallet_address: string;
  message: string;
  amount: string;
  tx_hash: string;
  block_number: number;
  created_at: string;
}

interface Props {
  onClose: () => void;
}

/* Relative time */
function formatRelative(dateStr: string) {
  if (!dateStr) return "Unknown time";
  const d = new Date(dateStr);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return "Unknown time";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ETH amount */
function formatEth(amount: string) {
  const n = Number(amount);
  if (!n || isNaN(n)) return "0.0001 ETH";
  return `${(n / 1e18).toFixed(4)} ETH`;
}

/* Address-based identicon */
function Identicon({ address }: { address: string }) {
  const colors = ["#f472b6", "#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#fb7185", "#818cf8"];
  const idx = parseInt(address.slice(2, 4), 16) % colors.length;
  const idx2 = parseInt(address.slice(4, 6), 16) % colors.length;
  const letter = address.slice(2, 3).toUpperCase();
  return (
    <div
      className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold text-white select-none"
      style={{ background: `linear-gradient(135deg, ${colors[idx]}, ${colors[idx2]})` }}
    >
      {letter}
    </div>
  );
}

const LIMIT = 8;

export default function EchoWallModal({ onClose }: Props) {
  const [items, setItems] = useState<SuperComfort[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"time" | "amount">("time");
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchPage = useCallback(async (p: number, s: "time" | "amount") => {
    setLoading(true);
    try {
      const res = await getSuperComforts({ page: p, limit: LIMIT, sort: s });
      setItems(res.data || []);
      setTotal(res.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(page, sort);
  }, [page, sort, fetchPage]);

  // Indexer may lag after confirmation; refresh periodically while open
  useEffect(() => {
    const id = setInterval(() => {
      fetchPage(page, sort);
    }, 12_000);
    return () => clearInterval(id);
  }, [page, sort, fetchPage]);

  const handleSort = (s: "time" | "amount") => {
    setSort(s);
    setPage(1);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Panel */}
      <motion.div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #0f0f14 0%, #12121a 100%)",
          border: "1px solid rgba(167,139,250,0.2)",
          boxShadow: "0 0 60px rgba(167,139,250,0.08)",
        }}
        initial={{ scale: 0.93, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.93, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 260 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💌</span>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Echo archive</h2>
              <p className="text-white/30 text-xs">On-chain messages · {total} total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchPage(page, sort)}
              className="text-xs text-purple-300/80 hover:text-purple-200 px-2 py-1 rounded-lg bg-white/5 border border-white/10"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 shrink-0">
          <span className="text-white/30 text-xs mr-1">Sort:</span>
          {(["time", "amount"] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleSort(s)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition ${
                sort === s
                  ? "bg-purple-500/25 text-purple-300 border border-purple-500/40"
                  : "bg-white/5 text-white/35 hover:bg-white/10 border border-transparent"
              }`}
            >
              {s === "time" ? <><Clock className="w-3 h-3" />Newest</>
                           : <><Zap className="w-3 h-3" />Top tip</>}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-purple-500/40 border-t-purple-400 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-white/25 text-sm">No super-comfort messages yet</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${page}-${sort}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                {items.map((sc, i) => (
                  <motion.div
                    key={sc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-3 p-4 rounded-2xl border transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      borderColor: "rgba(167,139,250,0.12)",
                    }}
                  >
                    {/* Identicon */}
                    <Identicon address={sc.wallet_address} />

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-purple-400/80 text-xs font-mono">
                          {sc.wallet_address.slice(0, 6)}...{sc.wallet_address.slice(-4)}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}
                          >
                            {formatEth(sc.amount)}
                          </span>
                        </div>
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed mb-2">
                        "{sc.message}"
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-white/20 text-[10px] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelative(sc.created_at)}
                        </span>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${sc.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400/40 text-[10px] font-mono hover:text-blue-400 transition truncate max-w-[160px]"
                        >
                          {sc.tx_hash.slice(0, 16)}...
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-white/8 shrink-0">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 disabled:opacity-30 flex items-center justify-center transition"
            >
              <ChevronLeft className="w-4 h-4 text-white/60" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition ${
                  n === page
                    ? "bg-purple-500/40 text-purple-200 border border-purple-500/50"
                    : "bg-white/5 text-white/40 hover:bg-white/12"
                }`}
              >
                {n}
              </button>
            ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 disabled:opacity-30 flex items-center justify-center transition"
            >
              <ChevronRight className="w-4 h-4 text-white/60" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
