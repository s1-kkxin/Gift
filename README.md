# Gift - Time-Locked Encrypted Gifts on FHE

A time-locked encrypted gift system built on Zama FHEVM. Wrap ETH into confidential tokens, send encrypted gifts with secret messages. Recipients can only obtain decryption permission (ACL) and open the gift after the unlock time.

It can be:
- A mysterious gift for a future holiday
- A love letter that can only be read at a special moment
- A time capsule written to your future self

## Core Features

- **Encrypted Amount** - Nobody knows how much is inside until opened
- **Encrypted Message** - Secret messages (~93 characters) stay encrypted on-chain
- **Time-Lock** - Recipients can only unlock after the specified time
- **Private Decryption** - Only the recipient can decrypt using `userDecrypt`

## How Time-Locked Decryption Works

The core innovation is using FHE access control as a time-lock mechanism:

```
1. CREATE GIFT (Sender)
   ├─ Encrypt amount (euint64) + message (3× euint256)
   ├─ Set unlock timestamp
   ├─ FHE.allowThis() → Contract holds decryption rights
   └─ Recipient has NO access yet

2. WAIT... (Time passes)
   └─ Gift sits encrypted, nobody can decrypt

3. OPEN GIFT (Recipient, after unlockTime)
   ├─ Contract checks: block.timestamp >= unlockTime
   ├─ FHE.allow(amount, recipient)
   ├─ FHE.allow(msg1, recipient)
   ├─ FHE.allow(msg2, recipient)
   └─ FHE.allow(msg3, recipient) → Recipient gains access

4. DECRYPT (Recipient)
   ├─ Generate keypair
   ├─ Sign EIP-712 request
   ├─ Call userDecrypt() via Relayer SDK
   └─ See decrypted amount + message

5. CLAIM (Recipient)
   └─ Transfer confidential tokens to recipient wallet
```


## ETH Wrapping & Unwrapping

Gift tokens are backed 1:1 by ETH, using a wrap/unwrap mechanism:

### Wrap ETH → cGIFT (Confidential)

```
ETH ──────────────────────────────────────────────► cGIFT
     │                                                 │
     │  1. Send ETH to contract                        │
     │  2. Contract mints euint64 tokens               │
     │  3. Encrypted balance (invisible to others)     │
     │                                                 │
     │  Rate: 1 ETH = 1 cGIFT (1:1, 6 decimal precision) │
     └─────────────────────────────────────────────────┘
```

### Unwrap cGIFT → ETH (Two-Step Process)

```
cGIFT ─────────────────────────────────────────────► ETH
      │                                                │
      │  Step 1: prepareUnwrap()                       │
      │  ├─ Submit encrypted amount                    │
      │  ├─ Burn cGIFT immediately (prevent double-spend)
      │  ├─ FHE.makePubliclyDecryptable()              │
      │  └─ Return handle for decryption               │
      │                                                │
      │  Step 2: finalizeUnwrap()                      │
      │  ├─ Frontend calls publicDecrypt(handle)       │
      │  ├─ Get cleartext + proof from Relayer         │
      │  ├─ Submit proof to contract                   │
      │  ├─ FHE.checkSignatures() verifies proof       │
      │  └─ Transfer ETH back to user                  │
      │                                                │
      └────────────────────────────────────────────────┘
```

**Why two steps?** FHEVM v0.9 requires on-chain state change before decryption, then on-chain verification after. This ensures the decryption is authentic and prevents manipulation.

## Smart Contract

### Core Functions

| Function | Description |
|----------|-------------|
| `wrap()` | Deposit ETH, receive encrypted cGIFT tokens |
| `createGift()` | Create time-locked gift with encrypted amount + message |
| `openGift()` | Unlock gift (requires time passed), grants decrypt permission |
| `claimGift()` | Transfer decrypted tokens to recipient |
| `prepareUnwrap()` | Burn cGIFT, prepare for ETH withdrawal |
| `finalizeUnwrap()` | Verify decryption proof, receive ETH |

### Data Structure

```solidity
struct Gift {
    address sender;
    address recipient;
    euint64 amount;      // Encrypted gift amount
    euint256 msg1;       // Encrypted message part 1 (31 bytes)
    euint256 msg2;       // Encrypted message part 2 (31 bytes)
    euint256 msg3;       // Encrypted message part 3 (31 bytes)
    uint256 unlockTime;  // When gift can be opened
    bool opened;
    bool claimed;
}
```

### Message Capacity

Using 3× `euint256` fields allows ~93 character messages:
- Each `euint256` stores 31 bytes (256 bits - 8 bits reserved)
- 3 parts × 31 bytes = 93 bytes ≈ 93 ASCII characters
- UTF-8 characters may use 1-4 bytes each

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **Wallet:** RainbowKit + Wagmi v2
- **FHE SDK:** Zama Relayer SDK 0.3.0-5 (CDN)

### Blockchain
- **Contracts:** Solidity ^0.8.27
- **FHE:** Zama FHEVM v0.9 + OpenZeppelin Confidential Contracts
- **Token Standard:** ERC7984
- **Network:** Ethereum Sepolia

## Getting Started

### Prerequisites

```bash
Node.js >= 18.0.0
pnpm (recommended)
```

### Installation

```bash
# Clone repository
git clone <repository-url>
cd gift

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your settings
```

### Environment Variables

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_GIFT_TOKEN_ADDRESS=0x...
```

### Development

```bash
pnpm dev
# Open http://localhost:3000
```

### Production Build

```bash
pnpm build
pnpm start
```

## Project Structure

```
gift/
├── app/
│   ├── page.tsx              # Main page
│   ├── layout.tsx            # Root layout with providers
│   └── globals.css           # Global styles
├── components/
│   ├── gift/
│   │   ├── wrap-card.tsx     # Wrap/Unwrap ETH
│   │   ├── gift-card.tsx     # Create new gift
│   │   ├── gifts-list-card.tsx # View received gifts
│   │   └── open-gift-modal.tsx # Open & decrypt gift
│   ├── providers/
│   │   ├── fhe-provider.tsx  # FHE SDK context
│   │   └── toast-provider.tsx # Notification system
│   └── layout/
│       └── header.tsx        # Navigation header
├── lib/
│   ├── contracts.ts          # Contract config
│   ├── fhe-sdk.ts           # FHE utilities
│   └── abi/
│       └── GiftToken.json    # Contract ABI
└── public/                   # Static assets
```

## Security Considerations

- **Time-Lock Enforcement:** On-chain `block.timestamp` check prevents early opening
- **Double-Spend Prevention:** Tokens burned immediately during unwrap preparation
- **Private Decryption:** `userDecrypt` requires recipient's signature, ensuring only they can decrypt
- **Proof Verification:** `FHE.checkSignatures` validates all decryption results

## Use Cases

- **Birthday/Holiday Gifts:** Schedule gifts to be opened on special dates
- **Milestone Rewards:** Unlock bonuses at project milestones
- **Time Capsules:** Send messages to future selves
- **Escrow-like Payments:** Release funds only after a specific date

---
