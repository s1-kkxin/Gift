import GiftTokenABI from "./abi/GiftToken.json";

export const GIFT_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_GIFT_TOKEN_ADDRESS as `0x${string}`;

export const giftTokenConfig = {
  address: GIFT_TOKEN_ADDRESS,
  abi: GiftTokenABI.abi,
} as const;
