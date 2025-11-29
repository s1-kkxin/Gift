import { expect } from "chai";
import { ethers, fhevm, network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GiftToken", function () {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let token: any;
  let tokenAddress: string;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  const ETH_AMOUNT = ethers.parseEther("1"); // 1 ETH
  const GIFT_AMOUNT = 1000000n; // 1 token (6 decimals)

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("GiftToken");
    token = await TokenFactory.deploy();
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
  });

  describe("Initialization", function () {
    it("should set token info correctly", async function () {
      expect(await token.name()).to.equal("Gift Token");
      expect(await token.symbol()).to.equal("GIFT");
    });

    it("initial gift count should be 0", async function () {
      expect(await token.giftCount()).to.equal(0);
    });
  });

  describe("ETH Wrapping (wrap)", function () {
    it("should wrap ETH into cGIFT tokens", async function () {
      await expect(token.wrap({ value: ETH_AMOUNT }))
        .to.emit(token, "Wrapped")
        .withArgs(owner.address, ETH_AMOUNT);

      // Verify encrypted balance exists
      const balanceHandle = await token.confidentialBalanceOf(owner.address);
      expect(balanceHandle).to.not.equal(ethers.ZeroHash);
    });

    it("should fail when wrapping 0 ETH", async function () {
      await expect(token.wrap({ value: 0 })).to.be.revertedWithCustomError(token, "InvalidAmount");
    });

    it("should fail when wrapping too small amount", async function () {
      // Less than 1e12 wei cannot convert to at least 1 token
      await expect(token.wrap({ value: 1000 })).to.be.revertedWithCustomError(token, "InvalidAmount");
    });
  });

  describe("ETH Unwrapping (unwrap)", function () {
    beforeEach(async function () {
      // First wrap some ETH
      await token.wrap({ value: ETH_AMOUNT });
    });

    it("should prepare unwrap", async function () {
      // Create encrypted input
      const encryptedInput = await fhevm.createEncryptedInput(tokenAddress, owner.address).add64(GIFT_AMOUNT).encrypt();

      const tx = await token.prepareUnwrap(encryptedInput.handles[0], encryptedInput.inputProof);
      const receipt = await tx.wait();

      // Verify event
      const event = receipt.logs.find((log: any) => {
        try {
          return token.interface.parseLog(log)?.name === "UnwrapPrepared";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });
  });

  describe("Create Gift (createGift)", function () {
    beforeEach(async function () {
      // Wrap ETH to get tokens
      await token.wrap({ value: ETH_AMOUNT });
    });

    it("should create timed gift with encrypted message", async function () {
      const unlockTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour later

      // Prepare encrypted input
      const encryptedInput = await fhevm
        .createEncryptedInput(tokenAddress, owner.address)
        .add64(GIFT_AMOUNT) // amount
        .add256(123456n) // msg1
        .add256(789012n) // msg2
        .add256(345678n) // msg3
        .encrypt();

      await expect(
        token.createGift(
          alice.address,
          encryptedInput.handles[0],
          encryptedInput.handles[1],
          encryptedInput.handles[2],
          encryptedInput.handles[3],
          unlockTime,
          encryptedInput.inputProof,
        ),
      )
        .to.emit(token, "GiftCreated")
        .withArgs(0, owner.address, alice.address, unlockTime);

      // Verify gift info
      const giftInfo = await token.getGiftInfo(0);
      expect(giftInfo.sender).to.equal(owner.address);
      expect(giftInfo.recipient).to.equal(alice.address);
      expect(giftInfo.unlockTime).to.equal(unlockTime);
      expect(giftInfo.opened).to.be.false;
      expect(giftInfo.claimed).to.be.false;
    });

    it("gift count should increase", async function () {
      const unlockTime = Math.floor(Date.now() / 1000) + 3600;

      const encryptedInput = await fhevm
        .createEncryptedInput(tokenAddress, owner.address)
        .add64(GIFT_AMOUNT)
        .add256(1n)
        .add256(2n)
        .add256(3n)
        .encrypt();

      await token.createGift(
        alice.address,
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        unlockTime,
        encryptedInput.inputProof,
      );

      expect(await token.giftCount()).to.equal(1);
    });

    it("sent and received lists should update", async function () {
      const unlockTime = Math.floor(Date.now() / 1000) + 3600;

      const encryptedInput = await fhevm
        .createEncryptedInput(tokenAddress, owner.address)
        .add64(GIFT_AMOUNT)
        .add256(1n)
        .add256(2n)
        .add256(3n)
        .encrypt();

      await token.createGift(
        alice.address,
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        unlockTime,
        encryptedInput.inputProof,
      );

      const sentGifts = await token.getSentGifts(owner.address);
      const receivedGifts = await token.getReceivedGifts(alice.address);

      expect(sentGifts).to.include(0n);
      expect(receivedGifts).to.include(0n);
    });
  });

  describe("Gift Opening Time Lock Tests", function () {
    let giftId: bigint;
    let futureUnlockTime: number;

    beforeEach(async function () {
      await token.wrap({ value: ETH_AMOUNT });

      // Create a gift that unlocks in 1 hour
      futureUnlockTime = Math.floor(Date.now() / 1000) + 3600;

      const encryptedInput = await fhevm
        .createEncryptedInput(tokenAddress, owner.address)
        .add64(GIFT_AMOUNT)
        .add256(111n)
        .add256(222n)
        .add256(333n)
        .encrypt();

      const tx = await token.createGift(
        alice.address,
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        futureUnlockTime,
        encryptedInput.inputProof,
      );
      await tx.wait();
      giftId = 0n;
    });

    it("should not open gift before unlock time", async function () {
      // Check if can open
      expect(await token.canOpen(giftId)).to.be.false;

      // Attempt to open should fail
      await expect(token.connect(alice).openGift(giftId)).to.be.revertedWithCustomError(token, "GiftLocked");
    });

    it("non-recipient should not open gift", async function () {
      // Bob tries to open Alice's gift
      await expect(token.connect(bob).openGift(giftId)).to.be.revertedWithCustomError(token, "NotRecipient");
    });

    it("timeUntilUnlock should return positive before unlock", async function () {
      const remaining = await token.timeUntilUnlock(giftId);
      expect(remaining).to.be.greaterThan(0);
    });

    it("should open gift after unlock time", async function () {
      // Fast forward time
      await network.provider.send("evm_increaseTime", [3601]);
      await network.provider.send("evm_mine");

      // Check if can open
      expect(await token.canOpen(giftId)).to.be.true;
      expect(await token.timeUntilUnlock(giftId)).to.equal(0);

      // Recipient opens gift
      await expect(token.connect(alice).openGift(giftId))
        .to.emit(token, "GiftOpened")
        .withArgs(
          giftId,
          alice.address,
          (v: any) => true,
          (v: any) => true,
        );

      // Verify gift status
      const giftInfo = await token.getGiftInfo(giftId);
      expect(giftInfo.opened).to.be.true;
    });

    it("should not open gift twice", async function () {
      // Fast forward and open
      await network.provider.send("evm_increaseTime", [3601]);
      await network.provider.send("evm_mine");

      await token.connect(alice).openGift(giftId);

      // Try to open again
      await expect(token.connect(alice).openGift(giftId)).to.be.revertedWithCustomError(token, "GiftAlreadyOpened");
    });
  });

  describe("Claim Gift Tests", function () {
    let giftId: bigint;

    beforeEach(async function () {
      await token.wrap({ value: ETH_AMOUNT });

      // Create an immediately unlockable gift
      const unlockTime = Math.floor(Date.now() / 1000) - 1; // Already expired

      const encryptedInput = await fhevm
        .createEncryptedInput(tokenAddress, owner.address)
        .add64(GIFT_AMOUNT)
        .add256(100n)
        .add256(200n)
        .add256(300n)
        .encrypt();

      await token.createGift(
        alice.address,
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        unlockTime,
        encryptedInput.inputProof,
      );
      giftId = 0n;
    });

    it("should not claim unopened gift", async function () {
      await expect(token.connect(alice).claimGift(giftId)).to.be.revertedWithCustomError(token, "GiftNotOpened");
    });

    it("should claim gift after opening", async function () {
      // First open the gift
      await token.connect(alice).openGift(giftId);

      // Claim gift
      await expect(token.connect(alice).claimGift(giftId))
        .to.emit(token, "GiftClaimed")
        .withArgs(giftId, alice.address);

      // Verify status
      const giftInfo = await token.getGiftInfo(giftId);
      expect(giftInfo.claimed).to.be.true;

      // Alice should have encrypted balance
      const aliceBalance = await token.confidentialBalanceOf(alice.address);
      expect(aliceBalance).to.not.equal(ethers.ZeroHash);
    });

    it("should not claim gift twice", async function () {
      await token.connect(alice).openGift(giftId);
      await token.connect(alice).claimGift(giftId);

      await expect(token.connect(alice).claimGift(giftId)).to.be.revertedWithCustomError(token, "GiftAlreadyClaimed");
    });

    it("non-recipient should not claim gift", async function () {
      await token.connect(alice).openGift(giftId);

      await expect(token.connect(bob).claimGift(giftId)).to.be.revertedWithCustomError(token, "NotRecipient");
    });
  });

  describe("Query Function Tests", function () {
    beforeEach(async function () {
      await token.wrap({ value: ETH_AMOUNT });

      // Create multiple gifts
      const unlockTime1 = Math.floor(Date.now() / 1000) - 1;
      const unlockTime2 = Math.floor(Date.now() / 1000) + 3600;

      const input1 = await fhevm
        .createEncryptedInput(tokenAddress, owner.address)
        .add64(100000n)
        .add256(1n)
        .add256(2n)
        .add256(3n)
        .encrypt();

      await token.createGift(
        alice.address,
        input1.handles[0],
        input1.handles[1],
        input1.handles[2],
        input1.handles[3],
        unlockTime1,
        input1.inputProof,
      );

      const input2 = await fhevm
        .createEncryptedInput(tokenAddress, owner.address)
        .add64(200000n)
        .add256(4n)
        .add256(5n)
        .add256(6n)
        .encrypt();

      await token.createGift(
        bob.address,
        input2.handles[0],
        input2.handles[1],
        input2.handles[2],
        input2.handles[3],
        unlockTime2,
        input2.inputProof,
      );
    });

    it("getMySentGifts should return sent gifts", async function () {
      const result = await token.getMySentGifts();
      expect(result.ids.length).to.equal(2);
      expect(result.recipients[0]).to.equal(alice.address);
      expect(result.recipients[1]).to.equal(bob.address);
    });

    it("getMyReceivedGifts should return received gifts", async function () {
      const result = await token.connect(alice).getMyReceivedGifts();
      expect(result.ids.length).to.equal(1);
      expect(result.senders[0]).to.equal(owner.address);
    });

    it("getGiftHandles should return handles", async function () {
      const handles = await token.getGiftHandles(0);
      expect(handles.amountHandle).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Complete Gift Flow Tests", function () {
    it("complete flow: wrap -> create gift -> wait -> open -> claim", async function () {
      // 1. Wrap ETH
      await token.wrap({ value: ETH_AMOUNT });

      // 2. Get current block time and create timed gift
      const block = await ethers.provider.getBlock("latest");
      const unlockTime = block!.timestamp + 100; // 100 seconds later
      const encryptedInput = await fhevm
        .createEncryptedInput(tokenAddress, owner.address)
        .add64(GIFT_AMOUNT)
        .add256(BigInt("0x48656c6c6f")) // "Hello"
        .add256(BigInt("0x576f726c64")) // "World"
        .add256(BigInt("0x21")) // "!"
        .encrypt();

      await token.createGift(
        alice.address,
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        unlockTime,
        encryptedInput.inputProof,
      );

      // 3. Verify cannot open before unlock time
      await expect(token.connect(alice).openGift(0)).to.be.revertedWithCustomError(token, "GiftLocked");

      // 4. Fast forward time
      await network.provider.send("evm_increaseTime", [101]);
      await network.provider.send("evm_mine");

      // 5. Open gift
      const openTx = await token.connect(alice).openGift(0);
      await openTx.wait();

      // 6. Claim gift
      const claimTx = await token.connect(alice).claimGift(0);
      await claimTx.wait();

      // 7. Verify Alice has encrypted balance
      const aliceBalance = await token.confidentialBalanceOf(alice.address);
      expect(aliceBalance).to.not.equal(ethers.ZeroHash);

      // 8. Verify gift status
      const giftInfo = await token.getGiftInfo(0);
      expect(giftInfo.opened).to.be.true;
      expect(giftInfo.claimed).to.be.true;
    });
  });
});
