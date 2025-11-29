"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { giftTokenConfig } from "@/lib/contracts";
import { useToast } from "@/components/providers/toast-provider";

export function DepositPanel() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const toast = useToast();

  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      writeContract({
        ...giftTokenConfig,
        functionName: "deposit",
        value: parseEther(amount),
      });
    } catch (err) {
      console.error("Deposit error:", err);
      toast.error("Deposit failed");
    }
  };

  if (isSuccess) {
    toast.success("Deposit successful!");
  }

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md p-6 shadow-xl shadow-zinc-200/50">
        <h2 className="text-xl font-semibold text-zinc-800 mb-4">Deposit ETH</h2>
        <p className="text-zinc-500">Connect wallet to deposit ETH</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md p-6 shadow-xl shadow-zinc-200/50">
      <h2 className="text-xl font-semibold text-zinc-800 mb-4">Deposit ETH</h2>
      <p className="text-zinc-600 text-sm mb-4">
        Convert ETH to confidential GIFT tokens (1 ETH = 1,000,000 GIFT)
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-600 mb-2">Amount (ETH)</label>
          <input
            type="number"
            step="0.001"
            min="0"
            placeholder="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/50 border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-violet-500 backdrop-blur-sm transition-colors"
          />
        </div>

        {amount && parseFloat(amount) > 0 && (
          <div className="px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">You will receive</span>
              <span className="text-violet-600 font-medium">
                {(parseFloat(amount) * 1_000_000).toLocaleString()} GIFT
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleDeposit}
          disabled={isPending || isConfirming || !amount}
          className="w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium transition-colors shadow-sm"
        >
          {isPending ? "Confirming..." : isConfirming ? "Processing..." : "Deposit"}
        </button>

      </div>
    </div>
  );
}
