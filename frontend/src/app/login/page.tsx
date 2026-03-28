"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Loader2, CheckCircle, AlertCircle, Shield, Star, Crown, Users } from "lucide-react";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { getNonce, verifySiwe } from "@/lib/api";
import { Suspense } from "react";

const IDOL_ADDRESS = "0xcdD5a068B11F9c653F98363fa2739e7f1255b791";
const FAN_ADDRESS  = "0xB7Ae643E0977eB8baB4b837707c6528B303C7104";

type LoginStep = "idle" | "connecting" | "signing" | "verifying" | "done" | "error";

const STEP_META: Record<LoginStep, { label: string; sub: string }> = {
  idle:       { label: "",           sub: "" },
  connecting: { label: "Connecting wallet…", sub: "Confirm in MetaMask" },
  signing:    { label: "Awaiting signature…", sub: "Sign the message in MetaMask" },
  verifying:  { label: "Verifying…", sub: "Backend is checking your signature" },
  done:       { label: "Signed in!", sub: "Redirecting…" },
  error:      { label: "Sign-in failed", sub: "" },
};

const BG_EMOTIONS = [0, 1, 2, 3, 4];
const BG_COLORS: Record<number, string> = {
  0: "rgba(99,102,241,0.18)",
  1: "rgba(148,163,184,0.12)",
  2: "rgba(214,210,210,0.10)",
  3: "rgba(255,215,0,0.18)",
  4: "rgba(244,114,182,0.22)",
};

