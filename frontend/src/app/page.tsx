"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, Gem, Heart, History, Lock, ChevronRight, Zap, Shield,
  BarChart2, Users, Calendar, Crown, CheckCircle, XCircle,
} from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";
import IdolEmotionNFT from "@/components/IdolEmotionNFT";
import { useAuthStore } from "@/lib/authStore";
import { useFanStore } from "@/lib/fanStore";
import { useIdolCurrentState } from "@/lib/useIdolCurrentState";
import { CAPSULE_NFT_ADDRESS, CAPSULE_NFT_ABI } from "@/lib/contracts";
import {
  getComfortHeatmap,
  getEmotionRadar,
  getComfortCount,
} from "@/lib/api";

/* Constants */
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: (i * 17 + 7) % 100,
  top: (i * 13 + 11) % 100,
  dur: 3 + (i % 5),
  delay: (i * 0.4) % 3,
}));

const EMOTION_LABELS = ["Despair", "Tired", "Calm", "On duty", "Excited"];

/* GitHub-style comfort heatmap */
function HeatmapCalendar({ data }: { data: Array<{ date: string; count: number }> }) {
  const today = new Date();
  const dayMap = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((d) => m.set(d.date, d.count));
    return m;
  }, [data]);

  // ~20 weeks of cells
  const weeks = useMemo(() => {
    const result: Array<Array<{ date: string; count: number }>> = [];
    const start = new Date(today);
    start.setDate(start.getDate() - 139);
    // Align to Sunday
    start.setDate(start.getDate() - start.getDay());

    // Use local date (not UTC) so keys match MySQL DATE_FORMAT('%Y-%m-%d')
    const toLocalDate = (dt: Date) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    let week: Array<{ date: string; count: number }> = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const ds = toLocalDate(d);
      week.push({ date: ds, count: dayMap.get(ds) || 0 });
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
    }
    if (week.length) result.push(week);
    return result;
  }, [dayMap]);

  const getColor = (count: number) => {
    if (count === 0) return "bg-white/5";
    if (count <= 2) return "bg-pink-900/60";
    if (count <= 5) return "bg-pink-700/70";
    if (count <= 10) return "bg-pink-500/80";
    return "bg-pink-400";
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px] min-w-max">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {w.map((d) => (
              <div
                key={d.date}
                className={`w-3 h-3 rounded-[2px] ${getColor(d.count)} transition-colors`}
                title={`${d.date}: ${d.count} comforts`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-white/30 text-[10px]">
        <span>Less</span>
        {["bg-white/5", "bg-pink-900/60", "bg-pink-700/70", "bg-pink-500/80", "bg-pink-400"].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-[2px] ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

/* Home */
export default function HomePage() {
  const { address } = useAccount();
  const { isAuthenticated, role, address: authAddress } = useAuthStore();
  const isIdol = role === "idol";
  const isFan = isAuthenticated && role === "fan";

  // NFT preview: carousel when logged out, live when signed in
  const [emotionId, setEmotionId] = useState(3);
  useEffect(() => {
    if (!isAuthenticated) {
      const timer = setInterval(() => setEmotionId((p) => (p + 1) % 5), 4000);
      return () => clearInterval(timer);
    }
  }, [isAuthenticated]);

  // Live idol state (when authenticated)
  const idolState = useIdolCurrentState();
  // Fan comfort count (persisted)
  const { myComfortCount, fetchMyCount } = useFanStore();

  const [comfortTotal, setComfortTotal] = useState(0);
  const [heatmapData, setHeatmapData] = useState<Array<{ date: string; count: number }>>([]);
  const [radarData, setRadarData] = useState<Array<{ emotion_id: number; count: number }>>([]);

  // Contract reads
  const { data: balanceData } = useReadContract({
    address: CAPSULE_NFT_ADDRESS,
    abi: CAPSULE_NFT_ABI,
    functionName: "balanceOf",
    args: authAddress ? [authAddress as `0x${string}`] : undefined,
    query: { enabled: !!authAddress },
  });

  const { data: totalSupplyData } = useReadContract({
    address: CAPSULE_NFT_ADDRESS,
    abi: CAPSULE_NFT_ABI,
    functionName: "totalSupply",
    query: { enabled: isIdol },
  });

  const hasMinted = balanceData ? Number(balanceData) > 0 : false;
  const totalSupply = totalSupplyData ? Number(totalSupplyData) : 0;

  // Sync real emotion id from hook into local state for landing NFT preview
  useEffect(() => {
    if (isAuthenticated) setEmotionId(idolState.emotionId);
  }, [isAuthenticated, idolState.emotionId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const addr = (authAddress || address || "").toLowerCase();
    if (!addr) return; // wait for address to hydrate

    getComfortCount().then((r) => setComfortTotal(r.count)).catch(() => {});

    if (isFan) {
      fetchMyCount(addr);
      getComfortHeatmap(addr)
        .then((r) => {
          setHeatmapData(r.data || []);
        })
        .catch(() => {});
    }

    if (isIdol) {
      getEmotionRadar().then((r) => setRadarData(r.data || [])).catch(() => {});
    }
  }, [isAuthenticated, role, authAddress, address]);

  // Radar chart
  const radarChartData = useMemo(
    () => radarData.map((d) => ({ emotion: EMOTION_LABELS[d.emotion_id] || "?", count: d.count })),
    [radarData]
  );

  /* Logged-out landing */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <section className="relative flex flex-col items-center justify-center min-h-screen px-4 overflow-hidden">
          <div className="absolute inset-0 z-0 pointer-events-none">
            {PARTICLES.map((p) => (
              <motion.div
                key={p.id}
                className="absolute w-1 h-1 bg-white/20 rounded-full"
                style={{ left: `${p.left}%`, top: `${p.top}%` }}
                animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: p.dur, repeat: Infinity, delay: p.delay }}
              />
            ))}
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-pink-600/8 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-16 max-w-6xl mx-auto w-full">
            <div className="flex-1 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-xs font-medium mb-6"
              >
                <Zap className="w-3 h-3" />
                On-chain dynamic NFT · graduation project
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="text-5xl lg:text-7xl font-bold mb-6 leading-tight"
              >
                <span className="bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">Idol mood</span>
                <br />
                <span className="text-white">capsule NFT</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.25 }}
                className="text-white/55 text-lg mb-10 max-w-lg leading-relaxed"
              >
                A <span className="text-white/90 font-medium">living NFT</span> that mirrors the idol’s mood in real time.
                Fully on-chain SVG — every feeling is etched permanently.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="flex flex-wrap gap-4 justify-center lg:justify-start"
              >
                <Link href="/login" className="group px-8 py-3.5 bg-gradient-to-r from-yellow-500 to-pink-500 text-black font-bold rounded-full hover:opacity-90 transition flex items-center gap-2 shadow-lg shadow-pink-500/20">
                  <Gem className="w-5 h-5" />
                  Enter your space
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#features" className="px-8 py-3.5 bg-white/8 border border-white/15 text-white font-medium rounded-full hover:bg-white/15 transition flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Learn more
                </a>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 flex items-center gap-2 text-white/30 text-xs justify-center lg:justify-start">
                <Lock className="w-3 h-3" />
                Mint, capsule, admin, and timeline require wallet sign-in
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              className="flex-1 max-w-xs relative"
            >
              <div className="absolute inset-0 z-20 rounded-3xl flex flex-col items-center justify-center" style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.35)" }}>
                <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 3, repeat: Infinity }} className="w-14 h-14 rounded-full border-2 border-white/30 flex items-center justify-center mb-3">
                  <Lock className="w-6 h-6 text-white/60" />
                </motion.div>
                <p className="text-white/60 text-sm font-medium">Sign in to unlock the full experience</p>
                <Link href="/login" className="mt-4 px-5 py-2 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs hover:bg-white/20 transition">Sign in →</Link>
              </div>
              <IdolEmotionNFT emotionId={emotionId} idolName="StarIdol" />
            </motion.div>
          </div>

          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="absolute bottom-10 text-white/20 text-xs flex flex-col items-center gap-1">
            <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/20" />
            scroll
          </motion.div>
        </section>

        {/* Features + CTA */}
        <section id="features" className="py-28 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <p className="text-white/30 text-sm font-medium mb-3 tracking-widest uppercase">Core Features</p>
              <h2 className="text-3xl font-bold"><span className="bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent">Highlights</span></h2>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: <Sparkles className="w-7 h-7 text-yellow-400" />, title: "On-chain dynamic SVG", desc: "Art is generated in the contract; mood updates map straight to pixels.", tag: "Solidity · ERC-721" },
                { icon: <Heart className="w-7 h-7 text-pink-400" />, title: "EIP-712 meta-updates", desc: "The idol signs off-chain; the Go relayer submits on-chain — minimal gas for them.", tag: "Meta-transaction" },
                { icon: <History className="w-7 h-7 text-purple-400" />, title: "IPFS media", desc: "Photos and notes go to IPFS via Pinata — content-addressed and durable.", tag: "Pinata · CID" },
              ].map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }} viewport={{ once: true }} className="group p-8 rounded-2xl bg-white/4 border border-white/8 hover:border-white/18 hover:bg-white/7 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-white/6 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">{f.icon}</div>
                  <h3 className="text-lg font-bold mb-3 text-white">{f.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed mb-4">{f.desc}</p>
                  <span className="text-xs text-white/25 font-mono">{f.tag}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mx-auto text-center p-10 rounded-3xl border border-white/10" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(219,39,119,0.12))" }}>
            <Shield className="w-10 h-10 mx-auto mb-4 text-white/40" />
            <h2 className="text-2xl font-bold text-white mb-3">Ready to step in?</h2>
            <p className="text-white/45 text-sm mb-7">Connect MetaMask — we detect idol vs fan from your address.</p>
            <Link href="/login" className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full hover:opacity-90 transition shadow-lg">
              <Gem className="w-5 h-5" />
              Connect & sign in
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </section>

        <footer className="py-8 px-4 border-t border-white/5 text-center text-white/25 text-xs">
          Idol Capsule NFT · grad project · Solidity + Go + Next.js + IPFS
        </footer>
      </div>
    );
  }

  /* Signed-in dashboard */
  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              {isIdol ? "Idol console" : "My space"}
            </span>
          </h1>
          <p className="text-white/50 text-sm">
            {isIdol ? "Global stats and mood resonance" : "Your NFT and comfort activity"}
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row items-start gap-10">
          {/* Live NFT */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm mx-auto lg:mx-0 shrink-0"
          >
            <IdolEmotionNFT
              emotionId={idolState.emotionId}
              photoCid={idolState.photoCid}
              idolName="StarIdol"
            />
          </motion.div>

          {/* Panels */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex-1 space-y-6 w-full"
          >
            {/* Fan dashboard */}
            {isFan && (
              <>
                {/* Holdings */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Gem className="w-5 h-5 text-purple-400" />
                    Holdings
                  </h3>
                  <div className="flex items-center gap-3">
                    {hasMinted ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-green-400 font-medium text-sm">Idol Capsule NFT minted</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-orange-400" />
                        <span className="text-orange-400 text-sm">Not minted yet</span>
                        <Link href="/mint" className="ml-auto px-4 py-1.5 text-xs bg-purple-600 text-white rounded-full hover:bg-purple-500 transition">
                          Go mint →
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                {/* Comfort stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <Heart className="w-6 h-6 text-pink-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{myComfortCount}</div>
                    <div className="text-white/40 text-xs mt-1">My comforts</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{comfortTotal}</div>
                    <div className="text-white/40 text-xs mt-1">Global comforts</div>
                  </div>
                </div>

                {/* Comfort calendar */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-pink-400" />
                    Comfort calendar
                  </h3>
                  <p className="text-white/30 text-xs mb-4">Each comfort lights a day — streaks run hotter in pink</p>
                  <HeatmapCalendar data={heatmapData} />
                </div>
              </>
            )}

            {/* Idol dashboard */}
            {isIdol && (
              <>
                {/* Overview */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <Gem className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{totalSupply}</div>
                    <div className="text-white/40 text-xs mt-1">Total minted</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <Heart className="w-6 h-6 text-pink-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{comfortTotal}</div>
                    <div className="text-white/40 text-xs mt-1">Global comforts</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <BarChart2 className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{radarData.reduce((s, d) => s + d.count, 0)}</div>
                    <div className="text-white/40 text-xs mt-1">Mood updates</div>
                  </div>
                </div>

                {/* Mood radar */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-purple-400" />
                    Mood resonance
                  </h3>
                  <p className="text-white/30 text-xs mb-4">Which moods drew the most fan comfort?</p>
                  {radarChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarChartData} outerRadius="75%">
                        <PolarGrid stroke="#ffffff15" />
                        <PolarAngleAxis dataKey="emotion" tick={{ fill: "#ffffff80", fontSize: 12 }} />
                        <PolarRadiusAxis tick={{ fill: "#ffffff30", fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: "#1a1a2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: "#fff" }}
                          itemStyle={{ color: "#f472b6" }}
                        />
                        <Radar name="Posts" dataKey="count" stroke="#f472b6" fill="#f472b6" fillOpacity={0.25} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-white/20 text-sm">No data yet</div>
                  )}
                </div>
              </>
            )}

            {/* Shortcuts */}
            <div className="grid grid-cols-2 gap-4">
              <Link href="/capsule" className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-pink-500/30 transition group flex items-center gap-3">
                <Heart className="w-5 h-5 text-pink-400 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-white text-sm font-bold">Capsule</div>
                  <div className="text-white/30 text-xs">Live mood & comfort</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 ml-auto" />
              </Link>
              <Link href="/history" className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition group flex items-center gap-3">
                <History className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-white text-sm font-bold">Timeline</div>
                  <div className="text-white/30 text-xs">Browse mood history</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 ml-auto" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
