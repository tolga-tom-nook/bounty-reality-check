// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @notice Payment trigger for Bounty Reality Check on any EVM chain, including HyperEVM.
/// @dev Funds are forwarded directly to treasury; the contract is an event router, not custody.
contract HyperEVMScanPay {
    address public immutable treasury;
    address public immutable acceptedToken; // set to USDC/USDT token address; address(0) for native-only deploys

    enum Tier { Quick, Deep, Weekly }

    event ScanPaid(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed token,
        uint256 amount,
        Tier tier,
        string listingUrl,
        string callbackUrl
    );

    error BadTreasury();
    error BadAmount();
    error NativeForwardFailed();
    error TokenNotAccepted();
    error TokenTransferFailed();

    constructor(address _treasury, address _acceptedToken) {
        if (_treasury == address(0)) revert BadTreasury();
        treasury = _treasury;
        acceptedToken = _acceptedToken;
    }

    /// @notice Pay with native gas token. Emits event for the off-chain Hermes watcher.
    function payNative(bytes32 orderId, Tier tier, string calldata listingUrl, string calldata callbackUrl) external payable {
        if (msg.value == 0) revert BadAmount();
        (bool ok, ) = treasury.call{value: msg.value}("");
        if (!ok) revert NativeForwardFailed();
        emit ScanPaid(orderId, msg.sender, address(0), msg.value, tier, listingUrl, callbackUrl);
    }

    /// @notice Pay with the configured ERC-20, usually USDC/USDT on the deployment chain.
    /// Buyer/agent must approve this contract first. Funds forward directly to treasury.
    function payToken(bytes32 orderId, uint256 amount, Tier tier, string calldata listingUrl, string calldata callbackUrl) external {
        if (acceptedToken == address(0)) revert TokenNotAccepted();
        if (amount == 0) revert BadAmount();
        bool ok = IERC20(acceptedToken).transferFrom(msg.sender, treasury, amount);
        if (!ok) revert TokenTransferFailed();
        emit ScanPaid(orderId, msg.sender, acceptedToken, amount, tier, listingUrl, callbackUrl);
    }
}
