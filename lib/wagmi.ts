import { createConfig, http } from "wagmi";
import { sepolia } from "viem/chains";
import { injected } from "wagmi/connectors";

const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.ankr.com/eth_sepolia";

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(sepoliaRpc),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
