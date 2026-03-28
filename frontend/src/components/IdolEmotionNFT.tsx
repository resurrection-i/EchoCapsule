"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

/* Emotion → audio (file names on disk may stay localized) */
const EMOTION_AUDIO_MAP: Record<number, { label: string; file: string }> = {
  0: { label: "Love This World", file: "/audio/华晨宇 - 好想爱这个世界啊.mp3" },
  1: { label: "Warm House", file: "/audio/温暖的房子 - 华晨宇.mp3" },
  2: { label: "Seek", file: "/audio/华晨宇 - 寻 (音乐纯享版)_1.mp3" },
  3: { label: "Grotesque Mind", file: "/audio/怪诞心理学 - 华晨宇.mp3" },
  4: { label: "Sunrise Together", file: "/audio/华晨宇 - 走，一起去看日出吧.mp3" },
};

/* Emotion visual config */
interface EmotionConfig {
  id: number;
  label: string;
  moodLabel: string;
  color: string;
  glow: string;
  filter: string;
  chibiVariant: Record<string, any>;
  speed: number;
}

const EMOTIONS: EmotionConfig[] = [
  {
    id: 0,
    label: "EMO",
    moodLabel: "Despair",
    color: "#1A1A2E",
    glow: "rgba(26,26,46,0.6)",
    filter: "grayscale(80%) brightness(70%)",
    chibiVariant: {
      animate: { y: [0, -6, 0] },
      transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
    },
    speed: 6,
  },
  {
    id: 1,
    label: "TIRED",
    moodLabel: "Tired",
    color: "#4A4E69",
    glow: "rgba(74,78,105,0.45)",
    filter: "sepia(40%) contrast(90%)",
    chibiVariant: {
      animate: { rotate: [0, -2, 2, -1, 0] },
      transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    },
    speed: 5,
  },
  {
    id: 2,
    label: "NEUTRAL",
    moodLabel: "Calm",
    color: "#D6D2D2",
    glow: "rgba(214,210,210,0.3)",
    filter: "none",
    chibiVariant: {
      animate: { y: [0, -8, 0] },
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    },
    speed: 3,
  },
  {
    id: 3,
    label: "ACTIVE",
    moodLabel: "On duty",
    color: "#FFD700",
    glow: "rgba(255,215,0,0.5)",
    filter: "contrast(110%) brightness(105%)",
    chibiVariant: {
      animate: { y: [0, -14, 0], scale: [1, 1.05, 1] },
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
    },
    speed: 1.5,
  },
  {
    id: 4,
    label: "HAPPY",
    moodLabel: "Excited",
    color: "#FFB7B2",
    glow: "rgba(255,183,178,0.65)",
    filter: "saturate(130%) hue-rotate(-10deg)",
    chibiVariant: {
      animate: { scale: [1, 1.12, 1, 1.08, 1] },
      transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
    },
    speed: 0.8,
  },
];

/* Pink particles (happy state) */
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: (i * 19 + 5) % 100,
  size: 3 + (i % 3) * 2,
  delay: (i * 0.35) % 3,
  dur: 2.5 + (i % 4) * 0.5,
}));

