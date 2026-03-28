"use client";

import React from "react";
import { motion } from "framer-motion";

const EMOTION_CONFIG = [
  { id: 0, label: "EMO",     color: "#6366f1", glow: "rgba(99,102,241,0.4)",  speed: 8,   bars: [2,1,2,1,3,1,2] },
  { id: 1, label: "TIRED",   color: "#94a3b8", glow: "rgba(148,163,184,0.3)", speed: 5,   bars: [3,2,2,3,2,2,3] },
  { id: 2, label: "NEUTRAL", color: "#D6D2D2", glow: "rgba(214,210,210,0.3)", speed: 4,   bars: [5,4,6,5,4,6,5] },
  { id: 3, label: "ACTIVE",  color: "#FFD700", glow: "rgba(255,215,0,0.5)",   speed: 1.5, bars: [8,12,9,14,10,13,8] },
  { id: 4, label: "HAPPY",   color: "#f472b6", glow: "rgba(244,114,182,0.7)", speed: 0.8, bars: [14,18,12,20,15,19,13] },
];

const EMOTION_MOOD_LABELS: Record<number, string> = {
  0: "Despair",
  1: "Tired",
  2: "Calm",
  3: "On duty",
  4: "Excited",
};

interface Props {
  emotionId: number;
  photoCid?: string;
  idolName: string;
  moodText?: string;
  tokenId?: number;
  showOverlay?: boolean;
  onActivate?: () => void;
}

