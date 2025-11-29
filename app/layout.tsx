import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Web3Provider } from "@/components/providers/web3-provider";
import { FheLoader } from "@/components/providers/fhe-loader";
import { FheProvider } from "@/components/providers/fhe-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { FloatingEmojis } from "@/components/layout/floating-emojis";
import "@/lib/suppress-warnings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gift - FHE Timed Gift System",
  description: "Send encrypted gifts with time locks using Zama FHE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-zinc-900 min-h-screen relative selection:bg-amber-500/30`}
      >
        {/* Ambient Background */}
        <div className="fixed inset-0 -z-20 h-full w-full bg-white">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-400/20 blur-[100px]" />
          <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-amber-400/20 blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] rounded-full bg-blue-400/20 blur-[100px]" />
        </div>

        {/* Floating Emojis Layer */}
        <FloatingEmojis />

        {/* Glass Overlay - 30% Opacity */}
        <div className="fixed inset-0 -z-10 h-full w-full bg-zinc-100/30 backdrop-blur-sm" />

        <FheLoader />
        <Web3Provider>
          <FheProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </FheProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
