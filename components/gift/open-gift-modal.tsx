/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef } from "react";
import { usePublicClient, useWriteContract, useWalletClient } from "wagmi";
import { parseEventLogs } from "viem";
import { giftTokenConfig } from "@/lib/contracts";
import { useToast } from "@/components/providers/toast-provider";
import { useFhe } from "@/components/providers/fhe-provider";

type Props = {
  giftId: bigint;
  sender: string;
  unlockTime: bigint;
  opened: boolean;
  claimed: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function OpenGiftModal({ giftId, sender, unlockTime, opened, claimed, onClose, onSuccess }: Props) {
  const [isOpened, setIsOpened] = useState(opened);
  const [isClaimed, setIsClaimed] = useState(claimed);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [loading, setLoading] = useState("");
  const [clearAmount, setClearAmount] = useState<bigint | null>(null);
  const [clearMessage, setClearMessage] = useState<string>("");
  const [error, setError] = useState("");
  const toast = useToast();

  // Store handles for display (amountHandle + 3 messageHandles)
  const handlesRef = useRef<{ amount: string; messages: string[] } | null>(null);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();
  const { instance } = useFhe();

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatTime = (ts: bigint) => new Date(Number(ts) * 1000).toLocaleString();
  const formatAmount = (amount: bigint) => (Number(amount) / 1_000_000).toFixed(6);

  // Decode euint256 message to string (31 bytes max)
  const decodeMessage = (msgBigInt: bigint): string => {
    try {
      const hex = msgBigInt.toString(16).padStart(62, "0"); // 31 bytes = 62 hex chars
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16);
        if (byte !== 0) bytes.push(byte);
      }
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch {
      return "";
    }
  };

  // User decrypt for multiple message handles (3 parts)
  const userDecryptMessages = async (messageHandles: string[]): Promise<string> => {
    if (!instance || !walletClient) throw new Error("Not ready");
    
    const keypair = (instance as any).generateKeypair();
    const handleContractPairs = messageHandles.map(h => ({ handle: h, contractAddress: giftTokenConfig.address }));
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "1";
    const contractAddresses = [giftTokenConfig.address];
    
    const eip712 = (instance as any).createEIP712(
      keypair.publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays
    );
    
    const signature = await walletClient.signTypedData({
      domain: eip712.domain,
      types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      primaryType: "UserDecryptRequestVerification",
      message: eip712.message,
    });
    
    const result = await (instance as any).userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      walletClient.account.address,
      startTimeStamp,
      durationDays
    );
    
    // Decode and concatenate all 3 parts
    let fullMessage = "";
    for (const h of messageHandles) {
      const val = result[h] ?? result[h.toLowerCase()];
      fullMessage += decodeMessage(BigInt(val ?? 0));
    }
    return fullMessage.trim();
  };

  // User decrypt for amount (private decryption)
  const userDecryptAmount = async (amountHandle: string): Promise<bigint> => {
    if (!instance || !walletClient) throw new Error("Not ready");
    
    const keypair = (instance as any).generateKeypair();
    const handleContractPairs = [{ handle: amountHandle, contractAddress: giftTokenConfig.address }];
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "1";
    const contractAddresses = [giftTokenConfig.address];
    
    const eip712 = (instance as any).createEIP712(
      keypair.publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays
    );
    
    const signature = await walletClient.signTypedData({
      domain: eip712.domain,
      types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      primaryType: "UserDecryptRequestVerification",
      message: eip712.message,
    });
    
    const result = await (instance as any).userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      walletClient.account.address,
      startTimeStamp,
      durationDays
    );
    
    const decryptedValue = result[amountHandle] ?? result[amountHandle.toLowerCase()];
    return BigInt(decryptedValue ?? 0);
  };


  // Step 1: Open - grant decrypt permission on-chain (no auto decrypt)
  const handleOpen = async () => {
    if (!publicClient) {
      setError("Wallet not ready");
      return;
    }
    try {
      setError("");
      setLoading("opening");
      
      // Call openGift to grant decrypt permission
      const hash = await writeContractAsync({
        ...giftTokenConfig,
        functionName: "openGift",
        args: [giftId],
      });
      
      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("[Open] Receipt:", receipt);

      // Get handles from event
      const logs = parseEventLogs({ abi: giftTokenConfig.abi, logs: receipt.logs });
      const openedEvent = logs.find((l: any) => l.eventName === "GiftOpened") as any;
      if (openedEvent?.args) {
        const { amountHandle, messageHandles } = openedEvent.args;
        console.log("[Open] Handles:", { amountHandle, messageHandles });
        handlesRef.current = { amount: amountHandle, messages: messageHandles };
      }

      // Mark as opened - user can now click "Decrypt Contents"
      setIsOpened(true);
      toast.success("Gift opened! Click 'Decrypt Contents' to reveal.");
    } catch (err: any) {
      console.error("[Open] Failed:", err);
      setError(err?.shortMessage || err?.message || "Failed to open");
    } finally {
      setLoading("");
    }
  };

  // Retry decrypt for already opened gift
  const handleRetryDecrypt = async () => {
    if (!publicClient || !instance) {
      setError("Wallet or FHE not ready");
      return;
    }
    try {
      setError("");
      setLoading("decrypting");

      // Get handles from contract (amountHandle, messageHandles[3])
      const result = await publicClient.readContract({
        ...giftTokenConfig,
        functionName: "getGiftHandles",
        args: [giftId],
      }) as [string, string[]];
      
      const [amountHandle, messageHandles] = result;
      console.log("[Retry] Handles from contract:", { amountHandle, messageHandles });
      
      if (!amountHandle || amountHandle === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        throw new Error("Invalid amount handle (empty)");
      }

      handlesRef.current = { amount: amountHandle, messages: messageHandles };
      console.log("[Retry] Decrypting via userDecrypt...");
      
      // Decrypt amount
      try {
        console.log("[Retry] Decrypting amount...");
        const amount = await Promise.race([
          userDecryptAmount(amountHandle),
          new Promise<bigint>((_, reject) => 
            setTimeout(() => reject(new Error("Amount decrypt timeout 60s")), 60000)
          )
        ]);
        console.log("[Retry] Amount decrypted:", amount);
        setClearAmount(amount);
        setIsDecrypted(true);
      } catch (amtErr) {
        console.error("[Retry] Amount decrypt failed:", amtErr);
        throw amtErr;
      }
      
      // Decrypt messages (3 parts)
      try {
        console.log("[Retry] Decrypting messages...");
        const msg = await Promise.race([
          userDecryptMessages(messageHandles),
          new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error("Message decrypt timeout 60s")), 60000)
          )
        ]);
        console.log("[Retry] Message decrypted:", msg);
        setClearMessage(msg || "(empty)");
      } catch (msgErr) {
        console.error("[Retry] Message decrypt failed:", msgErr);
        setClearMessage("(Decryption failed)");
      }
      
      toast.success("Decrypted!");
    } catch (err: any) {
      console.error("[Retry] Failed:", err);
      setError(err?.message || "Decrypt failed");
    } finally {
      setLoading("");
    }
  };

  // Step 3: Claim - transfer tokens (no proof needed)
  const handleClaim = async () => {
    if (!publicClient) {
      setError("Wallet not ready");
      return;
    }
    try {
      setError("");
      setLoading("claiming");

      const hash = await writeContractAsync({
        ...giftTokenConfig,
        functionName: "claimGift",
        args: [giftId],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setIsClaimed(true);
      toast.success("Claimed! Tokens added to your confidential balance.");
    } catch (err: any) {
      console.error("[Claim] Failed:", err);
      setError(err?.shortMessage || err?.message || "Failed to claim");
    } finally {
      setLoading("");
    }
  };

  const now = BigInt(Math.floor(Date.now() / 1000));
  const isUnlocked = now >= unlockTime;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-white/40 bg-white/90 backdrop-blur-xl p-6 shadow-2xl shadow-zinc-200/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-zinc-800">Gift #{giftId.toString()}</h2>
          <button
            onClick={() => { onSuccess(); onClose(); }}
            disabled={!!loading}
            className="text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Gift Info */}
        <div className="space-y-3 p-4 rounded-xl bg-white/50 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">From</span>
            <span className="text-zinc-900 font-mono">{formatAddress(sender)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Unlock Time</span>
            <span className={isUnlocked ? "text-green-600" : "text-amber-600"}>
              {formatTime(unlockTime)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Status</span>
            <span className={
              isClaimed ? "text-green-600" : 
              isOpened ? "text-blue-600" :
              isUnlocked ? "text-purple-600" : 
              "text-zinc-500"
            }>
              {isClaimed ? "Claimed" : isOpened ? "Opened" : isUnlocked ? "Ready" : "Locked"}
            </span>
          </div>
          
          {/* Amount - encrypted or decrypted */}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Amount</span>
            {clearAmount !== null ? (
              <span className="text-amber-600 font-medium">{formatAmount(clearAmount)} cGIFT</span>
            ) : (
              <span className="text-zinc-500 font-mono">********</span>
            )}
          </div>

          {/* Message - encrypted or decrypted */}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Message</span>
            {clearMessage ? (
              <span className="text-zinc-900">{clearMessage}</span>
            ) : (
              <span className="text-zinc-500 font-mono">********</span>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-center text-sm text-red-600 mb-4 p-2 rounded bg-red-500/10">{error}</div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {!isUnlocked && (
            <div className="text-center text-zinc-500 py-4">
              Locked until {formatTime(unlockTime)}
            </div>
          )}

          {/* Step 1: Open - decrypt and display contents */}
          {isUnlocked && !isOpened && (
            <button
              onClick={handleOpen}
              disabled={!!loading}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 disabled:text-zinc-500 text-white font-medium transition-colors shadow-sm"
            >
              {loading === "opening" ? "Opening..." : loading === "decrypting" ? "Decrypting..." : "Open Gift"}
            </button>
          )}

          {/* Step 2: Decrypt (if not done) or Claim */}
          {isOpened && !isClaimed && !isDecrypted && (
            <button
              onClick={handleRetryDecrypt}
              disabled={!!loading}
              className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-300 disabled:text-zinc-500 text-white font-medium transition-colors shadow-sm"
            >
              {loading === "decrypting" ? "Decrypting..." : "Decrypt Contents"}
            </button>
          )}

          {isOpened && !isClaimed && isDecrypted && (
            <button
              onClick={handleClaim}
              disabled={!!loading}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:bg-zinc-300 disabled:text-zinc-500 text-white font-medium transition-colors shadow-sm"
            >
              {loading === "claiming" ? "Claiming..." : "Claim Tokens"}
            </button>
          )}

          {isClaimed && (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-900 font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>

        {isOpened && !isClaimed && (
          <p className="text-xs text-zinc-500 text-center mt-3">
            Tokens will be added to your confidential balance.
          </p>
        )}
      </div>
    </div>
  );
}
