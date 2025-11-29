/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useFhe } from "@/components/providers/fhe-provider";
import { giftTokenConfig } from "@/lib/contracts";
import { useToast } from "@/components/providers/toast-provider";

export function BalanceBadge() {
  const { address, isConnected } = useAccount();
  const { instance } = useFhe();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const toast = useToast();
  
  const [balance, setBalance] = useState<string>("***");
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleDecrypt = async () => {
    if (!instance || !address || !publicClient || !walletClient) {
      toast.error("Please connect wallet");
      return;
    }

    setIsDecrypting(true);
    try {
      const rawHandle = await publicClient.readContract({
        address: giftTokenConfig.address,
        abi: giftTokenConfig.abi,
        functionName: "confidentialBalanceOf",
        args: [address],
      });

      // bytes32 might return as bigint or string
      const balanceHandle = typeof rawHandle === "bigint" 
        ? `0x${rawHandle.toString(16).padStart(64, "0")}` 
        : String(rawHandle);

      console.log("[BalanceBadge] rawHandle:", rawHandle, "balanceHandle:", balanceHandle);

      const zeroHandle = "0x0000000000000000000000000000000000000000000000000000000000000000";
      if (!rawHandle || balanceHandle === zeroHandle || (typeof rawHandle === "bigint" && rawHandle === BigInt(0))) {
        setBalance("0");
        setIsDecrypting(false);
        return;
      }

      let decryptedBalance: bigint | number;

      try {
        const maybeSimple = (instance as any).userDecrypt as (
          encryptedValue: string,
          contractAddress: string
        ) => Promise<number | bigint>;

        decryptedBalance = await maybeSimple(balanceHandle, giftTokenConfig.address);
      } catch {
        const keypair = (instance as any).generateKeypair();
        const startTimeStamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = "1";

        const eip712 = (instance as any).createEIP712(
          keypair.publicKey,
          [giftTokenConfig.address],
          startTimeStamp,
          durationDays
        );

        const signature = await walletClient.signTypedData({
          account: walletClient.account!,
          domain: eip712.domain as any,
          types: eip712.types as any,
          primaryType: "UserDecryptRequestVerification",
          message: eip712.message as any,
        });

        const handleContractPairs = [{ handle: balanceHandle, contractAddress: giftTokenConfig.address }];
        const userDecryptLegacy = (instance as any).userDecrypt as (
          handleContractPairs: Array<{ handle: unknown; contractAddress: string }>,
          privateKey: string,
          publicKey: string,
          signature: string,
          contractAddresses: string[],
          userAddress: string,
          startTimeStamp: string,
          durationDays: string
        ) => Promise<Record<string, bigint | string>>;

        const result = await userDecryptLegacy(
          handleContractPairs,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace("0x", ""),
          [giftTokenConfig.address],
          address,
          startTimeStamp,
          durationDays
        );

        decryptedBalance = result[balanceHandle] as bigint;
      }

      const raw = Number(decryptedBalance) / 1_000_000;
      const balanceInTokens = raw === 0 ? "0" : parseFloat(raw.toFixed(6)).toString();
      setBalance(balanceInTokens);
      toast.success("Balance decrypted");
    } catch (err) {
      console.error("Decrypt error:", err);
      toast.error("Decrypt failed");
      setBalance("***");
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-l-lg bg-amber-500/10 border border-amber-500/20 text-xs">
        <span className="text-zinc-500">cGIFT</span>
        <span className="text-amber-600 font-medium">{isConnected ? balance : "-"}</span>
      </div>
      {isConnected && (
        <button
          onClick={handleDecrypt}
          disabled={isDecrypting || !instance}
          className="px-2.5 py-1.5 rounded-r-lg bg-amber-500/20 border border-amber-500/20 border-l-0 text-amber-700 hover:bg-amber-500/30 disabled:opacity-50 text-xs transition-colors"
        >
          {isDecrypting ? "Decrypting..." : "Decrypt"}
        </button>
      )}
    </div>
  );
}
