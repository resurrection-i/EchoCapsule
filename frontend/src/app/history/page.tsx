"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, RefreshCw, Heart } from "lucide-react";
import { getEmotionHistory, getEmotionComfortStats } from "@/lib/api";

const EMOTION_MAP: Record<number, { label: string; color: string; emoji: string }> = {
  0: { label: "Despair", color: "#1A1A2E", emoji: "😢" },
  1: { label: "Tired", color: "#4A4E69", emoji: "😴" },
  2: { label: "Calm", color: "#D6D2D2", emoji: "😐" },
  3: { label: "On duty", color: "#FFD700", emoji: "😊" },
  4: { label: "Excited", color: "#FFB7B2", emoji: "🤩" },
};

interface HistoryItem {
  id: number;
  emotion_id: number;
  photo_cid: string;
  music_id: number;
  mood_text: string;
  created_at: string;
}

export default function HistoryPage() {
  const [histories, setHistories] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [comfortMap, setComfortMap] = useState<Map<number, number>>(new Map());

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const [res, stats] = await Promise.all([
        getEmotionHistory(page, 10),
        getEmotionComfortStats().catch(() => ({ data: [] })),
      ]);
      setHistories(res.data || []);
      setTotal(res.total);
      const m = new Map<number, number>();
      (stats.data || []).forEach((s: { history_id: number; comfort_count: number }) => m.set(s.history_id, s.comfort_count));
      setComfortMap(m);
    } catch {
      setHistories([
        { id: 1, emotion_id: 4, photo_cid: "", music_id: 0, mood_text: "Tonight’s show was amazing — thank you all!", created_at: new Date().toISOString() },
        { id: 2, emotion_id: 3, photo_cid: "", music_id: 1, mood_text: "In the studio — new album soon.", created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 3, emotion_id: 1, photo_cid: "", music_id: 2, mood_text: "Long rehearsal day — tired but fulfilled.", created_at: new Date(Date.now() - 172800000).toISOString() },
        { id: 4, emotion_id: 2, photo_cid: "", music_id: 0, mood_text: "Quiet afternoon, coffee in hand.", created_at: new Date(Date.now() - 259200000).toISOString() },
      ]);
      setTotal(4);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const formatDate = (dateStr: string | number) => {
    if (!dateStr) return "Unknown time";
    const d = new Date(typeof dateStr === "number"
      ? (dateStr > 1e12 ? dateStr : dateStr * 1000)
      : dateStr);
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) return "Unknown time";

    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1)  return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7)  return `${diffDay}d ago`;

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Mood timeline
            </span>
          </h1>
          <p className="text-white/50">Every mood update is recorded on-chain.</p>
        </motion.div>

        {/* Refresh */}
        <div className="flex justify-end mb-6">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-white/10" />

          <div className="space-y-6">
            {histories.map((item, i) => {
              const emotion = EMOTION_MAP[item.emotion_id] || EMOTION_MAP[2];
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative pl-16"
                >
                  {/* Dot */}
                  <div
                    className="absolute left-4 top-4 w-5 h-5 rounded-full border-2"
                    style={{
                      borderColor: emotion.color,
                      backgroundColor: `${emotion.color}33`,
                    }}
                  />

                  {/* Card */}
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{emotion.emoji}</span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: emotion.color }}
                        >
                          {emotion.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-white/30 text-xs">
                        <Clock className="w-3 h-3" />
                        {formatDate(item.created_at)}
                      </div>
                    </div>

                    <p className="text-white/70 text-sm leading-relaxed">
                      {item.mood_text || "(No mood text)"}
                    </p>

                    {item.photo_cid && (
                      <a
                        href={`https://ipfs.io/ipfs/${item.photo_cid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-xs mt-2 inline-block hover:underline"
                      >
                        View photo (IPFS)
                      </a>
                    )}

                    {/* Comfort count */}
                    {(comfortMap.get(item.id) ?? 0) > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-1.5">
                        <Heart className="w-3 h-3 text-pink-400" />
                        <span className="text-pink-400/80 text-xs font-medium">
                          {comfortMap.get(item.id)} fan comforts
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Pagination */}
        {total > 10 && (
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white/10 rounded-lg text-sm text-white/60 disabled:opacity-30 hover:bg-white/20 transition"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-white/40 text-sm">
              Page {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={histories.length < 10}
              className="px-4 py-2 bg-white/10 rounded-lg text-sm text-white/60 disabled:opacity-30 hover:bg-white/20 transition"
            >
              Next
            </button>
          </div>
        )}

        {histories.length === 0 && !loading && (
          <div className="text-center py-20 text-white/30">
            No mood history yet
          </div>
        )}
      </div>
    </div>
  );
}
