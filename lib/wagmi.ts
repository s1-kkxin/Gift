import { cookieStorage, createStorage } from "wagmi";
import { sepolia } from "viem/chains";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit-common";

export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

if (!projectId) {
  console.error("[Wagmi] NEXT_PUBLIC_WC_PROJECT_ID is not set");
}

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [sepolia];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks,
});

export const config = wagmiAdapter.wagmiConfig;
