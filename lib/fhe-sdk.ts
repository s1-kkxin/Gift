type FheSdkModule = {
  initSDK: () => Promise<void>;
  createInstance: <TConfig>(config: TConfig) => Promise<FheInstance>;
  SepoliaConfig: Record<string, unknown>;
};

type EncryptedInputBuilder = {
  add64: (value: number | bigint) => EncryptedInputBuilder;
  add256: (value: number | bigint | string) => EncryptedInputBuilder;
  encrypt: () => Promise<{
    handles: string[];
    inputProof: string;
  }>;
};

type FheInstance = {
  createEncryptedInput: (contractAddress: string, signerAddress: string) => EncryptedInputBuilder;
  publicDecrypt: (handles: string[]) => Promise<{
    clearValues: Record<string, bigint | string | number>;
    abiEncodedClearValues: string;
    decryptionProof: string;
  }>;
};

let sdkPromise: Promise<FheSdkModule> | null = null;

const tryGetGlobal = (): (() => Promise<void>) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const candidates = [
    (w.RelayerSDK as { initSDK?: () => Promise<void> } | undefined)?.initSDK,
    (w.relayerSDK as { initSDK?: () => Promise<void> } | undefined)?.initSDK,
    (w.zamaRelayerSDK as { initSDK?: () => Promise<void> } | undefined)?.initSDK,
  ];
  return candidates.find((fn): fn is () => Promise<void> => typeof fn === "function") ?? null;
};

export async function loadFheSdk(): Promise<FheSdkModule> {
  if (typeof window === "undefined") {
    throw new Error("FHE SDK can only be loaded in browser");
  }

  if (sdkPromise) return sdkPromise;

  sdkPromise = (async () => {
    let initFn = tryGetGlobal();

    if (!initFn) {
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 100));
        initFn = tryGetGlobal();
        if (initFn) break;
      }
    }

    if (!initFn) {
      throw new Error("FHE SDK not loaded from CDN");
    }

    await initFn();

    const w = window as unknown as Record<string, unknown>;
    const candidates = [
      w.RelayerSDK as FheSdkModule | undefined,
      w.relayerSDK as FheSdkModule | undefined,
      w.zamaRelayerSDK as FheSdkModule | undefined,
    ];
    const sdkModule = candidates.find((mod): mod is FheSdkModule => 
      Boolean(mod && typeof mod.createInstance === "function")
    );

    if (!sdkModule) {
      throw new Error("FHE SDK module not found");
    }

    return sdkModule;
  })();

  return sdkPromise;
}

export type { FheInstance, EncryptedInputBuilder };
