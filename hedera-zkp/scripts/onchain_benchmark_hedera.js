import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as snarkjs from "snarkjs";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE_SIZE = Number(process.argv[2] || 40);

function targetIndices(total, n) {
  const step = total / n;
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(Math.floor(i * step));
  return idx;
}

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function stddev(xs) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

async function main() {
  const proofsDir = path.join(root, "artifacts/batch/proofs");
  const allFiles = fs.readdirSync(proofsDir).filter((f) => f.endsWith(".json")).sort();
  const targets = targetIndices(allFiles.length, SAMPLE_SIZE);

  const deployment = JSON.parse(fs.readFileSync(path.join(root, "artifacts/deployment/hedera_testnet.json"), "utf8"));
  const registryArtifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts/contracts_compiled/ZKPVerifierRegistryBytesV2.json"), "utf8"));

  const provider = new ethers.JsonRpcProvider(process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api");
  const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const registry = new ethers.Contract(deployment.registry, registryArtifact.abi, wallet);

  console.log(`Sampling ${SAMPLE_SIZE} of ${allFiles.length} proofs, evenly spaced, skipping any already-used nullifier.`);

  const used = new Set();
  const records = [];

  for (let i = 0; i < targets.length; i++) {
    let file = null;
    let publicSignals = null;

    for (let offset = 0; offset < allFiles.length; offset++) {
      const candidateIdx = (targets[i] + offset) % allFiles.length;
      const candidateFile = allFiles[candidateIdx];
      if (used.has(candidateFile)) continue;

      const proofFile = JSON.parse(fs.readFileSync(path.join(proofsDir, candidateFile), "utf8"));
      const nullifier = proofFile.publicSignals[1];
      const alreadyUsedOnChain = await registry.usedNullifier(nullifier);
      if (alreadyUsedOnChain) continue;

      file = candidateFile;
      publicSignals = proofFile.publicSignals;
      used.add(candidateFile);
      break;
    }

    if (!file) {
      console.log(`[${i + 1}/${SAMPLE_SIZE}] no fresh proof found, skipping slot`);
      records.push({ file: null, status: "skipped", reason: "no fresh proof available" });
      continue;
    }

    const proofFile = JSON.parse(fs.readFileSync(path.join(proofsDir, file), "utf8"));
    const calldata = await snarkjs.groth16.exportSolidityCallData(proofFile.proof, proofFile.publicSignals);
    const [a, b, c, input] = JSON.parse("[" + calldata + "]");
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[6]"],
      [a, b, c, input]
    );

    const start = Date.now();
    try {
      const tx = await registry.verifyEncoded(encoded);
      const receipt = await tx.wait();
      const latencyMs = Date.now() - start;
      const gasUsed = Number(receipt.gasUsed);
      records.push({ file, status: "accepted", tx: tx.hash, gasUsed, latencyMs });
      console.log(`[${i + 1}/${SAMPLE_SIZE}] ${file} accepted, gas=${gasUsed}, latency=${latencyMs}ms`);
    } catch (e) {
      const latencyMs = Date.now() - start;
      const reason = e.reason || e.shortMessage || e.message;
      records.push({ file, status: "skipped", reason, latencyMs });
      console.log(`[${i + 1}/${SAMPLE_SIZE}] ${file} skipped: ${reason}`);
    }
  }

  const accepted = records.filter((r) => r.status === "accepted");
  const gasValues = accepted.map((r) => r.gasUsed);
  const latencyValues = accepted.map((r) => r.latencyMs);

  const summary = {
    ranAt: new Date().toISOString(),
    registry: deployment.registry,
    sampleSize: SAMPLE_SIZE,
    totalDatasetSize: allFiles.length,
    accepted: accepted.length,
    skipped: records.length - accepted.length,
    gas: gasValues.length
      ? { mean: mean(gasValues), median: median(gasValues), stddev: stddev(gasValues), min: Math.min(...gasValues), max: Math.max(...gasValues) }
      : null,
    latencyMs: latencyValues.length
      ? { mean: mean(latencyValues), median: median(latencyValues), stddev: stddev(latencyValues), min: Math.min(...latencyValues), max: Math.max(...latencyValues) }
      : null,
    records,
  };

  fs.writeFileSync(
    path.join(root, "artifacts/deployment/onchain_benchmark.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log("\n=== Summary ===");
  console.log(`Accepted: ${summary.accepted}/${summary.sampleSize} (skipped: ${summary.skipped})`);
  if (summary.gas) console.log(`Gas used: mean=${summary.gas.mean.toFixed(0)} median=${summary.gas.median} stddev=${summary.gas.stddev.toFixed(1)} min=${summary.gas.min} max=${summary.gas.max}`);
  if (summary.latencyMs) console.log(`Latency ms: mean=${summary.latencyMs.mean.toFixed(0)} median=${summary.latencyMs.median} stddev=${summary.latencyMs.stddev.toFixed(1)} min=${summary.latencyMs.min} max=${summary.latencyMs.max}`);
  console.log("Saved artifacts/deployment/onchain_benchmark.json");
}

main().catch((e) => {
  console.error("FAILED:", e.shortMessage || e.message || e);
  process.exit(1);
});
