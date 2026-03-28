"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Send, Loader2, CheckCircle, AlertCircle, Music, BarChart2, Users, Sparkles, ShieldAlert, ChevronRight, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAccount, useSignTypedData, useReadContract, useChainId } from "wagmi";
import IdolEmotionNFT from "@/components/IdolEmotionNFT";
import EmotionSlider from "@/components/EmotionSlider";
import { useAuthStore } from "@/lib/authStore";
import { useIdolCurrentState } from "@/lib/useIdolCurrentState";
import { uploadPhoto, submitEmotionUpdate, getTaskStatus, getComfortCount, getSuperComforts } from "@/lib/api";
import EchoWallModal from "@/components/EchoWallModal";
import { CAPSULE_NFT_ADDRESS, CAPSULE_NFT_ABI } from "@/lib/contracts";

type Step = "idle" | "signing" | "uploading" | "submitting" | "polling" | "success" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle:       "",
  signing:    "① Requesting MetaMask signature…",
  uploading:  "② Syncing with IPFS…",
  submitting: "③ Submitting to backend…",
  polling:    "⏳ Waiting for on-chain confirmation…",
  success:    "✅ Mood update is on-chain!",
  error:      "❌ Something went wrong",
};

/** Matches CapsuleNFT.COOLDOWN (10 minutes) */
const EMOTION_COOLDOWN_SEC = 600;

