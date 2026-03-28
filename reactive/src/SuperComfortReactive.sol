// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "lib/reactive-lib/src/interfaces/IReactive.sol";
import "lib/reactive-lib/src/abstract-base/AbstractReactive.sol";

/**
 * Reactive contract (deploy on Reactive Lasna Testnet).
 *
 * Listens to CapsuleNFT.SuperComfortSent on Sepolia and triggers a cross-chain callback
 * to award points on the destination chain.
 *
 * Origin event:
 *   event SuperComfortSent(address indexed fan, string message, uint256 amount);
 *
 * topics:
 *   topic_0 = keccak256("SuperComfortSent(address,string,uint256)")
 *   topic_1 = indexed fan address (left-padded)
 *
 * data:
 *   abi.encode(message, amount)
 */
contract SuperComfortReactive is IReactive, AbstractReactive {
    uint256 public immutable originChainId;
    uint256 public immutable destinationChainId;
    address public immutable originContract;
    address public immutable destinationCallback;
    uint256 public immutable superComfortTopic0;

    uint64 public constant CALLBACK_GAS_LIMIT = 700_000;

    // Example points rule: points = amount / 1e14 (so 0.0001 ETH -> 1 point)
    uint256 public constant POINTS_DENOMINATOR = 1e14;

    constructor(
        uint256 _originChainId,
        uint256 _destinationChainId,
        address _originContract,
        uint256 _superComfortTopic0,
        address _destinationCallback
    ) payable {
        originChainId = _originChainId;
        destinationChainId = _destinationChainId;
        originContract = _originContract;
        superComfortTopic0 = _superComfortTopic0;
        destinationCallback = _destinationCallback;

        // Subscribe only on the top-level Reactive Network instance (not in ReactVM).
        if (!vm) {
            service.subscribe(
                originChainId,
                originContract,
                superComfortTopic0,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );
        }
    }

    function react(LogRecord calldata log) external vmOnly {
        // Defensive checks (subscription should already filter these).
        if (log.chain_id != originChainId) return;
        if (log._contract != originContract) return;
        if (log.topic_0 != superComfortTopic0) return;

        // Decode non-indexed args: (message, amount)
        (, uint256 amount) = abi.decode(log.data, (string, uint256));

        // Extract indexed fan address from topic_1
        address fan = address(uint160(log.topic_1));

        uint256 pointsToAdd = amount / POINTS_DENOMINATOR;
        if (pointsToAdd == 0) return;

        bytes32 originTxHash = bytes32(log.tx_hash);

        bytes memory payload = abi.encodeWithSignature(
            "awardPoints(address,address,uint256,bytes32)",
            address(0),
            fan,
            pointsToAdd,
            originTxHash
        );

        emit Callback(destinationChainId, destinationCallback, CALLBACK_GAS_LIMIT, payload);
    }
}

