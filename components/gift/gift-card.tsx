/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { bytesToHex } from "viem";
import { giftTokenConfig } from "@/lib/contracts";
import { useToast } from "@/components/providers/toast-provider";
import { useFhe } from "@/components/providers/fhe-provider";

export function GiftCard() {
  const { address, isConnected } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [unlockTime, setUnlockTime] = useState("");
  const [isSending, setIsSending] = useState(false);
  const toast = useToast();

  const publicClient = usePublicClient();
  const { instance } = useFhe();

  const { writeContractAsync } = useWriteContract();

  const handleSend = async () => {
    setIsSending(true);
    try {
      if (!instance || !publicClient || !address) {
        toast.error("Please connect wallet and initialize FHE");
        setIsSending(false);
        return;
      }
      if (!recipient || !recipient.startsWith("0x")) {
        toast.error("Please enter a valid recipient address");
        setIsSending(false);
        return;
      }
      if (!amount || parseFloat(amount) <= 0) {
        toast.error("Please enter a valid amount");
        setIsSending(false);
        return;
      }
      if (!unlockDate || !unlockTime) {
        toast.error("Please set unlock date and time");
        setIsSending(false);
        return;
      }

      // Calculate unlock timestamp
      const unlockDateTime = new Date(`${unlockDate}T${unlockTime}`);
      const unlockTimestamp = Math.floor(unlockDateTime.getTime() / 1000);

      if (unlockTimestamp <= Math.floor(Date.now() / 1000)) {
        toast.error("Unlock time must be in the future");
        setIsSending(false);
        return;
      }

      // Encrypt amount (6 decimals)
      const amountUnits = Math.floor(parseFloat(amount) * 1_000_000);
      
      // Split message into 3 parts (31 bytes each, ~93 chars total)
      const msgBytes = new TextEncoder().encode(message);
      const part1 = msgBytes.slice(0, 31);
      const part2 = msgBytes.slice(31, 62);
      const part3 = msgBytes.slice(62, 93);
      
      const toUint256 = (bytes: Uint8Array) => {
        const padded = new Uint8Array(31);
        padded.set(bytes);
        return BigInt("0x" + Array.from(padded).map(b => b.toString(16).padStart(2, "0")).join(""));
      };

      const encryptedInput = await (instance as any)
        .createEncryptedInput(giftTokenConfig.address, address)
        .add64(amountUnits)
        .add256(toUint256(part1))
        .add256(toUint256(part2))
        .add256(toUint256(part3))
        .encrypt();

      const getHandle = (i: number) => encryptedInput.handles[i] instanceof Uint8Array
        ? bytesToHex(encryptedInput.handles[i])
        : encryptedInput.handles[i];

      const proofHex = encryptedInput.inputProof instanceof Uint8Array
        ? bytesToHex(encryptedInput.inputProof)
        : encryptedInput.inputProof;

      const txHash = await writeContractAsync({
        address: giftTokenConfig.address as `0x${string}`,
        abi: giftTokenConfig.abi,
        functionName: "createGift",
        args: [recipient, getHandle(0), getHandle(1), getHandle(2), getHandle(3), BigInt(unlockTimestamp), proofHex],
      } as any);

      toast.success("Gift sent! Waiting for confirmation...");
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      toast.success("Gift created successfully!");
      setRecipient("");
      setAmount("");
      setMessage("");
      setUnlockDate("");
      setUnlockTime("");
    } catch (err: any) {
      console.error("Send gift failed:", err);
      toast.error(typeof err?.message === "string" ? err.message : "Send gift failed");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-md p-6 flex flex-col h-[380px] shadow-xl shadow-zinc-200/50">
      <div className="flex items-center gap-3 mb-4">
        <span className="px-2 py-0.5 text-xs font-medium bg-rose-100 text-rose-700 rounded">Step 2</span>
        <h2 className="text-xl font-semibold text-zinc-800">Encrypt & Send Gift</h2>
      </div>
      
      <div className="flex flex-col flex-1 space-y-2">
        <div className="flex gap-2">
          <div className="flex-[2]">
            <label className="block text-xs text-zinc-600 mb-1">Recipient</label>
            <input
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={isSending}
              className="w-full px-3 py-2 rounded-lg bg-white/70 border border-zinc-300 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-zinc-600 mb-1">Amount</label>
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSending}
              className="w-full px-3 py-2 rounded-lg bg-white/70 border border-zinc-300 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-xs text-zinc-600 mb-1">Message</label>
          <textarea
            placeholder="Happy Birthday! Best wishes..."
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending}
            className="w-full px-3 py-2 rounded-lg bg-white/70 border border-zinc-300 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors resize-none"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-zinc-600 mb-1">Unlock Date</label>
            <input
              type="date"
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
              disabled={isSending}
              className="w-full px-3 py-2 rounded-lg bg-white/70 border border-zinc-300 text-zinc-900 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-zinc-600 mb-1">Unlock Time</label>
            <input
              type="time"
              value={unlockTime}
              onChange={(e) => setUnlockTime(e.target.value)}
              disabled={isSending}
              className="w-full px-3 py-2 rounded-lg bg-white/70 border border-zinc-300 text-zinc-900 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors"
            />
          </div>
        </div>

        <div className="mt-auto">
          <button
            onClick={handleSend}
            disabled={!isConnected || isSending || !recipient || !amount || !unlockDate || !unlockTime}
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium transition-colors shadow-sm"
          >
            {isSending ? "Encrypting..." : "Encrypt & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