const PinkParticles: React.FC = () => (
  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-3xl">
    {PARTICLES.map((p) => (
      <motion.div
        key={p.id}
        className="absolute rounded-full"
        style={{
          left: `${p.left}%`,
          bottom: -10,
          width: p.size,
          height: p.size,
          background: `rgba(255,${140 + p.id * 8},${160 + p.id * 6},${0.5 + (p.id % 3) * 0.15})`,
        }}
        animate={{ y: [-10, -320], opacity: [0.8, 0] }}
        transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
      />
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════
   Empty-state placeholder
   ═══════════════════════════════════════════════════════ */
const NoisePatternFallback: React.FC<{ color: string }> = ({ color }) => (
  <div
    className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
    style={{
      background: "linear-gradient(160deg, #1a1a20 0%, #111116 40%, #0d0d12 100%)",
    }}
  >
    {/* 噪点纹理 */}
    <div
      className="absolute inset-0 opacity-[0.06]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "96px 96px",
      }}
    />
    {/* 情绪色边缘晕染 */}
    <div
      className="absolute inset-0"
      style={{ background: `radial-gradient(ellipse at 50% 100%, ${color}18 0%, transparent 65%)` }}
    />
    {/* 扫描线 */}
    <motion.div
      className="absolute left-0 right-0 h-px pointer-events-none"
      style={{ background: `linear-gradient(to right, transparent, ${color}40, transparent)` }}
      animate={{ top: ["0%", "100%"] }}
      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
    />
    {/* 中心信号图标 */}
    <div className="relative z-10 flex flex-col items-center gap-3">
      <motion.div
        animate={{ opacity: [0.25, 0.6, 0.25], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          border: `1px dashed ${color}60`,
          background: `${color}0a`,
        }}
      >
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: `${color}80` }} />
      </motion.div>
      <p className="text-white/20 text-[10px] tracking-[0.25em] font-mono uppercase">Awaiting Signal</p>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════
   Props 接口
   ═══════════════════════════════════════════════════════ */
interface IdolEmotionNFTProps {
  emotionId: number;
  photoCid?: string;
  previewUrl?: string;
  idolName?: string;
}

/* ═══════════════════════════════════════════════════════
   主组件：IdolEmotionNFT
   ═══════════════════════════════════════════════════════ */
export const IdolEmotionNFT: React.FC<IdolEmotionNFTProps> = ({
  emotionId,
  photoCid,
  previewUrl,
  idolName = "Stardol",
}) => {
  const config = EMOTIONS[emotionId] ?? EMOTIONS[2];
  const isHappy = emotionId === 4;

  /* ── Audio Player State ── */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const audioInfo = EMOTION_AUDIO_MAP[emotionId] ?? EMOTION_AUDIO_MAP[2];

  // 情绪切换时：暂停旧曲目、加载新曲目
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const wasPlaying = !audio.paused;
    audio.pause();
    audio.src = audioInfo.file;
    audio.load();
    setAudioReady(false);
    setIsPlaying(false);

    const handleCanPlay = () => {
      setAudioReady(true);
      // 如果切换前在播放，自动续播新曲
      if (wasPlaying) {
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };
    audio.addEventListener("canplaythrough", handleCanPlay, { once: true });
    return () => audio.removeEventListener("canplaythrough", handleCanPlay);
  }, [emotionId, audioInfo.file]);

  // 组件卸载时彻底清理
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  // previewUrl (local objectURL) takes priority for instant display;
  // fall back to IPFS gateway URL once real CID is available
  const photoUrl = previewUrl
    ? previewUrl
    : photoCid
    ? `https://gateway.pinata.cloud/ipfs/${photoCid}`
    : null;

  return (
    <div className="relative w-full" style={{ aspectRatio: "4/5" }}>
      {/* ═══ Layer 1: Background & Aura ═══ */}
      <motion.div
        className="absolute inset-0 rounded-3xl overflow-hidden"
        animate={{
          boxShadow: `0 0 40px 8px ${config.glow}, 0 0 80px 16px ${config.glow.replace(/[\d.]+\)$/, "0.2)")}`,
        }}
        transition={{ duration: 1.5 }}
      >
        {/* 深色磨砂底 */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(160deg, #0c0c10 0%, #141418 50%, #0a0a0e 100%)",
          }}
        />

        {/* 情绪光晕 */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: `radial-gradient(ellipse at 50% 35%, ${config.glow} 0%, transparent 65%)`,
          }}
          transition={{ duration: 1.8 }}
        />

        {/* 呼吸光 */}
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0.2, 0.55, 0.2] }}
          transition={{ duration: config.speed, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: `radial-gradient(circle at 50% 40%, ${config.glow} 0%, transparent 55%)`,
          }}
        />

        {/* 情绪色边框 */}
        <motion.div
          className="absolute inset-0 rounded-3xl"
          animate={{ borderColor: config.color }}
          transition={{ duration: 1.2 }}
          style={{ border: `1.5px solid ${config.color}30` }}
        />

        {/* Happy 粒子 */}
        {isHappy && <PinkParticles />}
      </motion.div>

      {/* ═══ 内容区 ═══ */}
      <div className="relative z-10 h-full flex flex-col p-5 gap-4">

        {/* 顶部状态栏 */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: config.color }}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: config.speed / 2, repeat: Infinity }}
            />
            <span className="text-white/30 text-xs font-mono tracking-wider uppercase">
              {config.label} · {config.moodLabel}
            </span>
          </div>
          <span className="text-white/15 text-xs font-mono">IDOL CAPSULE</span>
        </div>

        {/* ═══ Layer 2: The Photo Window ═══ */}
        <div className="relative flex-1 flex items-center justify-center">
          {/* 1:1 正方形容器 — aspect-square 撑高，不用 padding-bottom hack */}
          <div className="relative w-full aspect-square">
            <motion.div
              className="absolute inset-0 rounded-2xl overflow-hidden"
              animate={{ borderColor: `${config.color}40` }}
              transition={{ duration: 1 }}
              style={{
                border: "1px solid",
                filter: config.filter,
              }}
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={idolName}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <NoisePatternFallback color={config.color} />
              )}

              {/* 底部渐变蒙版 */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none"
                style={{
                  background: `linear-gradient(to top, rgba(10,10,14,0.88) 0%, transparent 100%)`,
                }}
              />
            </motion.div>

            {/* ═══ Layer 3: The Chibi Seal — 纯透明悬浮，无任何背景 ═══ */}
            <motion.img
              src="/huahua.png"
              alt="Chibi idol"
              className="absolute -bottom-6 -right-5 z-30 w-24 h-24 object-contain pointer-events-none select-none"
              style={{
                filter: `${config.filter !== "none" ? config.filter + " " : ""}drop-shadow(0 6px 18px rgba(0,0,0,0.7)) drop-shadow(0 2px 6px rgba(0,0,0,0.5))`,
              }}
              animate={config.chibiVariant.animate}
              transition={config.chibiVariant.transition}
              draggable={false}
            />
          </div>
        </div>

        {/* ═══ 玻璃拟态音频播放控制条 ═══ */}
        <div className="shrink-0">
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl cursor-pointer select-none transition-all hover:bg-white/[0.08]"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${config.color}20`,
            }}
            onClick={togglePlay}
          >
            {/* Play / Pause 按钮 */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
              style={{ background: `${config.color}25`, border: `1px solid ${config.color}40` }}
            >
              {isPlaying ? (
                <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                  <rect x="1" y="1" width="3" height="12" rx="1" fill={config.color} />
                  <rect x="8" y="1" width="3" height="12" rx="1" fill={config.color} />
                </svg>
              ) : (
                <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                  <path d="M2 1.5L10.5 7L2 12.5V1.5Z" fill={config.color} />
                </svg>
              )}
            </div>

            {/* 曲名 + 情绪 */}
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs font-medium truncate leading-tight">
                {audioInfo.label}
              </p>
              <p className="text-white/25 text-[10px] font-mono truncate">
                {config.moodLabel} · {config.label}
              </p>
            </div>

            {/* 音频柱动画 — 仅播放时跳动 */}
            <div className="flex items-end gap-[2px] h-4 shrink-0">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full"
                  style={{ background: config.color }}
                  animate={
                    isPlaying
                      ? {
                          height: [4, 10 + i * 3, 5, 14 - i * 2, 4],
                          opacity: [0.6, 1, 0.5, 0.9, 0.6],
                        }
                      : { height: 4, opacity: 0.3 }
                  }
                  transition={
                    isPlaying
                      ? {
                          duration: 0.8 + i * 0.15,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.12,
                        }
                      : { duration: 0.3 }
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/* 底部信息区 */}
        <div className="shrink-0 space-y-2.5">
          {/* 偶像名 + 状态 */}
          <div className="flex items-end justify-between">
            <h3 className="text-white font-bold text-lg leading-tight">{idolName}</h3>
            <motion.div
              className="px-3 py-1 rounded-full text-xs font-mono tracking-wider"
              animate={{
                backgroundColor: `${config.color}20`,
                borderColor: `${config.color}50`,
                color: config.color,
              }}
              transition={{ duration: 1 }}
              style={{ border: "1px solid" }}
            >
              {config.label}
            </motion.div>
          </div>

          {/* 频谱指示条 */}
          <div className="flex items-end gap-1 h-5">
            {[...Array(12)].map((_, i) => {
              const baseH = 4 + ((emotionId + 1) * 2 + i * 1.5) % 16;
              return (
                <motion.div
                  key={i}
                  className="flex-1 rounded-sm min-w-0"
                  style={{ background: config.color, opacity: 0.5 }}
                  animate={{
                    height: [baseH, baseH * 0.3, baseH * 1.1, baseH * 0.5, baseH],
                    opacity: [0.5, 0.25, 0.65, 0.35, 0.5],
                  }}
                  transition={{
                    duration: config.speed * (0.5 + i * 0.06),
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.08,
                  }}
                />
              );
            })}
          </div>

          {/* 底部标记 */}
          <div className="flex items-center justify-between">
            <span className="text-white/15 text-[10px] font-mono tracking-widest">IDOL CAPSULE NFT</span>
            <span className="text-white/15 text-[10px] font-mono tracking-widest">SEPOLIA</span>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} loop preload="auto" />
    </div>
  );
};

export default IdolEmotionNFT;
