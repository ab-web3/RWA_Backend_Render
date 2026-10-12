import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "artifacts/contracts_compiled", `${name}.json`), "utf8"));
}

async function main() {
  const deployFile = path.join(root, "artifacts/deployment/hedera_testnet_erc3643.json");
  const deployment = JSON.parse(fs.readFileSync(deployFile, "utf8"));

  const provider = new ethers.JsonRpcProvider(process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api");
  const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

  console.log("Deploying new RWAToken (with claimDemoTokens) bound to existing IdentityRegistry/Compliance...");
  const tokenArtifact = loadArtifact("RWAToken");
  const factory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, wallet);
  const token = await factory.deploy("V5 RWA Token", "V5RWA", deployment.identityRegistry, deployment.compliance);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`New RWAToken: ${tokenAddress}`);

  const complianceArtifact = loadArtifact("Compliance");
  const compliance = new ethers.Contract(deployment.compliance, complianceArtifact.abi, wallet);
  const tx = await compliance.bindToken(tokenAddress);
  await tx.wait();
  console.log("Compliance rebound to new token.");

  deployment.token = tokenAddress;
  deployment.tokenRedeployedAt = new Date().toISOString();
  fs.writeFileSync(deployFile, JSON.stringify(deployment, null, 2));
  console.log(`Updated ${path.relative(root, deployFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
