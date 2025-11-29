"use client";

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config } from "wagmi";
import { wagmiAdapter, projectId, networks } from "@/lib/wagmi";
import { useEffect, useRef } from "react";

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    createAppKit({
      adapters: [wagmiAdapter],
      projectId,
      networks,
      metadata: {
        name: "Gift",
        description: "FHE Timed Gift System",
        url: window.location.origin,
        icons: ["/icon.png"],
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
  }, []);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
