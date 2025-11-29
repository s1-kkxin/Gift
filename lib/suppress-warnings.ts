// Filter noisy warnings from third-party libraries
if (typeof window !== "undefined") {
  const originalError = console.error;
  const originalWarn = console.warn;

  const ignoredPatterns = [
    "WebSocket connection to",
    "Failed to fetch",
    "svg attribute",
    "<svg>",
    "Cross-Origin-Opener-Policy",
    "Lit is in dev mode",
    "Analytics SDK",
    "scheduled an update",
    "React DevTools",
    "Base Account SDK",
    "Discarding cache",
    "HMR",
    "Fast Refresh",
    "Unexpected end of attribute",
  ];

  const shouldIgnore = (args: unknown[]) => {
    const msg = String(args[0] || "");
    return ignoredPatterns.some((p) => msg.includes(p));
  };

  console.error = (...args) => {
    if (!shouldIgnore(args)) originalError.apply(console, args);
  };

  console.warn = (...args) => {
    if (!shouldIgnore(args)) originalWarn.apply(console, args);
  };
}

export {};
