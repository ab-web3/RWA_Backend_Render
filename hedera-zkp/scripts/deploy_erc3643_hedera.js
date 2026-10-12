import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiledDir = path.join(root, "artifacts", "contracts_compiled");
const outFile = path.join(root, "artifacts", "deployment", "hedera_testnet_erc3643.json");

function loadArtifact(name) {
  const file = path.join(compiledDir, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}. Run: node scripts/compile_contracts.js`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const gasLog = {};

async function record(label, tx) {
  const receipt = await tx.wait();
  const gasPrice = receipt.gasPrice ?? 0n;
  gasLog[label] = {
    tx: tx.hash,
    gasUsed: Number(receipt.gasUsed),
    gasPriceWei: gasPrice.toString(),
    feeHbar: ethers.formatEther(receipt.gasUsed * gasPrice),
  };
}

async function deploy(wallet, artifact, args = [], label = artifact.contractName || "contract") {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  await record(`deploy:${label}`, contract.deploymentTransaction());
  return contract;
}

async function main() {
  const rpcUrl = process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api";
  const privateKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Set OPERATOR_PRIVATE_KEY in your environment (see .env.example)");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deploying from ${wallet.address} via ${rpcUrl}\n`);

  console.log("1/6 Deploying IdentityRegistry...");
  const identityRegistry = await deploy(wallet, loadArtifact("IdentityRegistry"), [], "IdentityRegistry");
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log(`    IdentityRegistry: ${identityRegistryAddress}`);

  console.log("2/6 Deploying Compliance...");
  const compliance = await deploy(wallet, loadArtifact("Compliance"), [identityRegistryAddress], "Compliance");
  const complianceAddress = await compliance.getAddress();
  console.log(`    Compliance: ${complianceAddress}`);

  console.log("3/6 Deploying Groth16Verifier...");
  const verifier = await deploy(wallet, loadArtifact("Groth16Verifier"), [], "Groth16Verifier");
  const verifierAddress = await verifier.getAddress();
  console.log(`    Groth16Verifier: ${verifierAddress}`);

  console.log("4/6 Deploying ZKPVerifierRegistryBytesV2...");
  const zkpRegistry = await deploy(wallet, loadArtifact("ZKPVerifierRegistryBytesV2"), [
    verifierAddress,
    identityRegistryAddress,
  ], "ZKPVerifierRegistryBytesV2");
  const zkpRegistryAddress = await zkpRegistry.getAddress();
  console.log(`    ZKPVerifierRegistryBytesV2: ${zkpRegistryAddress}`);

  console.log("5/6 Authorizing ZKP registry as an IdentityRegistry agent...");
  let tx = await identityRegistry.setAgent(zkpRegistryAddress, true);
  await record("setAgent", tx);
  console.log("    Agent set.");

  console.log("6/6 Deploying RWAToken and binding Compliance...");
  const token = await deploy(wallet, loadArtifact("RWAToken"), [
    "V5 RWA Token",
    "V5RWA",
    identityRegistryAddress,
    complianceAddress,
  ], "RWAToken");
  const tokenAddress = await token.getAddress();
  tx = await compliance.bindToken(tokenAddress);
  await record("bindToken", tx);
  console.log(`    RWAToken: ${tokenAddress}`);

  const deployment = {
    network: "hedera-testnet",
    rpcUrl,
    deployer: wallet.address,
    identityRegistry: identityRegistryAddress,
    compliance: complianceAddress,
    verifier: verifierAddress,
    zkpRegistry: zkpRegistryAddress,
    token: tokenAddress,
    deployedAt: new Date().toISOString(),
    gas: gasLog,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log(`\nSaved ${path.relative(root, outFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
