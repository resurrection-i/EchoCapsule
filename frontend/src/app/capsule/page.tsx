"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, RefreshCw, X, Camera, Crown, Lock, Trophy } from "lucide-react";
import { useAccount } from "wagmi";
import IdolEmotionNFT from "@/components/IdolEmotionNFT";
import ComfortButton from "@/components/ComfortButton";
import SuperComfortModal from "@/components/SuperComfortModal";
import { useAuthStore } from "@/lib/authStore";
import { useFanStore } from "@/lib/fanStore";
import { useIdolCurrentState } from "@/lib/useIdolCurrentState";
import {
  sendComfort,
  getComfortCount,
  getTopFans,
  checkTodayFree,
} from "@/lib/api";

const EMOTION_CONFIG: Record<number, { color: string; label: string; emoji: string }> = {
  0: { color: "#6366f1", label: "Despair", emoji: "😢" },
  1: { color: "#94a3b8", label: "Tired", emoji: "😴" },
  2: { color: "#D6D2D2", label: "Calm", emoji: "😐" },
  3: { color: "#FFD700", label: "On duty", emoji: "😊" },
  4: { color: "#f472b6", label: "Excited", emoji: "🤩" },
};

const GATE_THRESHOLD = 5; // comforts to unlock diary

export default function CapsulePage() {
  const { address } = useAccount();
  const { role } = useAuthStore();
  const isIdol = role === "idol";

  // Shared state
  const idolState = useIdolCurrentState();
  const { myComfortCount, todayUsedFree, fetchMyCount, incrementCount, setTodayUsedFree } = useFanStore();

  const [comfortCount, setComfortCount] = useState(0);
  const [showPolaroid, setShowPolaroid] = useState(false);
  const [topFans, setTopFans] = useState<Array<{ address: string; count: number }>>([]);
  const [showSuperModal, setShowSuperModal] = useState(false);

  const emotionId = idolState.emotionId;
  const photoCid = idolState.photoCid;
  const moodText = idolState.moodText;

  const diaryUnlocked = isIdol || myComfortCount >= GATE_THRESHOLD;

  // Global comfort count + top fans
  const fetchSupplementary = async () => {
    try {
      const [comfort] = await Promise.all([getComfortCount()]);
      setComfortCount(comfort.count);
      if (isIdol) {
        const fans = await getTopFans();
        setTopFans(fans.data || []);
      }
    } catch {
      console.log("Using default state (backend may not be running)");
    }
  };

  // Today’s free comfort quota
  const checkFreeQuota = async () => {
    if (!address || isIdol) return;
    try {
      const r = await checkTodayFree(address);
      setTodayUsedFree(r.used);
    } catch {
      setTodayUsedFree(false);
    }
  };

  useEffect(() => {
    fetchSupplementary();
    if (address && !isIdol) {
      fetchMyCount(address);
      checkFreeQuota();
    }
    const interval = setInterval(fetchSupplementary, 10000);
    return () => clearInterval(interval);
  }, [address, isIdol]);

  const handleComfort = async () => {
    if (!address) return;
    await sendComfort(address);
    setComfortCount((prev) => prev + 1);
    incrementCount();          // Zustand global — survives page nav
    setTodayUsedFree(true); // free comfort used for today
  };

  const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

  const PODIUM_ICONS = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Emotion capsule
            </span>
          </h1>
          <p className="text-white/50">
            {isIdol ? "Fan engagement overview" : "Feel the idol’s mood right now"}
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row items-start gap-12 justify-center">
          {/* NFT */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-md mx-auto lg:mx-0"
          >
            <IdolEmotionNFT
              emotionId={emotionId}
              photoCid={photoCid}
              idolName="StarIdol"
            />
          </motion.div>

          {/* Side panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-md space-y-6"
          >
            {/* Status */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Current status</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Mood</span>
                  <span className="text-white font-medium">
                    {EMOTION_CONFIG[emotionId]?.emoji} {EMOTION_CONFIG[emotionId]?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Note</span>
                  <span className="text-white/80 text-right max-w-[200px] truncate">
                    {moodText}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Global comforts</span>
                  <span className="text-pink-400 font-medium">{comfortCount}</span>
                </div>
              </div>
            </div>

            {/* Fan: comfort + gated diary */}
            {!isIdol && (
              <>
                {/* Interactions */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <h3 className="text-lg font-bold text-white">Fan actions</h3>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/50 text-sm">
                      <Heart className="w-4 h-4 text-pink-400" />
                      <span>My comforts: {myComfortCount}</span>
                    </div>
                    <button onClick={fetchSupplementary} className="text-white/30 hover:text-white/60 transition">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Diary unlock progress */}
                  {!diaryUnlocked && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-white/40">
                        <span>Diary unlock</span>
                        <span>{myComfortCount}/{GATE_THRESHOLD}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (myComfortCount / GATE_THRESHOLD) * 100)}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Free comfort vs super comfort */}
                  {todayUsedFree ? (
                    <button
                      onClick={() => setShowSuperModal(true)}
                      disabled={!address}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2 text-sm"
                    >
                      ✨ Super comfort (0.0001 ETH)
                    </button>
                  ) : (
                    <ComfortButton onSendComfort={handleComfort} disabled={!address} />
                  )}

                  {!address && (
                    <p className="text-white/30 text-xs">Connect a wallet to send comfort</p>
                  )}
                </div>

                {/* Mood story (gated) */}
                <motion.div
                  className="relative p-6 rounded-2xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-white/25 transition group"
                  onClick={() => diaryUnlocked && setShowPolaroid(true)}
                  whileHover={diaryUnlocked ? { scale: 1.01 } : {}}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-blue-400" />
                      <h3 className="text-lg font-bold text-white">Mood story</h3>
                    </div>
                    {diaryUnlocked ? (
                      <Camera className="w-4 h-4 text-white/20 group-hover:text-white/50 transition" />
                    ) : (
                      <Lock className="w-4 h-4 text-white/30" />
                    )}
                  </div>

                  {/* Blur when locked */}
                  <div className={`transition-all ${diaryUnlocked ? "" : "blur-md select-none pointer-events-none"}`}>
                    <p className="text-white/60 text-sm leading-relaxed line-clamp-3">
                      {moodText || "The idol hasn’t shared a story yet…"}
                    </p>
                  </div>

                  {/* Locked overlay */}
                  {!diaryUnlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 rounded-2xl">
                      <Lock className="w-6 h-6 text-white/50 mb-2" />
                      <p className="text-white/60 text-xs text-center px-4">
                        🔒 Send {GATE_THRESHOLD} comforts total to unlock the private diary.
                      </p>
                    </div>
                  )}

                  {diaryUnlocked && (
                    <p className="text-white/25 text-xs mt-3">Tap to open polaroid ↗</p>
                  )}
                </motion.div>
              </>
            )}

            {/* Idol: top fans */}
            {isIdol && (
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-bold text-white">Top fans</h3>
                </div>

                {topFans.length === 0 ? (
                  <p className="text-white/30 text-sm py-4 text-center">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {topFans.map((fan, i) => (
                      <div
                        key={fan.address}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8"
                      >
                        <span className="text-xl shrink-0">{PODIUM_ICONS[i] || "🏅"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-sm font-mono truncate">
                            {shortAddr(fan.address)}
                          </p>
                          <p className="text-white/40 text-xs">{fan.count} comforts</p>
                        </div>
                        {i === 0 && (
                          <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-white/8">
                  <div className="flex items-center justify-between text-sm text-white/40">
                    <span>Total comforts</span>
                    <span className="text-pink-400 font-bold">{comfortCount}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Super comfort modal */}
      <AnimatePresence>
        {showSuperModal && (
          <SuperComfortModal
            address={address || ""}
            onClose={() => setShowSuperModal(false)}
            onSuccess={() => {
              setShowSuperModal(false);
              setComfortCount((p) => p + 1);
              incrementCount();
            }}
          />
        )}
      </AnimatePresence>

      {/* Polaroid modal */}
      <AnimatePresence>
        {showPolaroid && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPolaroid(false)}
          >
            <motion.div
              className="relative max-w-sm w-full"
              initial={{ scale: 0.8, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, rotate: -2, opacity: 1 }}
              exit={{ scale: 0.8, rotate: -6, opacity: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Polaroid card */}
              <div className="bg-white p-4 pb-16 shadow-2xl" style={{ borderRadius: "2px" }}>
                <div
                  className="w-full aspect-square flex items-center justify-center overflow-hidden mb-2"
                  style={{
                    background: photoCid
                      ? undefined
                      : `linear-gradient(135deg, ${EMOTION_CONFIG[emotionId]?.color}33, #000)`,
                  }}
                >
                  {photoCid ? (
                    <img
                      src={`https://gateway.pinata.cloud/ipfs/${photoCid}`}
                      alt="idol photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-8xl">{EMOTION_CONFIG[emotionId]?.emoji}</span>
                  )}
                </div>
                <div className="px-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        color: EMOTION_CONFIG[emotionId]?.color,
                        border: `1px solid ${EMOTION_CONFIG[emotionId]?.color}`,
                        background: `${EMOTION_CONFIG[emotionId]?.color}18`,
                      }}
                    >
                      {EMOTION_CONFIG[emotionId]?.label}
                    </span>
                  </div>
                  <p
                    className="text-gray-700 text-sm leading-relaxed"
                    style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}
                  >
                    &ldquo;{moodText || "No words — just this moment."}&rdquo;
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPolaroid(false)}
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-center text-white/30 text-xs mt-4">Click outside to close</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
