"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Gem, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CAPSULE_NFT_ADDRESS, CAPSULE_NFT_ABI } from "@/lib/contracts";
import IdolEmotionNFT from "@/components/IdolEmotionNFT";
import { useIdolCurrentState } from "@/lib/useIdolCurrentState";

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const idolState = useIdolCurrentState();
  const [mintCount, setMintCount] = useState(1);

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint = () => {
    writeContract({
      address: CAPSULE_NFT_ADDRESS,
      abi: CAPSULE_NFT_ABI,
      functionName: "mint",
      value: parseEther("0.001"),
    });
  };

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent">
              Mint your emotion capsule
            </span>
          </h1>
          <p className="text-white/50 max-w-md mx-auto">
            Each capsule is unique — it updates live with the idol’s mood.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row items-center gap-12 justify-center">
          {/* NFT preview */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm"
          >
            <IdolEmotionNFT
              emotionId={idolState.emotionId}
              photoCid={idolState.photoCid}
              idolName="StarIdol"
            />
          </motion.div>

          {/* Mint panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-md"
          >
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Idol Capsule NFT</h2>
                <p className="text-white/40 text-sm">ERC-721 | Sepolia Testnet</p>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Mint price</span>
                  <span className="text-white font-mono">0.001 ETH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Max supply</span>
                  <span className="text-white font-mono">1,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Network</span>
                  <span className="text-white font-mono">Sepolia</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Standard</span>
                  <span className="text-white font-mono">ERC-721</span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/50">Total</span>
                  <span className="text-white font-bold">0.001 ETH</span>
                </div>
              </div>

              {/* Mint */}
              {!isConnected ? (
                <div className="text-center py-4 text-white/40 text-sm">
                  Connect your wallet first
                </div>
              ) : isSuccess ? (
                <div className="flex items-center justify-center gap-2 py-4 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span>Mint successful!</span>
                </div>
              ) : (
                <button
                  onClick={handleMint}
                  disabled={isPending || isConfirming}
                  className="w-full py-4 bg-gradient-to-r from-yellow-500 to-pink-500 text-black font-bold rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending || isConfirming ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isPending ? "Confirm in wallet…" : "Confirming…"}
                    </>
                  ) : (
                    <>
                      <Gem className="w-5 h-5" />
                      Mint Capsule NFT
                    </>
                  )}
                </button>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error.message.slice(0, 100)}</span>
                </div>
              )}

              {hash && (
                <div className="text-center">
                  <a
                    href={`https://sepolia.etherscan.io/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs hover:underline font-mono"
                  >
                    View tx: {hash.slice(0, 10)}...{hash.slice(-8)}
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
