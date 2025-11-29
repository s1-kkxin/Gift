import { createConfig, http } from "wagmi";
import { sepolia } from "viem/chains";
import { getDefaultConfig } from "connectkit";

const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.ankr.com/eth_sepolia";

export const config = createConfig(
  getDefaultConfig({
    chains: [sepolia],
    transports: {
      [sepolia.id]: http(sepoliaRpc),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
    appName: "Gift",
    appDescription: "FHE Timed Gift System",
  })
);

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
