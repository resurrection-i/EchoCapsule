"use client";

import React from "react";
import { motion } from "framer-motion";

const EMOTIONS = [
  { id: 0, label: "Despair", emoji: "😢", color: "#1A1A2E" },
  { id: 1, label: "Tired", emoji: "😴", color: "#4A4E69" },
  { id: 2, label: "Calm", emoji: "😐", color: "#D6D2D2" },
  { id: 3, label: "On duty", emoji: "😊", color: "#FFD700" },
  { id: 4, label: "Excited", emoji: "🤩", color: "#FFB7B2" },
];

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export const EmotionSlider: React.FC<Props> = ({ value, onChange }) => {
  const current = EMOTIONS[value];

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-white/60 text-sm">Mood</span>
        <motion.span
          key={value}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-lg font-bold"
          style={{ color: current.color }}
        >
          {current.emoji} {current.label}
        </motion.span>
      </div>

      {/* Mood slider */}
      <div className="relative">
        <input
          type="range"
          min="0"
          max="4"
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #1A1A2E, #4A4E69, #D6D2D2, #FFD700, #FFB7B2)`,
          }}
        />
        {/* Tick marks */}
        <div className="flex justify-between mt-2 px-1">
          {EMOTIONS.map((e) => (
            <button
              key={e.id}
              onClick={() => onChange(e.id)}
              className={`text-xs transition-all duration-300 ${
                value === e.id ? "opacity-100 scale-110" : "opacity-40"
              }`}
              style={{ color: e.color }}
            >
              {e.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmotionSlider;
