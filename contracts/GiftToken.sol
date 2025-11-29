// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, euint256, externalEuint64, externalEuint256} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "openzeppelin-confidential-contracts/contracts/token/ERC7984/ERC7984.sol";

/// @title GiftToken - FHE-based timed gift system with confidential tokens
/// @notice Wrap ETH into confidential tokens, create timed gifts with encrypted messages
contract GiftToken is ZamaEthereumConfig, ERC7984 {
    // Gift structure
    struct Gift {
        address sender;
        address recipient;
        euint64 amount;
        euint256 msg1; // 31 bytes
        euint256 msg2; // 31 bytes
        euint256 msg3; // 31 bytes (total ~93 chars)
        uint256 unlockTime;
        bool opened;
        bool claimed;
    }

    // Gift storage
    mapping(uint256 => Gift) private _gifts;
    uint256 private _giftCounter;

    // Track user's sent and received gifts
    mapping(address => uint256[]) private _sentGifts;
    mapping(address => uint256[]) private _receivedGifts;

    // Store handles for decryption verification
    mapping(uint256 => bytes32) private _amountHandles;
    mapping(uint256 => bytes32[3]) private _messageHandles;

    // ETH locked for each gift
    mapping(uint256 => uint256) private _giftEthLocked;

    // Pending unwrap requests: handle => requester
    mapping(bytes32 => address) private _unwrapRequester;

    // Events
    event Wrapped(address indexed user, uint256 ethAmount);
    event Unwrapped(address indexed user, uint256 ethAmount);
    event UnwrapPrepared(address indexed user, bytes32 handle);
    event GiftCreated(uint256 indexed giftId, address indexed sender, address indexed recipient, uint256 unlockTime);
    event GiftOpened(
        uint256 indexed giftId,
        address indexed recipient,
        bytes32 amountHandle,
        bytes32[3] messageHandles
    );
    event GiftClaimed(uint256 indexed giftId, address indexed recipient);

    // Errors
    error InvalidAmount();
    error GiftNotFound();
    error NotRecipient();
    error GiftLocked();
    error GiftAlreadyOpened();
    error GiftNotOpened();
    error GiftAlreadyClaimed();
    error TransferFailed();

    constructor() ERC7984("Gift Token", "GIFT", "https://gift.zama.io/token") {}

    /// @notice Wrap ETH into confidential cGIFT tokens (1:1)
    function wrap() external payable {
        if (msg.value == 0) revert InvalidAmount();

        // 1 ETH = 1_000_000 tokens (6 decimals)
        uint64 tokenAmount = uint64(msg.value / 1e12);
        if (tokenAmount == 0) revert InvalidAmount();

        euint64 encryptedAmount = FHE.asEuint64(tokenAmount);
        _mint(msg.sender, encryptedAmount);

        emit Wrapped(msg.sender, msg.value);
    }

    /// @notice Create a timed gift with encrypted amount and message (3 parts, ~93 chars)
    function createGift(
        address recipient,
        externalEuint64 encryptedAmount,
        externalEuint256 encryptedMsg1,
        externalEuint256 encryptedMsg2,
        externalEuint256 encryptedMsg3,
        uint256 unlockTime,
        bytes calldata inputProof
    ) external returns (uint256 giftId) {
        if (recipient == address(0)) revert InvalidAmount();

        // Verify and convert encrypted inputs
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        euint256 m1 = FHE.fromExternal(encryptedMsg1, inputProof);
        euint256 m2 = FHE.fromExternal(encryptedMsg2, inputProof);
        euint256 m3 = FHE.fromExternal(encryptedMsg3, inputProof);

        // Transfer tokens from sender to contract
        euint64 transferred = _transfer(msg.sender, address(this), amount);

        // Create gift
        giftId = _giftCounter++;
        _gifts[giftId] = Gift({
            sender: msg.sender,
            recipient: recipient,
            amount: transferred,
            msg1: m1,
            msg2: m2,
            msg3: m3,
            unlockTime: unlockTime,
            opened: false,
            claimed: false
        });

        // Store handles
        _amountHandles[giftId] = euint64.unwrap(transferred);
        _messageHandles[giftId] = [euint256.unwrap(m1), euint256.unwrap(m2), euint256.unwrap(m3)];

        // Grant contract access
        FHE.allowThis(transferred);
        FHE.allowThis(m1);
        FHE.allowThis(m2);
        FHE.allowThis(m3);

        // Track gifts
        _sentGifts[msg.sender].push(giftId);
        _receivedGifts[recipient].push(giftId);

        emit GiftCreated(giftId, msg.sender, recipient, unlockTime);
    }

    /// @notice Step 1: Open gift - grant access to recipient for private decryption
    function openGift(uint256 giftId) external returns (bytes32 amountHandle, bytes32[3] memory messageHandles) {
        Gift storage gift = _gifts[giftId];

        if (gift.sender == address(0)) revert GiftNotFound();
        if (msg.sender != gift.recipient) revert NotRecipient();
        if (block.timestamp < gift.unlockTime) revert GiftLocked();
        if (gift.opened) revert GiftAlreadyOpened();

        gift.opened = true;

        // Grant access to recipient for private decryption
        FHE.allow(gift.amount, msg.sender);
        FHE.allow(gift.msg1, msg.sender);
        FHE.allow(gift.msg2, msg.sender);
        FHE.allow(gift.msg3, msg.sender);

        amountHandle = euint64.unwrap(gift.amount);
        messageHandles = [euint256.unwrap(gift.msg1), euint256.unwrap(gift.msg2), euint256.unwrap(gift.msg3)];

        _amountHandles[giftId] = amountHandle;
        _messageHandles[giftId] = messageHandles;

        emit GiftOpened(giftId, msg.sender, amountHandle, messageHandles);
    }

    /// @notice Step 2: Claim gift - transfer confidential amount to recipient
    function claimGift(uint256 giftId) external {
        Gift storage gift = _gifts[giftId];

        if (gift.sender == address(0)) revert GiftNotFound();
        if (msg.sender != gift.recipient) revert NotRecipient();
        if (!gift.opened) revert GiftNotOpened();
        if (gift.claimed) revert GiftAlreadyClaimed();

        gift.claimed = true;

        // Transfer encrypted amount to recipient
        _transfer(address(this), msg.sender, gift.amount);

        emit GiftClaimed(giftId, msg.sender);
    }

    /// @notice Step 1/2: Prepare unwrap by burning confidential balance and making it publicly decryptable.
    /// @dev Uses standard public decryption flow. Frontend must call finalizeUnwrap after obtaining proofs.
    function prepareUnwrap(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bytes32 handle) {
        // Verify input and convert to euint64
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Burn immediately to prevent double-spend
        euint64 burned = _burn(msg.sender, amount);

        // Expose ciphertext for public decryption and store handle
        FHE.makePubliclyDecryptable(burned);
        handle = euint64.unwrap(burned);
        _unwrapRequester[handle] = msg.sender;

        emit UnwrapPrepared(msg.sender, handle);
    }

    /// @notice Step 2/2: Finalize unwrap after relayer returns cleartexts and proof.
    /// @param handle The handle returned by prepareUnwrap
    /// @param cleartexts ABI-encoded clear amount: abi.encode(uint64)
    /// @param decryptionProof Proof returned by Relayer SDK publicDecrypt
    function finalizeUnwrap(bytes32 handle, bytes calldata cleartexts, bytes calldata decryptionProof) external {
        address user = _unwrapRequester[handle];
        if (user == address(0)) revert GiftNotFound(); // reuse error to avoid adding new one
        if (msg.sender != user) revert NotRecipient();

        // Verify signatures for the provided handle and cleartexts
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        // Decode clear amount and transfer ETH
        uint64 clearAmount = abi.decode(cleartexts, (uint64));

        delete _unwrapRequester[handle];

        uint256 ethAmount = uint256(clearAmount) * 1e12;
        (bool success, ) = payable(user).call{value: ethAmount}("");
        if (!success) revert TransferFailed();

        emit Unwrapped(user, ethAmount);
    }

    // View functions

    /// @notice Get gift basic info
    function getGiftInfo(
        uint256 giftId
    ) external view returns (address sender, address recipient, uint256 unlockTime, bool opened, bool claimed) {
        Gift storage gift = _gifts[giftId];
        return (gift.sender, gift.recipient, gift.unlockTime, gift.opened, gift.claimed);
    }

    /// @notice Get handles for decryption
    function getGiftHandles(
        uint256 giftId
    ) external view returns (bytes32 amountHandle, bytes32[3] memory messageHandles) {
        return (_amountHandles[giftId], _messageHandles[giftId]);
    }

    /// @notice Get user's sent gift IDs
    function getSentGifts(address user) external view returns (uint256[] memory) {
        return _sentGifts[user];
    }

    /// @notice Get user's received gift IDs
    function getReceivedGifts(address user) external view returns (uint256[] memory) {
        return _receivedGifts[user];
    }

    /// @notice Get total gift count
    function giftCount() external view returns (uint256) {
        return _giftCounter;
    }

    /// @notice Check if gift is ready to open
    function canOpen(uint256 giftId) external view returns (bool) {
        Gift storage gift = _gifts[giftId];
        return gift.sender != address(0) && !gift.opened && block.timestamp >= gift.unlockTime;
    }

    /// @notice Get time remaining until unlock (0 if already unlocked)
    function timeUntilUnlock(uint256 giftId) external view returns (uint256) {
        Gift storage gift = _gifts[giftId];
        if (gift.sender == address(0)) return 0;
        if (block.timestamp >= gift.unlockTime) return 0;
        return gift.unlockTime - block.timestamp;
    }

    /// @notice Get my sent gifts with details
    function getMySentGifts()
        external
        view
        returns (
            uint256[] memory ids,
            address[] memory recipients,
            uint256[] memory unlockTimes,
            bool[] memory openedList,
            bool[] memory claimedList
        )
    {
        uint256[] memory giftIds = _sentGifts[msg.sender];
        uint256 len = giftIds.length;

        ids = giftIds;
        recipients = new address[](len);
        unlockTimes = new uint256[](len);
        openedList = new bool[](len);
        claimedList = new bool[](len);

        for (uint256 i = 0; i < len; i++) {
            Gift storage gift = _gifts[giftIds[i]];
            recipients[i] = gift.recipient;
            unlockTimes[i] = gift.unlockTime;
            openedList[i] = gift.opened;
            claimedList[i] = gift.claimed;
        }
    }

    /// @notice Get my received gifts with details
    function getMyReceivedGifts()
        external
        view
        returns (
            uint256[] memory ids,
            address[] memory senders,
            uint256[] memory unlockTimes,
            bool[] memory openedList,
            bool[] memory claimedList
        )
    {
        uint256[] memory giftIds = _receivedGifts[msg.sender];
        uint256 len = giftIds.length;

        ids = giftIds;
        senders = new address[](len);
        unlockTimes = new uint256[](len);
        openedList = new bool[](len);
        claimedList = new bool[](len);

        for (uint256 i = 0; i < len; i++) {
            Gift storage gift = _gifts[giftIds[i]];
            senders[i] = gift.sender;
            unlockTimes[i] = gift.unlockTime;
            openedList[i] = gift.opened;
            claimedList[i] = gift.claimed;
        }
    }

    // Receive ETH
    receive() external payable {}
}
