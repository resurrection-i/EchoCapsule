"use client";

import { create } from "zustand";
import { getMyComfortCount } from "./api";

interface FanState {
  myComfortCount: number;
  todayUsedFree: boolean;
  loading: boolean;

  fetchMyCount: (address: string) => Promise<void>;
  incrementCount: () => void;
  setTodayUsedFree: (used: boolean) => void;
}

export const useFanStore = create<FanState>()((set, get) => ({
  myComfortCount: 0,
  todayUsedFree: false,
  loading: false,

  fetchMyCount: async (address: string) => {
    set({ loading: true });
    try {
      const res = await getMyComfortCount(address.toLowerCase());
      set({ myComfortCount: res.count });
    } catch {
      // backend not running — keep 0
    } finally {
      set({ loading: false });
    }
  },

  incrementCount: () => set((s) => ({ myComfortCount: s.myComfortCount + 1 })),

  setTodayUsedFree: (used) => set({ todayUsedFree: used }),
}));
