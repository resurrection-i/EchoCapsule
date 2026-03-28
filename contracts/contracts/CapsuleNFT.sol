// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface ISVGRenderer {
    function renderSVG(
        uint8 emotionId,
        string memory photoCid,
        string memory idolName,
        uint256 tokenId
    ) external view returns (string memory);
}

/**
 * @title CapsuleNFT
 * @notice 偶像情绪胶囊 NFT 主合约 — ERC-721 + EIP-712 签名验证 + 全链上 SVG 渲染
 */
contract CapsuleNFT is ERC721, EIP712, Ownable {
    using Strings for uint256;
    using ECDSA for bytes32;

    // ========== 数据结构 ==========
    struct CapsuleState {
        uint8 emotionId;       // 情绪编号 0-4
        string photoCid;       // 偶像照片 IPFS 哈希
        uint8 musicId;         // 预设音乐索引
        uint256 lastUpdated;   // 上次更新时间戳
        string moodText;       // 心情文字
    }

    // ========== 状态变量 ==========
    uint256 private _nextTokenId;
    ISVGRenderer public renderer;
    address public idol;                          // 偶像地址
    string public idolName;                       // 偶像名称
    uint256 public mintPrice;                     // Mint 价格
    uint256 public constant COOLDOWN = 10 minutes; // 冷却时间
    uint256 public maxSupply;                     // 最大发行量
    mapping(uint256 => CapsuleState) public states;
    mapping(address => uint256) public nonces;    // EIP-712 防重放
    string[] public musicCids;                    // 预设音乐库 IPFS CID

    // 全局情绪状态（偶像当前情绪，所有 NFT 共享）
    CapsuleState public globalState;

    // ========== EIP-712 类型哈希 ==========
    bytes32 public constant UPDATE_TYPEHASH = keccak256(
        "EmotionUpdate(uint8 emotionId,string photoCid,uint8 musicId,string moodText,uint256 nonce,uint256 deadline)"
    );

    // ========== 事件 ==========
    event Minted(address indexed to, uint256 indexed tokenId);
    event EmotionUpdated(
        uint8 emotionId,
        string photoCid,
        uint8 musicId,
        string moodText,
        uint256 timestamp
    );
    event RendererUpdated(address newRenderer);
    event ComfortSent(address indexed fan, uint256 timestamp);
    event SuperComfortSent(address indexed fan, string message, uint256 amount);

    // ========== 构造函数 ==========
    constructor(
        string memory _idolName,
        address _idol,
        address _renderer,
        uint256 _mintPrice,
        uint256 _maxSupply
    )
        ERC721("IdolCapsule", "CAPSULE")
        EIP712("IdolCapsule", "1")
        Ownable(msg.sender)
    {
        idolName = _idolName;
        idol = _idol;
        renderer = ISVGRenderer(_renderer);
        mintPrice = _mintPrice;
        maxSupply = _maxSupply;

        // 初始状态：营业中
        globalState = CapsuleState({
            emotionId: 3,
            photoCid: "",
            musicId: 0,
            lastUpdated: block.timestamp,
            moodText: "Hello World!"
        });
    }

    // ========== Mint ==========
    function mint() external payable {
        require(_nextTokenId < maxSupply, "Sold out");
        require(msg.value >= mintPrice, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId);
    }

    // ========== 偶像情绪更新（EIP-712 签名） ==========
    function updateIdolState(
        uint8 emotionId,
        string calldata photoCid,
        uint8 musicId,
        string calldata moodText,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "Signature expired");
        require(emotionId <= 4, "Invalid emotionId");
        require(
            block.timestamp >= globalState.lastUpdated + COOLDOWN,
            "Cooldown not elapsed"
        );

        // 构造 EIP-712 哈希
        bytes32 structHash = keccak256(abi.encode(
            UPDATE_TYPEHASH,
            emotionId,
            keccak256(bytes(photoCid)),
            musicId,
            keccak256(bytes(moodText)),
            nonces[idol],
            deadline
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == idol, "Invalid idol signature");

        // 更新 nonce
        nonces[idol]++;

        // 更新全局状态
        globalState = CapsuleState({
            emotionId: emotionId,
            photoCid: photoCid,
            musicId: musicId,
            lastUpdated: block.timestamp,
            moodText: moodText
        });

        emit EmotionUpdated(emotionId, photoCid, musicId, moodText, block.timestamp);
    }

    // ========== 粉丝安慰 ==========
    function sendComfort() external {
        require(balanceOf(msg.sender) > 0, "Must hold a capsule NFT");
        emit ComfortSent(msg.sender, block.timestamp);
    }

    // ========== 深度共鸣（付费链上留言）==========
    function superComfort(string calldata message) external payable {
        require(msg.value >= 0.0001 ether, "Insufficient payment");
        require(bytes(message).length > 0, "Message cannot be empty");
        require(bytes(message).length <= 300, "Message too long");
        emit SuperComfortSent(msg.sender, message, msg.value);
    }

    // ========== 全链上 tokenURI ==========
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory svg = renderer.renderSVG(
            globalState.emotionId,
            globalState.photoCid,
            idolName,
            tokenId
        );

        string memory musicUrl = globalState.musicId < musicCids.length
            ? string(abi.encodePacked("https://ipfs.io/ipfs/", musicCids[globalState.musicId]))
            : "";

        string memory json = string(abi.encodePacked(
            '{"name":"', idolName, ' Capsule #', tokenId.toString(),
            '","description":"A living NFT reflecting idol emotion.',
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)),
            '","animation_url":"', musicUrl,
            '","attributes":[{"trait_type":"Emotion","value":"', _emotionLabel(globalState.emotionId),
            '"},{"trait_type":"Music ID","value":"', uint256(globalState.musicId).toString(),
            '"},{"trait_type":"Mood","value":"', globalState.moodText,
            '"}]}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // ========== 管理函数 ==========
    function setRenderer(address _renderer) external onlyOwner {
        renderer = ISVGRenderer(_renderer);
        emit RendererUpdated(_renderer);
    }

    function setIdol(address _idol) external onlyOwner {
        idol = _idol;
    }

    function addMusic(string calldata cid) external onlyOwner {
        musicCids.push(cid);
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // ========== 查询函数 ==========
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function getGlobalState() external view returns (
        uint8 emotionId,
        string memory photoCid,
        uint8 musicId,
        uint256 lastUpdated,
        string memory moodText
    ) {
        return (
            globalState.emotionId,
            globalState.photoCid,
            globalState.musicId,
            globalState.lastUpdated,
            globalState.moodText
        );
    }

    function getMusicCount() external view returns (uint256) {
        return musicCids.length;
    }

    // ========== 内部函数 ==========
    function _emotionLabel(uint8 emotionId) internal pure returns (string memory) {
        if (emotionId == 0) return "Emo";
        if (emotionId == 1) return "Tired";
        if (emotionId == 2) return "Neutral";
        if (emotionId == 3) return "Active";
        if (emotionId == 4) return "Happy";
        return "Unknown";
    }

    // ========== EIP-712 域信息 ==========
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
