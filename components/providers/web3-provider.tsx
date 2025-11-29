"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config } from "wagmi";
import { wagmiAdapter, projectId, networks } from "@/lib/wagmi";
import { useEffect, useRef, useState } from "react";

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!projectId) {
      setError("WalletConnect Project ID is not configured");
      console.error("[Web3] NEXT_PUBLIC_WC_PROJECT_ID is not set");
      return;
    }

    const initAppKit = async () => {
      try {
        const { createAppKit } = await import("@reown/appkit/react");
        createAppKit({
          adapters: [wagmiAdapter],
          projectId,
          networks,
          metadata: {
            name: "Gift",
            description: "FHE Timed Gift System",
            url: window.location.origin,
            icons: ["/icon.svg"],
          },
          features: {
            analytics: false,
          },
          themeMode: "dark",
          themeVariables: {
            "--w3m-accent": "#7c3aed",
            "--w3m-border-radius-master": "2px",
          },
        });
        setReady(true);
      } catch (err) {
        console.error("[Web3] AppKit initialization failed:", err);
        setError("Wallet initialization failed");
      }
    };

    initAppKit();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center p-6 bg-gray-800 rounded-lg">
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-gray-400 text-sm">
            Please set NEXT_PUBLIC_WC_PROJECT_ID in environment variables
          </p>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
