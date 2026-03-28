// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title SVGRenderer
 * @notice 负责根据情绪状态动态拼接 SVG 图像的渲染合约（策略模式）
 */
contract SVGRenderer is Ownable {
    using Strings for uint256;

    // 情绪配色表：0=绝望, 1=疲惫, 2=平静, 3=营业, 4=兴奋
    string[5] private _emotionColors;
    string[5] private _emotionLabels;
    string[5] private _glowColors;

    constructor() Ownable(msg.sender) {
        _emotionColors[0] = "#1A1A2E";
        _emotionColors[1] = "#4A4E69";
        _emotionColors[2] = "#D6D2D2";
        _emotionColors[3] = "#FFD700";
        _emotionColors[4] = "#FFB7B2";

        _emotionLabels[0] = "EMO";
        _emotionLabels[1] = "TIRED";
        _emotionLabels[2] = "NEUTRAL";
        _emotionLabels[3] = "ACTIVE";
        _emotionLabels[4] = "HAPPY";

        _glowColors[0] = "rgba(26,26,46,0.6)";
        _glowColors[1] = "rgba(74,78,105,0.4)";
        _glowColors[2] = "rgba(214,210,210,0.3)";
        _glowColors[3] = "rgba(255,215,0,0.5)";
        _glowColors[4] = "rgba(255,183,178,0.8)";
    }

    /**
     * @notice 渲染完整 SVG 字符串
     * @param emotionId 情绪编号 0-4
     * @param photoCid IPFS 照片哈希
     * @param idolName 偶像名称
     * @param tokenId NFT tokenId
     */
    function renderSVG(
        uint8 emotionId,
        string memory photoCid,
        string memory idolName,
        uint256 tokenId
    ) external view returns (string memory) {
        require(emotionId <= 4, "Invalid emotionId");

        string memory color = _emotionColors[emotionId];
        string memory label = _emotionLabels[emotionId];
        string memory glow = _glowColors[emotionId];

        string memory imageHref = bytes(photoCid).length > 0
            ? string(abi.encodePacked("https://ipfs.io/ipfs/", photoCid))
            : "";

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">',
            '<defs>',
            '<radialGradient id="bg"><stop offset="0%" stop-color="', glow, '"/><stop offset="100%" stop-color="transparent"/></radialGradient>',
            '<clipPath id="photo-clip"><rect x="40" y="60" width="320" height="320" rx="20"/></clipPath>',
            '</defs>',
            '<rect width="400" height="500" rx="40" fill="black"/>',
            '<rect width="400" height="500" rx="40" fill="url(#bg)"/>',
            _renderFrame(color),
            _renderImage(imageHref),
            _renderText(idolName, color, label, tokenId),
            '</svg>'
        ));
    }

    function _renderFrame(string memory color) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<rect x="10" y="10" width="380" height="480" rx="40" stroke="', color,
            '" stroke-width="4" fill="none"/>'
        ));
    }

    function _renderImage(string memory imageHref) internal pure returns (string memory) {
        if (bytes(imageHref).length == 0) {
            return '<rect x="40" y="60" width="320" height="320" rx="20" fill="#333"/>';
        }
        return string(abi.encodePacked(
            '<image href="', imageHref,
            '" x="40" y="60" width="320" height="320" clip-path="url(#photo-clip)" preserveAspectRatio="xMidYMid slice"/>'
        ));
    }

    function _renderText(
        string memory idolName,
        string memory color,
        string memory label,
        uint256 tokenId
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<text x="50" y="420" fill="white" font-size="24" font-weight="bold" font-family="sans-serif">', idolName, '</text>',
            '<text x="50" y="455" fill="', color, '" font-size="14" font-family="monospace" letter-spacing="3">STATUS: ', label, '</text>',
            '<text x="50" y="480" fill="#666" font-size="12" font-family="monospace">#', tokenId.toString(), '</text>'
        ));
    }

    function setEmotionColor(uint8 emotionId, string calldata color) external onlyOwner {
        require(emotionId <= 4, "Invalid emotionId");
        _emotionColors[emotionId] = color;
    }

    function setEmotionLabel(uint8 emotionId, string calldata label) external onlyOwner {
        require(emotionId <= 4, "Invalid emotionId");
        _emotionLabels[emotionId] = label;
    }
}
