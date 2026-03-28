// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "lib/reactive-lib/src/abstract-base/AbstractCallback.sol";

/**
 * Destination contract (any EVM testnet).
 * Receives Reactive Network callbacks and awards points to the fan address.
 */
contract ComfortPointsCallback is AbstractCallback {
    event PointsAwarded(
        address indexed fan,
        uint256 pointsAdded,
        uint256 newPoints,
        bytes32 indexed originTxHash
    );

    mapping(address => uint256) public points;
    mapping(bytes32 => bool) public processedOriginTx;

    constructor(address _callbackSender) AbstractCallback(_callbackSender) payable {}

    /**
     * Callback entrypoint called via destination callback proxy.
     *
     * @param sender RVM ID (Reactive system passes the RVM identity here)
     * @param fan Fan address extracted from origin event topic1
     * @param pointsToAdd Calculated points derived from origin event amount
     * @param originTxHash Origin chain tx hash (for idempotency)
     */
    function awardPoints(
        address sender,
        address fan,
        uint256 pointsToAdd,
        bytes32 originTxHash
    ) external authorizedSenderOnly rvmIdOnly(sender) {
        require(!processedOriginTx[originTxHash], "origin tx already processed");
        processedOriginTx[originTxHash] = true;

        uint256 newPoints = points[fan] + pointsToAdd;
        points[fan] = newPoints;

        emit PointsAwarded(fan, pointsToAdd, newPoints, originTxHash);
    }
}

