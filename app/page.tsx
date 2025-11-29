import { Header } from "@/components/layout/header";
import { WrapCard } from "@/components/gift/wrap-card";
import { GiftCard } from "@/components/gift/gift-card";
import { GiftsListCard } from "@/components/gift/gifts-list-card";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-6 pt-24 pb-12">
        {/* Hero Section */}
        <section className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-800 mb-4">
            Gift - Time-Locked Encrypted Gifts
          </h1>
          <p className="text-zinc-600 max-w-2xl mx-auto mb-6 leading-relaxed">
            Built on Zama FHEVM. Wrap ETH into confidential tokens, send encrypted gifts with secret messages.
            Recipients can only obtain decryption permission (ACL) and open the gift after the unlock time.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time-locked Mystery Gift
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Love Letter for a Special Moment
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time Capsule to Future Self
            </span>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WrapCard />
          <GiftCard />
        </div>
        <div className="mt-6">
          <GiftsListCard />
        </div>
      </main>
    </div>
  );
}
