import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIRROR = process.env.HEDERA_MIRROR_URL || "https://testnet.mirrornode.hedera.com";

// tx hash -> nullifier (from on-chain calldata) -> proof file -> investor_id
async function main() {
  const txHash = process.argv[2];
  if (!txHash) throw new Error("Usage: node scripts/lookup_tx_hedera.js <tx hash 0x...>");

  const registryArtifact = JSON.parse(
    fs.readFileSync(path.join(root, "artifacts/contracts_compiled/ZKPVerifierRegistryBytesV2.json"), "utf8")
  );
  const iface = new ethers.Interface(registryArtifact.abi);

  const res = await fetch(`${MIRROR}/api/v1/contracts/results/${txHash}`);
  if (!res.ok) throw new Error(`Mirror node returned ${res.status} for ${txHash}`);
  const result = await res.json();
  const parsed = iface.parseTransaction({ data: result.function_parameters });
  const [, , , signals] = ethers.AbiCoder.defaultAbiCoder().decode(
    ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[6]"],
    parsed.args[0]
  );
  const claimCommitment = signals[0].toString();
  const nullifier = signals[1].toString();

  const proofDir = path.join(root, "artifacts/batch/proofs");
  let proofFile = null;
  for (const f of fs.readdirSync(proofDir)) {
    const j = JSON.parse(fs.readFileSync(path.join(proofDir, f), "utf8"));
    if (j.publicSignals[1] === nullifier) { proofFile = f; break; }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "artifacts/batch/manifest.json"), "utf8"));
  const entry = proofFile && manifest.find((m) => m.input === proofFile);

  console.log(JSON.stringify({
    txHash,
    status: result.result,
    nullifier,
    claimCommitment,
    proofFile,
    investor_id: entry ? entry.investor_id : null,
    row_number: entry ? entry.row_number : null,
  }, null, 2));
}

main().catch((e) => {
  console.error("FAILED:", e.shortMessage || e.message || e);
  process.exit(1);
});
