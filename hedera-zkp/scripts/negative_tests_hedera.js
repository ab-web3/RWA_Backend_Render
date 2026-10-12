import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as snarkjs from "snarkjs";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadProof(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "artifacts/batch/proofs", name), "utf8"));
}

async function encode(proofFile, tamper = false) {
  const calldata = await snarkjs.groth16.exportSolidityCallData(proofFile.proof, proofFile.publicSignals);
  const [a, b, c, input] = JSON.parse("[" + calldata + "]");
  if (tamper) {
    a[0] = (BigInt(a[0]) + 1n).toString();
  }
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[6]"],
    [a, b, c, input]
  );
}

async function attempt(registry, label, encoded) {
  try {
    const tx = await registry.verifyEncoded(encoded);
    const receipt = await tx.wait();
    console.log(`[${label}] ACCEPTED - tx ${tx.hash}, block ${receipt.blockNumber}, status ${receipt.status}`);
    return { label, result: "accepted", tx: tx.hash };
  } catch (e) {
    const reason = e.reason || e.shortMessage || e.message;
    console.log(`[${label}] REJECTED - ${reason}`);
    return { label, result: "rejected", reason };
  }
}

async function main() {
  const deployment = JSON.parse(fs.readFileSync(path.join(root, "artifacts/deployment/hedera_testnet.json"), "utf8"));
  const registryArtifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts/contracts_compiled/ZKPVerifierRegistryBytesV2.json"), "utf8"));

  const provider = new ethers.JsonRpcProvider(process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api");
  const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const registry = new ethers.Contract(deployment.registry, registryArtifact.abi, wallet);

  const results = [];

  const proof2 = loadProof("row_00002_INV000002.json");
  results.push(await attempt(registry, "valid_proof_different_row", await encode(proof2)));

  const proof1Again = loadProof("row_00001_INV000001.json");
  results.push(await attempt(registry, "replayed_nullifier_row1", await encode(proof1Again)));

  const proof3 = loadProof("row_00003_INV000003.json");
  results.push(await attempt(registry, "tampered_proof_row3", await encode(proof3, true)));

  fs.writeFileSync(
    path.join(root, "artifacts/deployment/negative_test_results.json"),
    JSON.stringify({ ranAt: new Date().toISOString(), registry: deployment.registry, results }, null, 2)
  );
  console.log("Saved artifacts/deployment/negative_test_results.json");
}

main().catch((e) => {
  console.error("FAILED:", e.shortMessage || e.message || e);
  process.exit(1);
});