function LoginContent() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, isAuthenticated, role } = useAuthStore();

  const [step, setStep] = useState<LoginStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [bgEmotion, setBgEmotion] = useState(3);

  // Background mood cycle
  useEffect(() => {
    const t = setInterval(() => setBgEmotion((p) => (p + 1) % 5), 5000);
    return () => clearInterval(t);
  }, []);

  // Redirect if already signed in
  useEffect(() => {
    if (isAuthenticated) {
      const from = searchParams.get("from");
      router.replace(from || (role === "idol" ? "/idol" : "/capsule"));
    }
  }, [isAuthenticated, role, router, searchParams]);

  // Role hint from connected address
  const detectedRole = useMemo(() => {
    if (!address) return null;
    if (address.toLowerCase() === IDOL_ADDRESS.toLowerCase()) return "idol";
    if (address.toLowerCase() === FAN_ADDRESS.toLowerCase())  return "fan";
    return "fan";
  }, [address]);

  const handleLogin = async () => {
    setErrorMsg("");
    try {
      if (!isConnected || !address) {
        setStep("connecting");
        const connector = connectors.find((c) => c.id === "injected") ?? connectors[0];
        await connect({ connector });
        return;
      }
      await doSiwe(address);
    } catch (err: any) {
      setStep("error");
      setErrorMsg(err?.message || "Unknown error");
    }
  };

  useEffect(() => {
    if (step === "connecting" && isConnected && address) {
      doSiwe(address).catch((err) => {
        setStep("error");
        setErrorMsg(err?.message || "Unknown error");
      });
    }
  }, [isConnected, address, step]);

  const doSiwe = async (addr: string) => {
    setStep("signing");
    const { message, nonce } = await getNonce(addr);
    const signature = await signMessageAsync({ message });
    setStep("verifying");
    const result = await verifySiwe({ address: addr, signature, nonce });
    setAuth(result.token, result.address, result.role as "idol" | "fan");
    setStep("done");
    setTimeout(() => {
      const from = searchParams.get("from");
      router.replace(from || (result.role === "idol" ? "/idol" : "/capsule"));
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

      {/* Immersive background */}
      <motion.div
        className="absolute inset-0 z-0"
        animate={{ background: `radial-gradient(ellipse at 60% 40%, ${BG_COLORS[bgEmotion]} 0%, transparent 65%)` }}
        transition={{ duration: 2 }}
      />
      <motion.div
        className="absolute inset-0 z-0"
        animate={{ background: `radial-gradient(ellipse at 30% 70%, ${BG_COLORS[(bgEmotion + 2) % 5]} 0%, transparent 60%)` }}
        transition={{ duration: 2.5 }}
      />

      {/* Decorative bars */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {[...Array(9)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bottom-0 w-1 rounded-full opacity-10"
            style={{
              left: `${8 + i * 10}%`,
              background: `hsl(${bgEmotion * 60 + i * 20}, 70%, 65%)`,
            }}
            animate={{ height: [`${20 + i * 8}px`, `${60 + i * 14}px`, `${20 + i * 8}px`] }}
            transition={{ duration: 1.5 + i * 0.25, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          />
        ))}
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        <div
          className="rounded-3xl border border-white/10 p-8 space-y-7"
          style={{
            background: "rgba(8,8,12,0.72)",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 36px 72px rgba(0,0,0,0.55)",
          }}
        >
          {/* Logo */}
          <div className="text-center space-y-3">
            <motion.div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)" }}
              animate={{ rotate: [0, 4, -4, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Star className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-white">Idol Capsule</h1>
              <p className="text-white/35 text-sm mt-0.5">Idol Capsule · Private Space</p>
            </div>
          </div>

          {/* Role hint */}
          <AnimatePresence mode="wait">
            {address && step === "idle" ? (
              <motion.div
                key="role-hint"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  detectedRole === "idol"
                    ? "bg-yellow-500/8 border-yellow-500/25"
                    : "bg-purple-500/8 border-purple-500/25"
                }`}
              >
                {detectedRole === "idol"
                  ? <Crown className="w-4 h-4 text-yellow-400 shrink-0" />
                  : <Users className="w-4 h-4 text-purple-400 shrink-0" />
                }
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${detectedRole === "idol" ? "text-yellow-400" : "text-purple-400"}`}>
                    {detectedRole === "idol" ? "Idol" : "Fan"} account detected
                  </p>
                  <p className="text-white/35 text-xs font-mono truncate">{address}</p>
                </div>
              </motion.div>
            ) : !address && step === "idle" ? (
              <motion.div
                key="no-wallet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-white/5 border border-white/10"
              >
                <Shield className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-white/45 text-xs leading-relaxed">
                  We detect
                  <span className="text-yellow-400"> idol / fan </span>
                  from your wallet — no separate signup.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Main */}
          <AnimatePresence mode="wait">
            {step === "idle" ? (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <button
                  onClick={handleLogin}
                  className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-900/30"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)" }}
                >
                  <Wallet className="w-5 h-5" />
                  {isConnected ? "Continue sign-in" : "Connect wallet & sign in"}
                </button>

                {/* Demo accounts */}
                <div className="space-y-1.5">
                  <p className="text-white/18 text-xs text-center tracking-wide">Configured demo</p>
                  <div className="flex gap-2">
                    <div className="flex-1 p-2 rounded-xl bg-yellow-500/5 border border-yellow-500/18 text-center">
                      <Crown className="w-3 h-3 text-yellow-500/60 mx-auto mb-1" />
                      <p className="text-yellow-400 text-xs font-bold">Idol</p>
                      <p className="text-white/25 text-xs font-mono">0xcdD5…b791</p>
                    </div>
                    <div className="flex-1 p-2 rounded-xl bg-purple-500/5 border border-purple-500/18 text-center">
                      <Users className="w-3 h-3 text-purple-500/60 mx-auto mb-1" />
                      <p className="text-purple-400 text-xs font-bold">Fan</p>
                      <p className="text-white/25 text-xs font-mono">0xB7Ae…7104</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                {/* Step indicator */}
                <div className="flex items-center gap-2">
                  {(["connecting", "signing", "verifying", "done"] as LoginStep[]).map((s, i) => {
                    const STEPS: LoginStep[] = ["connecting", "signing", "verifying", "done"];
                    const curIdx = STEPS.indexOf(step === "error" ? "connecting" : step);
                    const isDone   = curIdx > i || step === "done";
                    const isActive = STEPS[i] === step;
                    return (
                      <React.Fragment key={s}>
                        <motion.div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isDone   ? "bg-green-500 text-white" :
                            isActive ? "bg-purple-500 text-white" :
                            "bg-white/10 text-white/25"
                          }`}
                          animate={isActive && step !== "done" ? { scale: [1, 1.12, 1] } : {}}
                          transition={{ duration: 0.9, repeat: Infinity }}
                        >
                          {isDone ? "✓" : i + 1}
                        </motion.div>
                        {i < 3 && <div className={`flex-1 h-px ${isDone ? "bg-green-500/50" : "bg-white/8"}`} />}
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="text-center">
                  {step === "done" ? (
                    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-2">
                      <CheckCircle className="w-10 h-10 text-green-400" />
                      <p className="text-green-400 font-bold text-lg">You’re in!</p>
                      <p className="text-white/35 text-xs">Opening {detectedRole === "idol" ? "idol admin" : "capsule"}…</p>
                    </motion.div>
                  ) : step === "error" ? (
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-red-400" />
                      <p className="text-red-400 font-bold">Sign-in failed</p>
                      <p className="text-white/35 text-xs max-w-[220px]">{errorMsg}</p>
                      <button onClick={() => { setStep("idle"); setErrorMsg(""); }} className="mt-2 text-purple-400 text-sm hover:text-purple-300 transition">
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
                      <p className="text-white font-medium text-sm">{STEP_META[step].label}</p>
                      <p className="text-white/35 text-xs">{STEP_META[step].sub}</p>
                    </div>
                  )}
                </div>

                {address && step !== "done" && step !== "error" && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/8 text-center">
                    <p className="text-white/30 text-xs mb-0.5">Current address</p>
                    <p className="text-white/60 text-xs font-mono truncate">{address}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Back home */}
        <p className="text-center text-white/20 text-xs mt-5">
          <a href="/" className="hover:text-white/40 transition">← Back to home</a>
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
