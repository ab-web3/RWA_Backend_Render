import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "artifacts/contracts_compiled", `${name}.json`), "utf8"));
}

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(root, "artifacts/deployment/hedera_testnet_erc3643.json"), "utf8")
  );

  const provider = new ethers.JsonRpcProvider(process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api");
  const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

  const identityRegistry = new ethers.Contract(deployment.identityRegistry, loadArtifact("IdentityRegistry").abi, wallet);
  const token = new ethers.Contract(deployment.token, loadArtifact("RWAToken").abi, wallet);

  const strangerAddress = ethers.Wallet.createRandom().address;
  console.log("=== ERC-3643 compliance gate: unverified vs. ZK-verified investor ===\n");
  console.log(`Unverified investor (never submitted a ZK proof): ${strangerAddress}`);
  console.log(`ZK-verified investor (proved eligibility earlier): ${wallet.address}\n`);

  const strangerVerified = await identityRegistry.isVerified(strangerAddress);
  const walletVerified = await identityRegistry.isVerified(wallet.address);
  console.log(`isVerified(unverified investor) = ${strangerVerified}`);
  console.log(`isVerified(ZK-verified investor) = ${walletVerified}\n`);

  console.log("Attempting mint(100) to the UNVERIFIED investor...");
  try {
    const tx = await token.mint(strangerAddress, 100n);
    await tx.wait();
    console.log("UNEXPECTED: mint succeeded, tx", tx.hash);
  } catch (e) {
    console.log(`REJECTED (expected): ${e.reason || e.shortMessage || e.message}`);
  }

  console.log("\nAttempting mint(50) to the ZK-VERIFIED investor...");
  const tx2 = await token.mint(wallet.address, 50n);
  const receipt2 = await tx2.wait();
  console.log(`ACCEPTED (expected): tx ${tx2.hash}, status ${receipt2.status}`);

  const finalBalance = await token.balanceOf(wallet.address);
  console.log(`\nFinal balance of ZK-verified investor: ${finalBalance.toString()} V5RWA`);
}

main().catch((e) => {
  console.error("FAILED:", e.shortMessage || e.message || e);
  process.exit(1);
});