export const EmotionNFT: React.FC<Props> = ({
  emotionId,
  photoCid,
  idolName,
  moodText,
  tokenId,
  showOverlay = false,
  onActivate,
}) => {
  const config = EMOTION_CONFIG[emotionId] || EMOTION_CONFIG[2];
  const [activated, setActivated] = React.useState(!showOverlay);

  const handleActivate = () => {
    setActivated(true);
    onActivate?.();
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-6 rounded-3xl overflow-hidden"
      style={{ background: "linear-gradient(145deg, #0a0a0a, #1a1a1a)" }}
    >
      {/* 背景流光效果 */}
      <motion.div
        animate={{
          background: `radial-gradient(circle at center, ${config.glow} 0%, transparent 70%)`,
        }}
        transition={{ duration: 2 }}
        className="absolute inset-0 z-0"
      />

      {/* 呼吸光效 */}
      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: config.speed, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 z-0"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${config.glow} 0%, transparent 60%)`,
        }}
      />

      {/* 核心 SVG NFT */}
      <motion.svg
        viewBox="0 0 400 540"
        className="w-full max-w-[380px] z-10 drop-shadow-2xl"
        initial={false}
      >
        <defs>
          <clipPath id="photo-clip">
            <rect x="30" y="44" width="340" height="280" rx="16" />
          </clipPath>
          <linearGradient id={`grad-${emotionId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={config.color} stopOpacity="0.15" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* 卡片背景 */}
        <rect x="4" y="4" width="392" height="532" rx="28" fill="#0d0d0d" />

        {/* 外框 */}
        <motion.rect
          x="4" y="4" width="392" height="532" rx="28"
          stroke={config.color} strokeWidth="2" fill="none"
          animate={{ stroke: config.color }}
          transition={{ duration: 1.5 }}
        />

        {/* 照片区域 */}
        {photoCid ? (
          <image
            href={`https://gateway.pinata.cloud/ipfs/${photoCid}`}
            x="30" y="44" width="340" height="280"
            clipPath="url(#photo-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <>
            {/* 无照片占位：渐变背景 + 图标 */}
            <rect x="30" y="44" width="340" height="280" rx="16"
              fill={`url(#grad-${emotionId})`} />
            <rect x="30" y="44" width="340" height="280" rx="16"
              fill="none" stroke={config.color} strokeWidth="1" strokeOpacity="0.3" />
            {/* 大情绪圆 */}
            <motion.circle cx="200" cy="184" r="60"
              fill={config.color} fillOpacity="0.12"
              stroke={config.color} strokeWidth="1.5" strokeOpacity="0.4"
              animate={{ r: [58, 64, 58] }}
              transition={{ duration: config.speed, repeat: Infinity, ease: "easeInOut" }}
            />
            <text x="200" y="196" textAnchor="middle" fontSize="42" fontFamily="serif"
              fill={config.color} fillOpacity="0.9">
              {["😢","😴","😐","😊","🤩"][emotionId]}
            </text>
          </>
        )}

        {/* 照片渐变遮罩（底部淡出） */}
        <rect x="30" y="240" width="340" height="84" rx="0"
          fill={`url(#grad-${emotionId})`} opacity="0.8" />

        {/* 情绪指示灯 */}
        <motion.circle cx="370" cy="24" r="5"
          fill={config.color}
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: config.speed / 2, repeat: Infinity }}
        />
        <circle cx="356" cy="24" r="5" fill={config.color} fillOpacity="0.3" />
        <circle cx="342" cy="24" r="5" fill={config.color} fillOpacity="0.15" />

        {/* 偶像名 + Token ID */}
        <text x="44" y="370" fill="white" fontSize="20" fontWeight="bold" fontFamily="sans-serif">
          {idolName}
        </text>
        {tokenId !== undefined && (
          <text x="356" y="370" fill={config.color} fontSize="13"
            fontFamily="monospace" textAnchor="end" opacity={0.7}>
            #{tokenId}
          </text>
        )}

        {/* 状态标签 */}
        <rect x="44" y="380" width="110" height="22" rx="11"
          fill={config.color} fillOpacity="0.15"
          stroke={config.color} strokeWidth="1" strokeOpacity="0.5" />
        <text x="99" y="395" textAnchor="middle" fill={config.color}
          fontSize="11" fontFamily="monospace" letterSpacing="1">
          {config.label} · {EMOTION_MOOD_LABELS[emotionId]}
        </text>

        {/* 心情文字 */}
        <text x="44" y="424" fill="#aaa" fontSize="12" fontFamily="sans-serif">
          {(moodText || "").length > 34
            ? (moodText || "").substring(0, 34) + "…"
            : (moodText || "No mood yet")}
        </text>

        {/* ── 音乐频谱条 ── */}
        <text x="44" y="458" fill={config.color} fontSize="9"
          fontFamily="monospace" opacity="0.5" letterSpacing="1">
          SPECTRUM
        </text>
        {config.bars.map((h, i) => (
          <motion.rect
            key={i}
            x={44 + i * 14}
            y={480 - h}
            width="8"
            height={h}
            rx="2"
            fill={config.color}
            fillOpacity="0.75"
            animate={{ height: [h, h * 0.3, h * 1.2, h * 0.5, h], y: [480 - h, 480 - h * 0.3, 480 - h * 1.2, 480 - h * 0.5, 480 - h] }}
            transition={{
              duration: config.speed * (0.6 + i * 0.08),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.1,
            }}
          />
        ))}

        {/* 底部装饰线 */}
        <line x1="44" y1="496" x2="356" y2="496"
          stroke={config.color} strokeWidth="0.5" strokeOpacity="0.2" />
        <text x="200" y="520" textAnchor="middle" fill={config.color}
          fontSize="9" fontFamily="monospace" opacity="0.3" letterSpacing="2">
          IDOL CAPSULE NFT · SEPOLIA
        </text>
      </motion.svg>

      {/* 沉浸式激活遮罩 (The "Unbox" Overlay) */}
      {!activated && showOverlay && (
        <motion.div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center cursor-pointer backdrop-blur-lg bg-black/40"
          onClick={handleActivate}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          whileHover={{ scale: 1.02 }}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 rounded-full border-2 flex items-center justify-center mb-4"
            style={{ borderColor: config.color }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill={config.color}>
              <polygon points="8,5 19,12 8,19" />
            </svg>
          </motion.div>
          <p className="text-white/80 text-sm font-light tracking-wider">
            Tap to feel {idolName}&rsquo;s heartbeat
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default EmotionNFT;
