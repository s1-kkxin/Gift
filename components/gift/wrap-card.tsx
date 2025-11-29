/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useWalletClient } from "wagmi";
import { parseEther, parseUnits, bytesToHex, parseEventLogs, encodeAbiParameters } from "viem";
import { giftTokenConfig } from "@/lib/contracts";
import { useToast } from "@/components/providers/toast-provider";
import { useFhe } from "@/components/providers/fhe-provider";
import { useMounted } from "@/hooks/use-mounted";

export function WrapCard() {
  const mounted = useMounted();
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"wrap" | "unwrap">("wrap");
  const [isUnwrapping, setIsUnwrapping] = useState(false);
  const [unwrapStep, setUnwrapStep] = useState(0);
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
      setUnwrapStep(1);

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

      setUnwrapStep(2);

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

      setUnwrapStep(3);

      const decryptResult = await (instance as any).publicDecrypt([preparedHandle]);

      let clearAmount: bigint;
      if (decryptResult.clearValues[preparedHandle]) {
        clearAmount = decryptResult.clearValues[preparedHandle] as bigint;
      } else {
        const firstKey = Object.keys(decryptResult.clearValues)[0];
        clearAmount = decryptResult.clearValues[firstKey] as bigint;
      }

      const cleartexts = encodeAbiParameters(
        [{ type: "uint64" }],
        [clearAmount]
      );

      const decryptionProof = decryptResult.decryptionProof as `0x${string}`;

      setUnwrapStep(4);

      const finalizeHash = await writeContractAsync({
        address: giftTokenConfig.address as `0x${string}`,
        abi: giftTokenConfig.abi,
        functionName: "finalizeUnwrap",
        args: [preparedHandle, cleartexts, decryptionProof],
      } as any);

      await publicClient.waitForTransactionReceipt({ hash: finalizeHash });
      
      setUnwrapStep(5);
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

  if (!mounted || !isConnected) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-md p-6 h-[380px] flex flex-col shadow-xl shadow-zinc-200/50">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">Step 1</span>
          <h2 className="text-xl font-semibold text-zinc-800">Wrap / Unwrap</h2>
        </div>
        <p className="text-zinc-500 text-center flex-1 flex items-center justify-center">
          {!mounted ? "Loading..." : "Connect wallet to continue"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-md p-6 flex flex-col h-[380px] shadow-xl shadow-zinc-200/50">
      <div className="flex items-center gap-3 mb-4">
        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">Step 1</span>
        <h2 className="text-xl font-semibold text-zinc-800">Wrap / Unwrap</h2>
      </div>
      
      <div className="flex flex-col flex-1">
        <div className="flex rounded-xl bg-white/70 border border-zinc-300 p-1">
          <button
            onClick={() => setMode("wrap")}
            disabled={isUnwrapping}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "wrap" ? "bg-amber-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            } disabled:opacity-50`}
          >
            Wrap
          </button>
          <button
            onClick={() => setMode("unwrap")}
            disabled={isUnwrapping}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "unwrap" ? "bg-amber-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            } disabled:opacity-50`}
          >
            Unwrap
          </button>
        </div>

        <p className="text-zinc-500 text-sm mt-3">
          {mode === "wrap" 
            ? "Wrap ETH into confidential cGIFT tokens (1:1)"
            : "Unwrap cGIFT back to ETH (1:1)"}
        </p>

        <div className="mt-3">
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
            disabled={isPending || isConfirming || isUnwrapping}
            className="w-full px-4 py-3 rounded-xl bg-white/70 border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors"
          />
        </div>

        <div className="h-[52px] mt-3">
          {amount && parseFloat(amount) > 0 ? (
            <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">You will receive</span>
                <span className="text-zinc-900 font-medium">
                  {parseFloat(amount).toFixed(6)} {mode === "wrap" ? "cGIFT" : "ETH"}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-auto space-y-3">
          <button
            onClick={mode === "wrap" ? handleWrap : handleUnwrap}
            disabled={isPending || isConfirming || isUnwrapping || !amount}
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium transition-colors shadow-sm"
          >
            {mode === "wrap"
              ? (isConfirming ? "Processing..." : isPending ? "Confirming..." : "Wrap")
              : (unwrapStep === 5 ? "Unwrap" : isUnwrapping ? "Processing..." : "Unwrap")}
          </button>

          {/* Progress Steps - Horizontal Compact View */}
          <div className="flex items-center justify-center gap-2 h-4">
            {mode === "unwrap" && [1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                {unwrapStep === step && step < 5 ? (
                  <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : unwrapStep >= step ? (
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-zinc-600" />
                )}
                {step < 5 && <div className={`w-4 h-0.5 ${unwrapStep > step ? "bg-amber-500" : "bg-zinc-700"}`} />}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
