"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@/components/wallet/connect-button";
import { FheStatus } from "@/components/layout/fhe-status";
import { BalanceBadge } from "@/components/layout/balance-badge";
import { DepositModal } from "@/components/gift/deposit-modal";

export function Header() {
  const [exchangeOpen, setExchangeOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-200/50 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
              <rect x="80" y="160" width="352" height="288" rx="24" stroke="#D4AF37" strokeWidth="32" strokeLinejoin="round"/>
              <rect x="48" y="96" width="416" height="80" rx="16" stroke="#D4AF37" strokeWidth="32" strokeLinejoin="round"/>
              <path d="M256 176V448" stroke="#D4AF37" strokeWidth="32" strokeLinecap="round"/>
              <path d="M256 96V176" stroke="#D4AF37" strokeWidth="32" strokeLinecap="round"/>
              <path d="M256 96C256 96 192 16 112 48" stroke="#D4AF37" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M256 96C256 96 320 16 400 48" stroke="#D4AF37" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xl font-bold text-zinc-900">Gift</span>
            <span className="text-sm text-zinc-500">FHE Timed Gifts</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setExchangeOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-900 text-sm font-medium transition-colors"
            >
              Wrap ETH
            </button>
            <BalanceBadge />
            <FheStatus />
            <ConnectButton />
          </div>
        </div>
      </header>
      <DepositModal open={exchangeOpen} onClose={() => setExchangeOpen(false)} />
    </>
  );
}
