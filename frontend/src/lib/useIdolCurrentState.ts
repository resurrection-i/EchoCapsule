"use client";

import { useState, useEffect } from "react";
import { getLatestEmotion } from "./api";

interface IdolState {
  emotionId: number;
  photoCid: string;
  musicId: number;
  moodText: string;
  loading: boolean;
}

/**
 * useIdolCurrentState
 * Single source of truth for the idol's current NFT display data.
 * Fetches from the Go backend and refreshes every 15 seconds.
 */
export function useIdolCurrentState(): IdolState {
  const [state, setState] = useState<IdolState>({
    emotionId: 3,
    photoCid: "",
    musicId: 0,
    moodText: "",
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      try {
        const r = await getLatestEmotion();
        if (!cancelled) {
          setState({
            emotionId: r.emotion_id,
            photoCid: r.photo_cid,
            musicId: r.music_id,
            moodText: r.mood_text,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      }
    };

    fetch();
    const interval = setInterval(fetch, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return state;
}
