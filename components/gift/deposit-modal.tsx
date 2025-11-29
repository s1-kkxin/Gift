/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useWalletClient } from "wagmi";
import { parseEther, parseUnits, bytesToHex, parseEventLogs, encodeAbiParameters } from "viem";
import { giftTokenConfig } from "@/lib/contracts";
import { useToast } from "@/components/providers/toast-provider";
import { useFhe } from "@/components/providers/fhe-provider";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function DepositModal({ open, onClose }: Props) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"wrap" | "unwrap">("wrap");
  const [isUnwrapping, setIsUnwrapping] = useState(false);
  const [unwrapStep, setUnwrapStep] = useState(0); // 0=idle, 1=encrypt, 2=prepare, 3=decrypt, 4=finalize, 5=done
  const toast = useToast();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { instance } = useFhe();

  const { writeContract, writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess && mode === "wrap") {
      toast.success("Wrap successful!");
      reset();
      setAmount("");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const handleWrap = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    writeContract({
      ...giftTokenConfig,
      functionName: "wrap",
      value: parseEther(amount),
    });
  };

  const handleUnwrap = async () => {
    try {
      if (!instance || !publicClient || !walletClient || !address) {
        toast.error("Please connect wallet and initialize FHE");
        return;
      }
      if (!amount || parseFloat(amount) <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }

      setIsUnwrapping(true);
      setUnwrapStep(1); // Encrypting

      // 1) Frontend encryption (amount uses 6 decimals)
      const amountUnits = parseUnits(amount, 6);
      const amountNum = Number(amountUnits);
      if (!Number.isSafeInteger(amountNum) || amountNum <= 0) {
        toast.error("Invalid amount");
        setIsUnwrapping(false);
        setUnwrapStep(0);
        return;
      }

      const encryptedInput = await (instance as any)
        .createEncryptedInput(giftTokenConfig.address, address)
        .add64(amountNum)
        .encrypt();

      const handleHex = encryptedInput.handles[0] instanceof Uint8Array
        ? bytesToHex(encryptedInput.handles[0])
        : encryptedInput.handles[0];

      const proofHex = encryptedInput.inputProof instanceof Uint8Array
        ? bytesToHex(encryptedInput.inputProof)
        : encryptedInput.inputProof;

      setUnwrapStep(2); // Submitting prepareUnwrap

      // 2) Submit prepareUnwrap transaction
      const txHash = await writeContractAsync({
        address: giftTokenConfig.address as `0x${string}`,
        abi: giftTokenConfig.abi,
        functionName: "prepareUnwrap",
        args: [handleHex, proofHex],
      } as any);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      const logs = parseEventLogs({
        abi: giftTokenConfig.abi,
        logs: receipt.logs,
        eventName: "UnwrapPrepared",
      });
      if (!logs.length) {
        throw new Error("UnwrapPrepared event not found");
      }
      const preparedHandle = (logs[0] as any).args.handle as `0x${string}`;

      setUnwrapStep(3); // Public decryption

      // 3) Public decryption via Relayer SDK
      const decryptResult = await (instance as any).publicDecrypt([preparedHandle]);

      let clearAmount: bigint;
      if (decryptResult.clearValues[preparedHandle]) {
        clearAmount = decryptResult.clearValues[preparedHandle] as bigint;
      } else {
        const firstKey = Object.keys(decryptResult.clearValues)[0];
        clearAmount = decryptResult.clearValues[firstKey] as bigint;
      }

      // Encode cleartexts as abi.encode(uint64)
      const cleartexts = encodeAbiParameters(
        [{ type: "uint64" }],
        [clearAmount]
      );

      const decryptionProof = decryptResult.decryptionProof as `0x${string}`;

      setUnwrapStep(4); // Finalizing

      // 4) Finalize unwrap
      const finalizeHash = await writeContractAsync({
        address: giftTokenConfig.address as `0x${string}`,
        abi: giftTokenConfig.abi,
        functionName: "finalizeUnwrap",
        args: [preparedHandle, cleartexts, decryptionProof],
      } as any);

      await publicClient.waitForTransactionReceipt({ hash: finalizeHash });
      
      setUnwrapStep(5); // Done
      setAmount("");
      toast.success("Unwrap completed!");
    } catch (err: any) {
      console.error("Unwrap failed:", err);
      toast.error(typeof err?.message === "string" ? err.message : "Unwrap failed");
      setUnwrapStep(0);
    } finally {
      setIsUnwrapping(false);
    }
  };

  const handleClose = () => {
    if (isUnwrapping) return; // Prevent closing during Unwrap
    setAmount("");
    setUnwrapStep(0);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-white/40 bg-white/90 backdrop-blur-xl p-6 shadow-2xl shadow-zinc-200/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-zinc-800">{mode === "wrap" ? "Wrap ETH" : "Unwrap cGIFT"}</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            x
          </button>
        </div>

        {!isConnected ? (
          <p className="text-zinc-500 text-center py-8">Connect wallet</p>
        ) : (
          <div className="space-y-4">
            <div className="flex rounded-xl bg-white/50 p-1">
              <button
                onClick={() => setMode("wrap")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "wrap" ? "bg-amber-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Wrap
              </button>
              <button
                onClick={() => setMode("unwrap")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "unwrap" ? "bg-amber-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Unwrap
              </button>
            </div>

            <p className="text-zinc-500 text-sm">
              {mode === "wrap" 
                ? "Wrap ETH into confidential cGIFT tokens (1:1)"
                : "Unwrap cGIFT back to ETH (1:1)"}
            </p>

            <div>
              <label className="block text-sm text-zinc-600 mb-2">
                Amount ({mode === "wrap" ? "ETH" : "cGIFT"})
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isPending || isConfirming}
                className="w-full px-4 py-3 rounded-xl bg-white/50 border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors"
              />
            </div>

            {amount && parseFloat(amount) > 0 && (
              <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">You will receive</span>
                  <span className="text-zinc-900 font-medium">
                    {parseFloat(amount).toFixed(6)} {mode === "wrap" ? "cGIFT" : "ETH"}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={mode === "wrap" ? handleWrap : handleUnwrap}
              disabled={isPending || isConfirming || isUnwrapping || !amount}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium transition-colors shadow-sm"
            >
              {mode === "wrap"
                ? (isPending ? "Confirming..." : isConfirming ? "Processing..." : "Wrap")
                : (unwrapStep === 5 ? "Unwrap" : isUnwrapping ? "Processing..." : "Unwrap")}
            </button>

            {/* Unwrap Progress Steps */}
            {mode === "unwrap" && unwrapStep > 0 && (
              <div className="mt-3 space-y-2">
                {[
                  { step: 1, label: "Encrypting amount" },
                  { step: 2, label: "Submitting prepareUnwrap" },
                  { step: 3, label: "Public decryption" },
                  { step: 4, label: "Finalizing unwrap" },
                  { step: 5, label: "Completed" },
                ].map(({ step, label }) => (
                  <div key={step} className="flex items-center gap-2 text-sm">
                    {unwrapStep === step && step < 5 ? (
                      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    ) : unwrapStep > step || unwrapStep === 5 ? (
                      <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs">✓</div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-300" />
                    )}
                    <span className={unwrapStep >= step ? "text-zinc-900" : "text-zinc-400"}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
