import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIRROR = process.env.HEDERA_MIRROR_URL || "https://testnet.mirrornode.hedera.com";

async function main() {
  const txHash = process.argv[2];
  if (!txHash) {
    throw new Error("Usage: node scripts/fetch_proof_hedera.js <tx hash 0x...>");
  }

  const registryArtifact = JSON.parse(
    fs.readFileSync(path.join(root, "artifacts/contracts_compiled/ZKPVerifierRegistryBytesV2.json"), "utf8")
  );
  const iface = new ethers.Interface(registryArtifact.abi);

  // The mirror node keeps the calldata of every contract call.
  const res = await fetch(`${MIRROR}/api/v1/contracts/results/${txHash}`);
  if (!res.ok) throw new Error(`Mirror node returned ${res.status} for ${txHash}`);
  const result = await res.json();

  const parsed = iface.parseTransaction({ data: result.function_parameters });
  if (parsed.name !== "verifyEncoded") {
    throw new Error(`Expected verifyEncoded, found ${parsed.name}`);
  }

  const [a, b, c, publicSignals] = ethers.AbiCoder.defaultAbiCoder().decode(
    ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[6]"],
    parsed.args[0]
  );

  const str = (x) => JSON.parse(JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
  const out = {
    txHash,
    status: result.result,
    a: str(a),
    b: str(b),
    c: str(c),
    // [claimCommitment, nullifier, eligible, tokenId, expiry, now]
    publicSignals: str(publicSignals),
  };

  const outDir = path.join(root, "artifacts/retrieved");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${txHash}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log("Saved to", outFile);
}

main().catch((e) => {
  console.error("FAILED:", e.shortMessage || e.message || e);
  process.exit(1);
});
