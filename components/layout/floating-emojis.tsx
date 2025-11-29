"use client";

import { useEffect, useState } from "react";

const EMOJIS = ["🎁", "🍭", "🍬", "❤️", "💜"];

export function FloatingEmojis() {
  const [isMounted, setIsMounted] = useState(false);
  const [items, setItems] = useState<Array<{
    id: number;
    emoji: string;
    left: number;
    top: number;
    duration: number;
    delay: number;
    scale: number;
  }>>([]);

  useEffect(() => {
    setIsMounted(true);
    // Generate random items only on client side to avoid hydration mismatch
    const newItems = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 15 + Math.random() * 25, // 15-40s duration
      delay: Math.random() * -30, // Negative delay to start mid-animation
      scale: 0.5 + Math.random() * 1.2, // 0.5x to 1.7x size
    }));
    setItems(newItems);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 z-[-15] overflow-hidden pointer-events-none select-none">
       {items.map((item) => (
         <div
           key={item.id}
           className="absolute animate-float will-change-transform"
           style={{
             left: `${item.left}%`,
             top: `${item.top}%`,
             fontSize: '5rem',
             animationDuration: `${item.duration}s`,
             animationDelay: `${item.delay}s`,
             transform: `scale(${item.scale})`,
           }}
         >
           {item.emoji}
         </div>
       ))}
    </div>
  );
}
