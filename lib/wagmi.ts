import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { sepolia } from "viem/chains";
import { injected } from "wagmi/connectors";

const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.ankr.com/eth_sepolia";

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [sepolia.id]: http(sepoliaRpc),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