export default function IdolPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const { role, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [meteorActive, setMeteorActive] = useState(false);
  const [emotionId, setEmotionId] = useState(3);
  const [moodText, setMoodText] = useState("");
  const [musicId, setMusicId] = useState(0);
  const [photoCid, setPhotoCid] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [taskId, setTaskId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState("");
  const [comfortCount, setComfortCount] = useState<number | null>(null);
  const [superComforts, setSuperComforts] = useState<Array<{
    id: number; wallet_address: string; message: string; amount: string; tx_hash: string; block_number: number; created_at: string;
  }>>([]);
  const [superTotal, setSuperTotal] = useState(0);
  const [showEchoModal, setShowEchoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  const { data: totalSupply } = useReadContract({
    address: CAPSULE_NFT_ADDRESS,
    abi: CAPSULE_NFT_ABI,
    functionName: "totalSupply",
  });

  const { data: idolAddress } = useReadContract({
    address: CAPSULE_NFT_ADDRESS,
    abi: CAPSULE_NFT_ABI,
    functionName: "idol",
  });

  const { data: idolNonce } = useReadContract({
    address: CAPSULE_NFT_ADDRESS,
    abi: CAPSULE_NFT_ABI,
    functionName: "nonces",
    args: idolAddress ? [idolAddress] : undefined,
    query: { enabled: Boolean(idolAddress) },
  });

  const { data: globalState } = useReadContract({
    address: CAPSULE_NFT_ADDRESS,
    abi: CAPSULE_NFT_ABI,
    functionName: "getGlobalState",
    query: { refetchInterval: 15_000 },
  });

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const lastUpdatedSec =
    globalState != null && globalState[3] !== undefined
      ? Number(globalState[3])
      : null;
  const emotionCooldownLeftSec =
    lastUpdatedSec === null
      ? 0
      : Math.max(0, lastUpdatedSec + EMOTION_COOLDOWN_SEC - nowSec);

  // Route guard: idols only
  useEffect(() => {
    if (isAuthenticated && role !== "idol") {
      router.replace("/");
    }
  }, [isAuthenticated, role, router]);

  // Live idol state for NFT preview
  const idolState = useIdolCurrentState();

  // Seed editor from chain once
  const initializedRef = React.useRef(false);
  useEffect(() => {
    if (!initializedRef.current && idolState.photoCid) {
      setEmotionId(idolState.emotionId);
      setPhotoCid(idolState.photoCid);
      initializedRef.current = true;
    }
  }, [idolState.emotionId, idolState.photoCid]);

  const fetchEchoWall = () => {
    getSuperComforts({ page: 1, limit: 3, sort: "time" })
      .then(r => { setSuperComforts(r.data || []); setSuperTotal(r.total ?? 0); })
      .catch(() => {});
  };

  useEffect(() => {
    getComfortCount().then(r => setComfortCount(r.count)).catch(() => {});
    fetchEchoWall();
    const interval = setInterval(fetchEchoWall, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isAuthenticated && role !== "idol") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <p className="text-white/60 text-lg">Idols only</p>
        <p className="text-white/30 text-sm">Redirecting to home…</p>
      </div>
    );
  }

  const MUSIC_OPTIONS = [
    { id: 0, name: "Soft piano" },
    { id: 1, name: "Upbeat" },
    { id: 2, name: "Melancholy" },
    { id: 3, name: "Rock" },
    { id: 4, name: "Electronic" },
  ];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const result = await uploadPhoto(file);
      setPhotoCid(result.cid);
    } catch (err) {
      console.error("Upload failed:", err);
      setPhotoCid("");
      alert(`Photo upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!address) return;
    if (chainId !== 11155111) {
      alert("Switch to Sepolia before updating your mood.");
      return;
    }
    if (idolAddress && address.toLowerCase() !== String(idolAddress).toLowerCase()) {
      alert(`Connected address is not the idol (expected ${idolAddress}). Switch accounts in your wallet.`);
      return;
    }
    if (idolNonce === undefined) {
      alert("Reading contract nonce — try again in a moment.");
      return;
    }
    if (emotionCooldownLeftSec > 0) {
      const m = Math.floor(emotionCooldownLeftSec / 60);
      const s = emotionCooldownLeftSec % 60;
      alert(
        `10-minute on-chain cooldown not finished (Cooldown not elapsed). Wait ~${m}m ${s}s, or demo a single update.`
      );
      return;
    }

    setStep("signing");
    setTxHash("");

    try {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Step 1: EIP-712 sign
      const signature = await signTypedDataAsync({
        domain: {
          name: "IdolCapsule",
          version: "1",
          chainId: 11155111,
          verifyingContract: CAPSULE_NFT_ADDRESS,
        },
        types: {
          EmotionUpdate: [
            { name: "emotionId", type: "uint8" },
            { name: "photoCid", type: "string" },
            { name: "musicId", type: "uint8" },
            { name: "moodText", type: "string" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "EmotionUpdate",
        message: {
          emotionId: emotionId,
          photoCid: photoCid,
          musicId: musicId,
          moodText: moodText,
          nonce: BigInt(idolNonce),
          deadline: BigInt(deadline),
        },
      });

      // Step 2: placeholder (photo already uploaded on pick)
      setStep("uploading");
      await new Promise(r => setTimeout(r, 400));

      // Step 3: submit relayer task
      setStep("submitting");
      const result = await submitEmotionUpdate({
        emotion_id: emotionId,
        photo_cid: photoCid,
        music_id: musicId,
        mood_text: moodText,
        signature: signature,
        deadline: deadline,
      });

      setTaskId(result.task_id);
      setStep("polling");

      // Poll task
      const poll = setInterval(async () => {
        try {
          const status = await getTaskStatus(result.task_id);
          if (status.status === "success") {
            setTxHash(status.tx_hash || "");
            setStep("success");
            clearInterval(poll);
          } else if (status.status === "failed") {
            setStep("error");
            if (status.error) alert(`On-chain failed: ${status.error}`);
            clearInterval(poll);
          }
        } catch {
          clearInterval(poll);
          setStep("error");
        }
      }, 3000);
    } catch (err) {
      console.error("Submit failed:", err);
      setStep("error");
      alert(`Mood update failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Idol admin
            </span>
          </h1>
          <p className="text-white/50">Update your mood so fans feel it in real time</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10 max-w-2xl mx-auto">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
            <BarChart2 className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white font-mono">
              {totalSupply !== undefined ? totalSupply.toString() : "—"}
            </p>
            <p className="text-white/40 text-xs mt-1">Minted</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
            <Users className="w-5 h-5 text-pink-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white font-mono">
              {comfortCount !== null ? comfortCount : "—"}
            </p>
            <p className="text-white/40 text-xs mt-1">Comforts</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
            <div className="w-5 h-5 mx-auto mb-1 flex items-center justify-center">
              <span className="text-lg">{["😢","😴","😐","😊","🤩"][emotionId]}</span>
            </div>
            <p className="text-lg font-bold font-mono" style={{ color: ["#6366f1","#94a3b8","#D6D2D2","#FFD700","#f472b6"][emotionId] }}>
              {["Despair","Tired","Calm","On duty","Excited"][emotionId]}
            </p>
            <p className="text-white/40 text-xs mt-1">Current mood</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-12 justify-center">
          {/* Live preview */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm mx-auto lg:mx-0 sticky top-24"
          >
            <h3 className="text-sm text-white/40 mb-3 text-center">Live preview</h3>
            <IdolEmotionNFT
              emotionId={emotionId}
              photoCid={photoCid}
              previewUrl={photoPreview || undefined}
              idolName="StarIdol"
            />
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-md space-y-6"
          >
            {/* Mood */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <EmotionSlider value={emotionId} onChange={setEmotionId} />
            </div>

            {/* Photo */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <label className="text-white/60 text-sm">Upload a photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-8 border-2 border-dashed border-white/20 rounded-xl hover:border-white/40 transition flex flex-col items-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
                ) : photoPreview ? (
                  <img src={photoPreview} alt="preview" className="w-24 h-24 object-cover rounded-lg" />
                ) : (
                  <Upload className="w-8 h-8 text-white/40" />
                )}
                <span className="text-white/40 text-sm">
                  {uploading ? "Uploading…" : photoCid ? "On IPFS" : "Tap to upload"}
                </span>
              </button>
              {photoCid && (
                <p className="text-green-400/60 text-xs font-mono truncate">CID: {photoCid}</p>
              )}
            </div>

            {/* Track */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <label className="text-white/60 text-sm flex items-center gap-2">
                <Music className="w-4 h-4" />
                Soundtrack
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MUSIC_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMusicId(m.id)}
                    className={`py-2 px-3 rounded-lg text-sm transition ${
                      musicId === m.id
                        ? "bg-yellow-500/20 border border-yellow-500/40 text-yellow-400"
                        : "bg-white/5 border border-white/10 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood note */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <label className="text-white/60 text-sm">Mood note</label>
              <textarea
                value={moodText}
                onChange={(e) => setMoodText(e.target.value)}
                placeholder="What are you feeling right now?"
                maxLength={200}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-white/30"
              />
              <p className="text-white/20 text-xs text-right">{moodText.length}/200</p>
            </div>

            {emotionCooldownLeftSec > 0 && (
              <p className="text-amber-400/90 text-xs text-center flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                On-chain cooldown: ~{Math.floor(emotionCooldownLeftSec / 60)}m {emotionCooldownLeftSec % 60}s until next update
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={
                (step !== "idle" && step !== "success" && step !== "error") ||
                !address ||
                emotionCooldownLeftSec > 0
              }
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              Sign & update on-chain
            </button>

            {!address && (
              <p className="text-white/30 text-xs text-center">Connect your wallet first</p>
            )}

            {/* Meteor shower (visual) */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/30 to-pink-900/20 border border-purple-500/20 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Global meteor shower</h3>
              </div>
              <p className="text-white/40 text-xs leading-relaxed">
                Trigger a full-screen meteor effect for fans’ NFTs (client-side animation; may accompany on-chain updates in demos).
              </p>
              <button
                onClick={() => {
                  setMeteorActive(true);
                  setTimeout(() => setMeteorActive(false), 6000);
                }}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                Start meteor shower
              </button>
            </div>

            {/* Echo wall preview */}
            <div className="p-5 rounded-2xl border space-y-3"
              style={{ background: "rgba(167,139,250,0.04)", borderColor: "rgba(167,139,250,0.15)" }}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💌</span>
                  <h3 className="text-sm font-bold text-white">Echo wall</h3>
                </div>
                <span className="text-white/25 text-[10px] font-mono">{superTotal} on-chain</span>
              </div>

              {/* Latest two */}
              {superComforts.length === 0 ? (
                <p className="text-white/20 text-xs text-center py-3">No super-comfort messages yet</p>
              ) : (
                <div className="space-y-2">
                  {superComforts.slice(0, 2).map((sc) => {
                    const colors = ["#f472b6","#a78bfa","#60a5fa","#34d399","#fbbf24","#fb7185","#818cf8"];
                    const ci = parseInt(sc.wallet_address.slice(2,4),16) % colors.length;
                    const ci2 = parseInt(sc.wallet_address.slice(4,6),16) % colors.length;
                    const letter = sc.wallet_address.slice(2,3).toUpperCase();
                    const ethAmt = Number(sc.amount) > 0 ? `${(Number(sc.amount)/1e18).toFixed(4)} ETH` : "0.0001 ETH";
                    const d = new Date(sc.created_at);
                    const timeStr = !isNaN(d.getTime()) && d.getFullYear() > 2000
                      ? (() => {
                          const diff = Date.now() - d.getTime();
                          const min = Math.floor(diff/60000);
                          if (min < 1) return "Just now";
                          if (min < 60) return `${min}m ago`;
                          const hr = Math.floor(diff/3600000);
                          if (hr < 24) return `${hr}h ago`;
                          return `${Math.floor(diff/86400000)}d ago`;
                        })()
                      : "Unknown time";
                    return (
                      <motion.div
                        key={sc.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(167,139,250,0.10)" }}
                      >
                        {/* Identicon */}
                        <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${colors[ci]}, ${colors[ci2]})` }}>
                          {letter}
                        </div>
                        {/* Body */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-purple-400/70 text-[10px] font-mono">
                              {sc.wallet_address.slice(0,6)}...{sc.wallet_address.slice(-4)}
                            </span>
                            <span className="text-white/20 text-[10px] flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />{timeStr}
                            </span>
                          </div>
                          <p className="text-white/65 text-xs truncate">
                            {sc.message.length > 22 ? sc.message.slice(0, 22) + "..." : sc.message}
                          </p>
                        </div>
                        {/* Amount */}
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                          {ethAmt}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* View all */}
              <motion.button
                onClick={() => setShowEchoModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: "rgba(167,139,250,0.12)", color: "rgba(196,181,253,0.9)", border: "1px solid rgba(167,139,250,0.2)" }}
                whileHover={{ backgroundColor: "rgba(167,139,250,0.2)" }}
                animate={{ opacity: [0.85, 1, 0.85] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <span>✨ View all echoes</span>
                <span className="text-purple-400/60 text-xs">({superTotal} total)</span>
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Echo modal */}
            <AnimatePresence>
              {showEchoModal && (
                <EchoWallModal onClose={() => setShowEchoModal(false)} />
              )}
            </AnimatePresence>

            {/* Progress */}
            <AnimatePresence>
              {step !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-5 rounded-2xl bg-black/60 border border-white/10 backdrop-blur space-y-4"
                >
                  {/* Steps */}
                  <div className="flex items-center gap-2">
                    {(["signing", "uploading", "submitting", "polling"] as Step[]).map((s, i) => {
                      const steps = ["signing", "uploading", "submitting", "polling"] as Step[];
                      const done = step === "success" || steps.indexOf(step) > i;
                      const active = steps.indexOf(step) === i;
                      return (
                        <React.Fragment key={s}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            done ? "bg-green-500 text-white" :
                            active ? "bg-yellow-500 text-black animate-pulse" :
                            "bg-white/10 text-white/30"
                          }`}>
                            {done ? "✓" : i + 1}
                          </div>
                          {i < 3 && <div className={`flex-1 h-px transition-all ${done ? "bg-green-500/60" : "bg-white/10"}`} />}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-3">
                    {step === "success" ? (
                      <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                    ) : step === "error" ? (
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-yellow-400 animate-spin shrink-0" />
                    )}
                    <span className={`text-sm ${step === "success" ? "text-green-400" : step === "error" ? "text-red-400" : "text-white/70"}`}>
                      {STEP_LABELS[step]}
                    </span>
                  </div>

                  {/* Task / tx */}
                  {taskId && (
                    <p className="text-white/30 text-xs font-mono">Task #{taskId}</p>
                  )}
                  {txHash && (
                    <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 text-xs font-mono hover:underline block truncate">
                      Tx: {txHash.slice(0, 20)}...
                    </a>
                  )}

                  {(step === "success" || step === "error") && (
                    <button onClick={() => { setStep("idle"); setTaskId(null); setTxHash(""); }}
                      className="text-white/40 text-xs hover:text-white/70 transition">
                      Dismiss
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Meteor overlay */}
      <AnimatePresence>
        {meteorActive && (
          <motion.div
            className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 rounded-full bg-gradient-to-b from-white to-transparent"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-${Math.random() * 20}%`,
                  height: `${30 + Math.random() * 60}px`,
                  opacity: 0.5 + Math.random() * 0.5,
                }}
                initial={{ y: -100, opacity: 0 }}
                animate={{
                  y: ["0vh", "120vh"],
                  opacity: [0, 0.8, 0],
                }}
                transition={{
                  duration: 1.2 + Math.random() * 1.5,
                  delay: Math.random() * 3,
                  ease: "linear",
                }}
              />
            ))}
            {/* Center burst */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 2] }}
              transition={{ duration: 2, delay: 0.5 }}
            >
              <div className="text-6xl">✨🌟✨</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
