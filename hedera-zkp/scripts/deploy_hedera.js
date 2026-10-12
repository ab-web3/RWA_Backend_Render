import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiledDir = path.join(root, "artifacts", "contracts_compiled");
const outFile = path.join(root, "artifacts", "deployment", "hedera_testnet.json");

function loadArtifact(name) {
  const file = path.join(compiledDir, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}. Run: node scripts/compile_contracts.js`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function main() {
  const rpcUrl = process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api";
  const privateKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Set OPERATOR_PRIVATE_KEY in your environment (see .env.example)");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deploying from ${wallet.address} via ${rpcUrl}`);

  const verifierArtifact = loadArtifact("Groth16Verifier");
  const verifierFactory = new ethers.ContractFactory(
    verifierArtifact.abi,
    verifierArtifact.bytecode,
    wallet
  );
  const verifier = await verifierFactory.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`Groth16Verifier deployed at ${verifierAddress}`);

  const registryArtifact = loadArtifact("ZKPVerifierRegistryBytesV2");
  const registryFactory = new ethers.ContractFactory(
    registryArtifact.abi,
    registryArtifact.bytecode,
    wallet
  );
  const registry = await registryFactory.deploy(verifierAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`ZKPVerifierRegistryBytesV2 deployed at ${registryAddress}`);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        network: "hedera-testnet",
        rpcUrl,
        deployer: wallet.address,
        verifier: verifierAddress,
        registry: registryAddress,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`Recorded deployment in ${path.relative(root, outFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
