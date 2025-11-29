"use client";

import { useFhe } from "@/components/providers/fhe-provider";

export function FheStatus() {
  const { sdk, instance, loading, error } = useFhe();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 border border-zinc-200 text-zinc-500 text-xs shadow-sm">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span>FHE Loading...</span>
      </div>
    );
  }

  if (error || !sdk) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 border border-zinc-200 text-zinc-500 text-xs shadow-sm">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span>FHE Error</span>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 border border-zinc-200 text-zinc-500 text-xs shadow-sm">
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        <span>FHE Ready</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 border border-zinc-200 text-zinc-500 text-xs shadow-sm">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      <span>FHE Active</span>
    </div>
  );
}
