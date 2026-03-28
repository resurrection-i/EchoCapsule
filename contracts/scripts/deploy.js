const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. 部署 SVGRenderer
  const SVGRenderer = await ethers.getContractFactory("SVGRenderer");
  const renderer = await SVGRenderer.deploy();
  await renderer.waitForDeployment();
  const rendererAddr = await renderer.getAddress();
  console.log("SVGRenderer deployed to:", rendererAddr);

  // 2. 部署 CapsuleNFT
  const idolName = "StarIdol";
  const idolAddress = deployer.address; // 演示时偶像地址 = 部署者
  const mintPrice = ethers.parseEther("0.001");
  const maxSupply = 1000;

  const CapsuleNFT = await ethers.getContractFactory("CapsuleNFT");
  const capsule = await CapsuleNFT.deploy(
    idolName,
    idolAddress,
    rendererAddr,
    mintPrice,
    maxSupply
  );
  await capsule.waitForDeployment();
  const capsuleAddr = await capsule.getAddress();
  console.log("CapsuleNFT deployed to:", capsuleAddr);

  // 3. 输出部署信息
  console.log("\n========== Deployment Summary ==========");
  console.log("SVGRenderer:", rendererAddr);
  console.log("CapsuleNFT:", capsuleAddr);
  console.log("Idol:", idolAddress);
  console.log("Mint Price:", ethers.formatEther(mintPrice), "ETH");
  console.log("Max Supply:", maxSupply);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
