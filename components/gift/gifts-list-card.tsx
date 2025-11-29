"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { giftTokenConfig } from "@/lib/contracts";
import { OpenGiftModal } from "./open-gift-modal";

type GiftInfo = {
  id: bigint;
  otherParty: string;
  unlockTime: bigint;
  opened: boolean;
  claimed: boolean;
};

export function GiftsListCard() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<"sent" | "received">("received");
  const [sentGifts, setSentGifts] = useState<GiftInfo[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<GiftInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftInfo | null>(null);

  const publicClient = usePublicClient();

  const { data: sentIds } = useReadContract({
    ...giftTokenConfig,
    functionName: "getSentGifts",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: receivedIds, refetch: refetchReceived } = useReadContract({
    ...giftTokenConfig,
    functionName: "getReceivedGifts",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  useEffect(() => {
    const fetchGiftDetails = async () => {
      if (!publicClient || !address) return;

      setLoading(true);
      try {
        if (sentIds && (sentIds as bigint[]).length > 0) {
          const details = await Promise.all(
            (sentIds as bigint[]).map(async (id) => {
              const info = await publicClient.readContract({
                ...giftTokenConfig,
                functionName: "getGiftInfo",
                args: [id],
              }) as [string, string, bigint, boolean, boolean];
              return {
                id,
                otherParty: info[1],
                unlockTime: info[2],
                opened: info[3],
                claimed: info[4],
              };
            })
          );
          setSentGifts(details.reverse());
        } else {
          setSentGifts([]);
        }

        if (receivedIds && (receivedIds as bigint[]).length > 0) {
          const details = await Promise.all(
            (receivedIds as bigint[]).map(async (id) => {
              const info = await publicClient.readContract({
                ...giftTokenConfig,
                functionName: "getGiftInfo",
                args: [id],
              }) as [string, string, bigint, boolean, boolean];
              return {
                id,
                otherParty: info[0],
                unlockTime: info[2],
                opened: info[3],
                claimed: info[4],
              };
            })
          );
          setReceivedGifts(details.reverse());
        } else {
          setReceivedGifts([]);
        }
      } catch (err) {
        console.error("Failed to fetch gifts:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGiftDetails();
  }, [publicClient, address, sentIds, receivedIds]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatTime = (ts: bigint) => new Date(Number(ts) * 1000).toLocaleString();

  const getStatus = (gift: GiftInfo, isSent: boolean) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (gift.claimed) return { text: "Claimed", color: "text-green-600" };
    if (gift.opened) return { text: "Opened", color: "text-amber-600" };
    if (now >= gift.unlockTime) return { text: isSent ? "Ready" : "Claimable", color: "text-blue-600" };
    return { text: "Locked", color: "text-zinc-400" };
  };

  const gifts = tab === "sent" ? sentGifts : receivedGifts;

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-md p-6 shadow-xl shadow-zinc-200/50">
        <h2 className="text-xl font-semibold text-zinc-800 mb-4">My Gifts</h2>
        <p className="text-zinc-500 text-center py-8">Connect wallet to view gifts</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-md p-6 shadow-xl shadow-zinc-200/50">
        <h2 className="text-xl font-semibold text-zinc-800 mb-4">My Gifts</h2>

        <div className="flex rounded-xl bg-white/70 border border-zinc-300 p-1 mb-4">
          <button
            onClick={() => setTab("received")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "received" ? "bg-amber-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            Received ({receivedGifts.length})
          </button>
          <button
            onClick={() => setTab("sent")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "sent" ? "bg-amber-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            Sent ({sentGifts.length})
          </button>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-zinc-500">Loading...</div>
          ) : gifts.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              {tab === "sent" ? "No gifts sent yet" : "No gifts received yet"}
            </div>
          ) : (
            gifts.map((gift) => {
              const status = getStatus(gift, tab === "sent");
              const now = BigInt(Math.floor(Date.now() / 1000));
              const canView = tab === "received";
              
              return (
                <div
                  key={gift.id.toString()}
                  onClick={() => canView && setSelectedGift(gift)}
                  className={`flex items-center justify-between p-3 rounded-xl bg-white/70 border border-white/60 ${canView ? "cursor-pointer hover:bg-white/80 transition-colors shadow-sm" : "shadow-sm"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-900 font-medium">#{gift.id.toString()}</span>
                      <span className={`text-xs ${status.color}`}>{status.text}</span>
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {tab === "sent" ? "To: " : "From: "}{formatAddress(gift.otherParty)}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {now < gift.unlockTime ? "Unlocks: " : "Unlocked: "}{formatTime(gift.unlockTime)}
                    </div>
                  </div>
                  
                  {canView && (
                    <span className="text-xs text-zinc-400">View</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedGift && (
        <OpenGiftModal
          giftId={selectedGift.id}
          sender={selectedGift.otherParty}
          unlockTime={selectedGift.unlockTime}
          opened={selectedGift.opened}
          claimed={selectedGift.claimed}
          onClose={() => setSelectedGift(null)}
          onSuccess={() => {
            setSelectedGift(null);
            refetchReceived();
          }}
        />
      )}
    </>
  );
}
