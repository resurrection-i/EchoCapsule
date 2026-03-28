const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// ─────────────────────────────────────────────────────────────────────────────
// 辅助函数：构造 EIP-712 签名
// ─────────────────────────────────────────────────────────────────────────────
async function signEmotionUpdate(signer, contractAddr, params) {
  const domain = {
    name: "IdolCapsule",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: contractAddr,
  };

  const types = {
    EmotionUpdate: [
      { name: "emotionId",  type: "uint8"   },
      { name: "photoCid",   type: "string"  },
      { name: "musicId",    type: "uint8"   },
      { name: "moodText",   type: "string"  },
      { name: "nonce",      type: "uint256" },
      { name: "deadline",   type: "uint256" },
    ],
  };

  const value = {
    emotionId: params.emotionId,
    photoCid:  params.photoCid,
    musicId:   params.musicId,
    moodText:  params.moodText,
    nonce:     params.nonce,
    deadline:  params.deadline,
  };

  return signer.signTypedData(domain, types, value);
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────────────────────────────────────
describe("CapsuleNFT", function () {
  let capsule, renderer;
  let owner, idol, fan1, fan2, stranger;
  const MINT_PRICE = ethers.parseEther("0.001");
  const MAX_SUPPLY = 100;
  const IDOL_NAME  = "StarIdol";
  const COOLDOWN   = 10 * 60; // 10 minutes in seconds

  // 每个 describe 块前重新部署，保证状态独立
  beforeEach(async function () {
    [owner, idol, fan1, fan2, stranger] = await ethers.getSigners();

    const SVGRenderer = await ethers.getContractFactory("SVGRenderer");
    renderer = await SVGRenderer.deploy();
    await renderer.waitForDeployment();

    const CapsuleNFT = await ethers.getContractFactory("CapsuleNFT");
    capsule = await CapsuleNFT.deploy(
      IDOL_NAME,
      idol.address,
      await renderer.getAddress(),
      MINT_PRICE,
      MAX_SUPPLY
    );
    await capsule.waitForDeployment();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. 部署初始状态
  // ═══════════════════════════════════════════════════════════════════════════
  describe("部署 & 初始状态", function () {
    it("应正确设置偶像地址", async function () {
      expect(await capsule.idol()).to.equal(idol.address);
    });

    it("应正确设置偶像名称", async function () {
      expect(await capsule.idolName()).to.equal(IDOL_NAME);
    });

    it("应正确设置 mintPrice", async function () {
      expect(await capsule.mintPrice()).to.equal(MINT_PRICE);
    });

    it("初始 totalSupply 应为 0", async function () {
      expect(await capsule.totalSupply()).to.equal(0n);
    });

    it("初始 globalState.emotionId 应为 3（Active）", async function () {
      const state = await capsule.getGlobalState();
      expect(state.emotionId).to.equal(3);
    });

    it("初始 globalState.moodText 应为 Hello World!", async function () {
      const state = await capsule.getGlobalState();
      expect(state.moodText).to.equal("Hello World!");
    });

    it("owner 应为部署者", async function () {
      expect(await capsule.owner()).to.equal(owner.address);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Mint 功能
  // ═══════════════════════════════════════════════════════════════════════════
  describe("mint()", function () {
    it("支付足额 ETH 后应成功 Mint", async function () {
      await expect(capsule.connect(fan1).mint({ value: MINT_PRICE }))
        .to.emit(capsule, "Minted")
        .withArgs(fan1.address, 0n);
      expect(await capsule.totalSupply()).to.equal(1n);
    });

    it("Mint 后 balanceOf 应为 1", async function () {
      await capsule.connect(fan1).mint({ value: MINT_PRICE });
      expect(await capsule.balanceOf(fan1.address)).to.equal(1n);
    });

    it("支付超额 ETH 也应成功", async function () {
      await expect(
        capsule.connect(fan1).mint({ value: ethers.parseEther("0.01") })
      ).to.emit(capsule, "Minted");
    });

    it("支付不足应 revert: Insufficient payment", async function () {
      await expect(
        capsule.connect(fan1).mint({ value: ethers.parseEther("0.0001") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("超出 maxSupply 应 revert: Sold out", async function () {
      const SmallCapsule = await ethers.getContractFactory("CapsuleNFT");
      const small = await SmallCapsule.deploy(
        IDOL_NAME, idol.address, await renderer.getAddress(),
        MINT_PRICE, 1
      );
      await small.waitForDeployment();
      await small.connect(fan1).mint({ value: MINT_PRICE });
      await expect(
        small.connect(fan2).mint({ value: MINT_PRICE })
      ).to.be.revertedWith("Sold out");
    });

    it("多次 Mint tokenId 应递增", async function () {
      await capsule.connect(fan1).mint({ value: MINT_PRICE });
      await expect(capsule.connect(fan2).mint({ value: MINT_PRICE }))
        .to.emit(capsule, "Minted")
        .withArgs(fan2.address, 1n);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. updateIdolState — EIP-712 签名验证（核心业务逻辑）
  // ═══════════════════════════════════════════════════════════════════════════
  describe("updateIdolState()", function () {
    let deadline, nonce, params, sig;

    beforeEach(async function () {
      // 初始 globalState.lastUpdated = block.timestamp，必须先过 Cooldown（10 分钟）
      await time.increase(COOLDOWN + 1);

      deadline = BigInt(await time.latest()) + 3600n; // 1 小时后过期
      nonce    = await capsule.nonces(idol.address);
      params   = {
        emotionId: 1,
        photoCid:  "QmTestPhotoCid123",
        musicId:   2,
        moodText:  "感觉有点累了",
        nonce:     nonce,
        deadline:  deadline,
      };
      sig = await signEmotionUpdate(idol, await capsule.getAddress(), params);
    });

    it("有效签名应成功更新 globalState", async function () {
      await expect(
        capsule.connect(stranger).updateIdolState(
          params.emotionId, params.photoCid, params.musicId,
          params.moodText, params.deadline, sig
        )
      ).to.emit(capsule, "EmotionUpdated");

      const state = await capsule.getGlobalState();
      expect(state.emotionId).to.equal(1);
      expect(state.photoCid).to.equal("QmTestPhotoCid123");
      expect(state.moodText).to.equal("感觉有点累了");
    });

    it("更新后 nonce 应自增", async function () {
      await capsule.connect(stranger).updateIdolState(
        params.emotionId, params.photoCid, params.musicId,
        params.moodText, params.deadline, sig
      );
      expect(await capsule.nonces(idol.address)).to.equal(nonce + 1n);
    });

    it("emotionId = 0（Emo 状态）也应成功", async function () {
      params.emotionId = 0;
      sig = await signEmotionUpdate(idol, await capsule.getAddress(), params);
      await expect(
        capsule.connect(stranger).updateIdolState(
          0, params.photoCid, params.musicId,
          params.moodText, params.deadline, sig
        )
      ).to.emit(capsule, "EmotionUpdated");
      const state = await capsule.getGlobalState();
      expect(state.emotionId).to.equal(0);
    });

    it("emotionId = 4（Happy 状态）应成功", async function () {
      params.emotionId = 4;
      sig = await signEmotionUpdate(idol, await capsule.getAddress(), params);
      await capsule.connect(stranger).updateIdolState(
        4, params.photoCid, params.musicId,
        params.moodText, params.deadline, sig
      );
      const state = await capsule.getGlobalState();
      expect(state.emotionId).to.equal(4);
    });

    it("emotionId > 4 应 revert: Invalid emotionId", async function () {
      // 用合法 emotionId 签名，但传入非法值（绕过签名，合约先校验 emotionId）
      await expect(
        capsule.connect(stranger).updateIdolState(
          5, params.photoCid, params.musicId,
          params.moodText, params.deadline, sig
        )
      ).to.be.revertedWith("Invalid emotionId");
    });

    it("签名过期应 revert: Signature expired", async function () {
      const expiredDeadline = BigInt(await time.latest()) - 1n;
      const expiredParams = { ...params, deadline: expiredDeadline };
      const expiredSig = await signEmotionUpdate(idol, await capsule.getAddress(), expiredParams);
      await expect(
        capsule.connect(stranger).updateIdolState(
          expiredParams.emotionId, expiredParams.photoCid, expiredParams.musicId,
          expiredParams.moodText, expiredDeadline, expiredSig
        )
      ).to.be.revertedWith("Signature expired");
    });

    it("非偶像地址签名应 revert: Invalid idol signature", async function () {
      const fakeSig = await signEmotionUpdate(stranger, await capsule.getAddress(), params);
      await expect(
        capsule.connect(fan1).updateIdolState(
          params.emotionId, params.photoCid, params.musicId,
          params.moodText, params.deadline, fakeSig
        )
      ).to.be.revertedWith("Invalid idol signature");
    });

    it("重放旧签名（nonce 不匹配）应 revert", async function () {
      // 第一次成功
      await capsule.connect(stranger).updateIdolState(
        params.emotionId, params.photoCid, params.musicId,
        params.moodText, params.deadline, sig
      );
      // 等待 Cooldown
      await time.increase(COOLDOWN + 1);
      // 重放同一个 sig（nonce 已变）
      await expect(
        capsule.connect(stranger).updateIdolState(
          params.emotionId, params.photoCid, params.musicId,
          params.moodText, params.deadline, sig
        )
      ).to.be.revertedWith("Invalid idol signature");
    });

    it("Cooldown 未到应 revert: Cooldown not elapsed", async function () {
      // 第一次成功
      await capsule.connect(stranger).updateIdolState(
        params.emotionId, params.photoCid, params.musicId,
        params.moodText, params.deadline, sig
      );
      // 立即再次尝试（不等 Cooldown）
      const newNonce  = await capsule.nonces(idol.address);
      const newDeadline = BigInt(await time.latest()) + 3600n;
      const newParams = { ...params, nonce: newNonce, deadline: newDeadline };
      const newSig    = await signEmotionUpdate(idol, await capsule.getAddress(), newParams);
      await expect(
        capsule.connect(stranger).updateIdolState(
          newParams.emotionId, newParams.photoCid, newParams.musicId,
          newParams.moodText, newDeadline, newSig
        )
      ).to.be.revertedWith("Cooldown not elapsed");
    });

    it("Cooldown 结束后应能再次更新", async function () {
      await capsule.connect(stranger).updateIdolState(
        params.emotionId, params.photoCid, params.musicId,
        params.moodText, params.deadline, sig
      );
      await time.increase(COOLDOWN + 1);

      const newNonce    = await capsule.nonces(idol.address);
      const newDeadline = BigInt(await time.latest()) + 3600n;
      const newParams   = {
        emotionId: 4, photoCid: "QmNewCid", musicId: 0,
        moodText: "开心！", nonce: newNonce, deadline: newDeadline,
      };
      const newSig = await signEmotionUpdate(idol, await capsule.getAddress(), newParams);

      await expect(
        capsule.connect(stranger).updateIdolState(
          4, "QmNewCid", 0, "开心！", newDeadline, newSig
        )
      ).to.emit(capsule, "EmotionUpdated");

      const state = await capsule.getGlobalState();
      expect(state.emotionId).to.equal(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. sendComfort — 免费安慰
  // ═══════════════════════════════════════════════════════════════════════════
  describe("sendComfort()", function () {
    it("持有 NFT 的粉丝应能发送安慰", async function () {
      await capsule.connect(fan1).mint({ value: MINT_PRICE });
      await expect(capsule.connect(fan1).sendComfort())
        .to.emit(capsule, "ComfortSent")
        .withArgs(fan1.address, anyValue);
    });

    it("未持有 NFT 应 revert: Must hold a capsule NFT", async function () {
      await expect(
        capsule.connect(stranger).sendComfort()
      ).to.be.revertedWith("Must hold a capsule NFT");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. superComfort — 付费链上留言
  // ═══════════════════════════════════════════════════════════════════════════
  describe("superComfort()", function () {
    it("支付 0.0001 ETH 并留言应触发 SuperComfortSent 事件", async function () {
      await expect(
        capsule.connect(fan1).superComfort("花花注意休息！", {
          value: ethers.parseEther("0.0001"),
        })
      )
        .to.emit(capsule, "SuperComfortSent")
        .withArgs(fan1.address, "花花注意休息！", ethers.parseEther("0.0001"));
    });

    it("支付超额也应成功，并记录实际金额", async function () {
      const bigValue = ethers.parseEther("0.001");
      await expect(
        capsule.connect(fan1).superComfort("打call！", { value: bigValue })
      )
        .to.emit(capsule, "SuperComfortSent")
        .withArgs(fan1.address, "打call！", bigValue);
    });

    it("支付不足 0.0001 ETH 应 revert: Insufficient payment", async function () {
      await expect(
        capsule.connect(fan1).superComfort("留言", {
          value: ethers.parseEther("0.00001"),
        })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("空消息应 revert: Message cannot be empty", async function () {
      await expect(
        capsule.connect(fan1).superComfort("", {
          value: ethers.parseEther("0.0001"),
        })
      ).to.be.revertedWith("Message cannot be empty");
    });

    it("超过 300 字节的消息应 revert: Message too long", async function () {
      const longMsg = "A".repeat(301);
      await expect(
        capsule.connect(fan1).superComfort(longMsg, {
          value: ethers.parseEther("0.0001"),
        })
      ).to.be.revertedWith("Message too long");
    });

    it("恰好 300 字节应成功", async function () {
      const maxMsg = "A".repeat(300);
      await expect(
        capsule.connect(fan1).superComfort(maxMsg, {
          value: ethers.parseEther("0.0001"),
        })
      ).to.emit(capsule, "SuperComfortSent");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. 管理函数（onlyOwner）
  // ═══════════════════════════════════════════════════════════════════════════
  describe("管理函数 onlyOwner", function () {
    it("owner 应能调用 setRenderer", async function () {
      const NewRenderer = await ethers.getContractFactory("SVGRenderer");
      const newRenderer = await NewRenderer.deploy();
      await newRenderer.waitForDeployment();
      await expect(capsule.connect(owner).setRenderer(await newRenderer.getAddress()))
        .to.emit(capsule, "RendererUpdated");
    });

    it("非 owner 调用 setRenderer 应 revert", async function () {
      await expect(
        capsule.connect(stranger).setRenderer(ethers.ZeroAddress)
      ).to.be.reverted;
    });

    it("owner 应能调用 setIdol", async function () {
      await capsule.connect(owner).setIdol(fan1.address);
      expect(await capsule.idol()).to.equal(fan1.address);
    });

    it("非 owner 调用 setIdol 应 revert", async function () {
      await expect(
        capsule.connect(stranger).setIdol(fan1.address)
      ).to.be.reverted;
    });

    it("owner 应能添加音乐 CID", async function () {
      await capsule.connect(owner).addMusic("QmMusicCid1");
      expect(await capsule.getMusicCount()).to.equal(1n);
      expect(await capsule.musicCids(0)).to.equal("QmMusicCid1");
    });

    it("owner 应能 withdraw 合约余额", async function () {
      // 先让合约有余额
      await capsule.connect(fan1).mint({ value: MINT_PRICE });
      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const tx = await capsule.connect(owner).withdraw();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const ownerAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerAfter).to.be.gt(ownerBefore - gasCost);
    });

    it("非 owner 调用 withdraw 应 revert", async function () {
      await expect(capsule.connect(stranger).withdraw()).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. tokenURI — 全链上 SVG 渲染
  // ═══════════════════════════════════════════════════════════════════════════
  describe("tokenURI()", function () {
    beforeEach(async function () {
      await capsule.connect(fan1).mint({ value: MINT_PRICE });
    });

    it("应返回 base64 编码的 JSON data URI", async function () {
      const uri = await capsule.tokenURI(0);
      expect(uri).to.match(/^data:application\/json;base64,/);
    });

    it("解码后应包含正确的 name 字段", async function () {
      const uri = await capsule.tokenURI(0);
      const base64 = uri.replace("data:application/json;base64,", "");
      const json = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
      expect(json.name).to.include("StarIdol");
      expect(json.name).to.include("Capsule #0");
    });

    it("解码后 image 字段应为 SVG base64", async function () {
      const uri = await capsule.tokenURI(0);
      const base64 = uri.replace("data:application/json;base64,", "");
      const json = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
      expect(json.image).to.match(/^data:image\/svg\+xml;base64,/);
    });

    it("attributes 应包含 Emotion 字段", async function () {
      const uri = await capsule.tokenURI(0);
      const base64 = uri.replace("data:application/json;base64,", "");
      const json = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
      const emotionAttr = json.attributes.find(a => a.trait_type === "Emotion");
      expect(emotionAttr).to.exist;
      expect(emotionAttr.value).to.equal("Active"); // 初始 emotionId = 3
    });

    it("不存在的 tokenId 应 revert", async function () {
      await expect(capsule.tokenURI(999)).to.be.reverted;
    });

    it("情绪更新后 tokenURI 应反映新状态", async function () {
      // 先过 Cooldown
      await time.increase(COOLDOWN + 1);
      const deadline = BigInt(await time.latest()) + 3600n;
      const nonce    = await capsule.nonces(idol.address);
      const params   = { emotionId: 0, photoCid: "QmTest", musicId: 0, moodText: "难过", nonce, deadline };
      const sig      = await signEmotionUpdate(idol, await capsule.getAddress(), params);
      await capsule.updateIdolState(0, "QmTest", 0, "难过", deadline, sig);

      const uri    = await capsule.tokenURI(0);
      const base64 = uri.replace("data:application/json;base64,", "");
      const json   = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
      const emotionAttr = json.attributes.find(a => a.trait_type === "Emotion");
      expect(emotionAttr.value).to.equal("Emo");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. getDomainSeparator
  // ═══════════════════════════════════════════════════════════════════════════
  describe("getDomainSeparator()", function () {
    it("应返回非零的 domain separator", async function () {
      const ds = await capsule.getDomainSeparator();
      expect(ds).to.not.equal(ethers.ZeroHash);
    });
  });
});

