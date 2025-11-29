"use client";

import { ConnectKitButton } from "connectkit";

export function ConnectButton() {
  return <ConnectKitButton />;
}

export function AccountButton() {
  return <ConnectKitButton />;
}

export function NetworkButton() {
  return <ConnectKitButton showBalance />;
}
