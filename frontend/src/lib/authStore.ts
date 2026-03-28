"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthRole = "idol" | "fan" | null;

interface AuthState {
  token: string | null;
  address: string | null;
  role: AuthRole;
  isAuthenticated: boolean;

  // Wallet-switch dialog
  pendingAddress: string | null;
  showSwitchDialog: boolean;

  setAuth: (token: string, address: string, role: AuthRole) => void;
  clearAuth: () => void;
  setPendingSwitch: (address: string) => void;
  confirmSwitch: () => void;
  cancelSwitch: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      address: null,
      role: null,
      isAuthenticated: false,
      pendingAddress: null,
      showSwitchDialog: false,

      setAuth: (token, address, role) => {
        // Mirror token to cookie for middleware (7d)
        if (typeof document !== "undefined") {
          document.cookie = `idol-capsule-token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        set({ token, address, role, isAuthenticated: true, pendingAddress: null, showSwitchDialog: false });
      },

      clearAuth: () => {
        if (typeof document !== "undefined") {
          document.cookie = "idol-capsule-token=; path=/; max-age=0";
        }
        set({ token: null, address: null, role: null, isAuthenticated: false });
      },

      setPendingSwitch: (address) => {
        const current = get().address;
        if (current && current.toLowerCase() !== address.toLowerCase()) {
          set({ pendingAddress: address, showSwitchDialog: true });
        }
      },

      confirmSwitch: () =>
        set({ token: null, address: null, role: null, isAuthenticated: false, showSwitchDialog: false, pendingAddress: null }),

      cancelSwitch: () =>
        set({ showSwitchDialog: false, pendingAddress: null }),
    }),
    {
      name: "idol-capsule-auth",
      partialize: (state) => ({
        token: state.token,
        address: state.address,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
