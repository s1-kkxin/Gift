"use client";

import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useWalletClient } from "wagmi";
import { loadFheSdk, type FheInstance } from "@/lib/fhe-sdk";

type FheSdkModule = Awaited<ReturnType<typeof loadFheSdk>>;

type FheContextValue = {
  sdk: FheSdkModule | null;
  instance: FheInstance | null;
  loading: boolean;
  error: Error | null;
};

const FheContext = createContext<FheContextValue>({
  sdk: null,
  instance: null,
  loading: true,
  error: null,
});

const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "";
const SEPOLIA_CHAIN_ID = 11155111;

export function FheProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<FheContextValue>({
    sdk: null,
    instance: null,
    loading: true,
    error: null,
  });
  const { data: walletClient } = useWalletClient();

  // Load SDK
  useEffect(() => {
    let cancelled = false;

    loadFheSdk()
      .then((sdk) => {
        if (!cancelled) {
          console.log("[FHE] SDK Loaded from CDN");
          setState((prev) => ({ ...prev, sdk, loading: false }));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[FHE] SDK Load Failed:", error);
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error : new Error("Failed to load FHE SDK"),
          }));
        }
      });

    return () => { cancelled = true; };
  }, []);

  // Create instance when wallet connected
  const sdk = state.sdk;
  
  useEffect(() => {
    if (!sdk || !walletClient) return;
    
    let cancelled = false;

    const createInstance = async () => {
      try {
        const eip1193Provider = {
          request: (args: unknown) => 
            (walletClient as unknown as { request: (a: unknown) => Promise<unknown> }).request(args),
        };

        // Log configuration for debugging (without exposing sensitive keys if any)
        console.log("[FHE] Creating instance with Chain ID:", SEPOLIA_CHAIN_ID);
        console.log("[FHE] Relayer URL from config:", (sdk.SepoliaConfig as Record<string, unknown>)?.relayerUrl);

        const config = {
          ...sdk.SepoliaConfig,
          network: SEPOLIA_RPC,
          chainId: SEPOLIA_CHAIN_ID,
          signer: eip1193Provider,
        };

        const instance = await sdk.createInstance(config);
        if (!cancelled) {
          console.log("[FHE] Instance created successfully");
          setState((prev) => ({ ...prev, instance }));
        }
      } catch (err) {
        console.error("[FHE] Failed to create instance:", err);
      }
    };

    createInstance();
    return () => { cancelled = true; };
  }, [sdk, walletClient]);

  const value = useMemo(() => state, [state]);

  return <FheContext.Provider value={value}>{children}</FheContext.Provider>;
}

export function useFhe() {
  return useContext(FheContext);
}
