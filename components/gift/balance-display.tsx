"use client";

import { useAccount, useReadContract, useBalance } from "wagmi";
import { formatEther } from "viem";
import { giftTokenConfig } from "@/lib/contracts";

export function BalanceDisplay() {
  const { address, isConnected } = useAccount();

  const { data: ethBalance } = useBalance({
    address,
  });

  const { data: giftBalance } = useReadContract({
    ...giftTokenConfig,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  if (!isConnected) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md p-6 shadow-xl shadow-zinc-200/50">
      <h2 className="text-xl font-semibold text-zinc-800 mb-4">Your Balance</h2>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-white/50 border border-white/60 shadow-sm">
          <span className="text-zinc-600">ETH</span>
          <span className="text-zinc-900 font-medium">
            {ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : "0"} ETH
          </span>
        </div>
        
        <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-violet-500/10 border border-violet-500/20 shadow-sm">
          <span className="text-zinc-600">GIFT (Encrypted)</span>
          <span className="text-violet-600 font-medium">
            {giftBalance ? "******" : "0"} GIFT
          </span>
        </div>
        
        <p className="text-xs text-zinc-500 mt-2">
          GIFT balance is encrypted. Only you can decrypt it.
        </p>
      </div>
    </div>
  );
}
