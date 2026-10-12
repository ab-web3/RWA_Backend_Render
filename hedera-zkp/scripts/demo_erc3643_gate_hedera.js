import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as snarkjs from "snarkjs";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "artifacts/contracts_compiled", `${name}.json`), "utf8"));
}

function gasInfo(receipt) {
  const gasPrice = receipt.gasPrice ?? 0n;
  return {
    gasUsed: Number(receipt.gasUsed),
    gasPriceWei: gasPrice.toString(),
    feeHbar: ethers.formatEther(receipt.gasUsed * gasPrice),
  };
}

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(root, "artifacts/deployment/hedera_testnet_erc3643.json"), "utf8")
  );

  const provider = new ethers.JsonRpcProvider(process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api");
  const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

  const identityRegistry = new ethers.Contract(deployment.identityRegistry, loadArtifact("IdentityRegistry").abi, wallet);
  const token = new ethers.Contract(deployment.token, loadArtifact("RWAToken").abi, wallet);
  const zkpRegistry = new ethers.Contract(deployment.zkpRegistry, loadArtifact("ZKPVerifierRegistryBytesV2").abi, wallet);

  console.log(`Investor / deployer wallet: ${wallet.address}\n`);

  const verifiedBefore = await identityRegistry.isVerified(wallet.address);
  console.log(`isVerified before ZK proof: ${verifiedBefore}`);

  console.log("\nStep 1: attempting mint BEFORE ZK verification (expected to revert)...");
  try {
    const tx = await token.mint(wallet.address, 100n);
    await tx.wait();
    console.log("UNEXPECTED: mint succeeded, tx", tx.hash);
  } catch (e) {
    console.log(`REJECTED as expected: ${e.reason || e.shortMessage || e.message}`);
  }

  console.log("\nStep 2: submitting ZK eligibility proof...");
  const proofName = process.argv[2] || "row_00050_INV000050.json";
  const proofFile = JSON.parse(fs.readFileSync(path.join(root, "artifacts/batch/proofs", proofName), "utf8"));
  const calldata = await snarkjs.groth16.exportSolidityCallData(proofFile.proof, proofFile.publicSignals);
  const [a, b, c, input] = JSON.parse("[" + calldata + "]");
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[6]"],
    [a, b, c, input]
  );
  const proofTx = await zkpRegistry.verifyEncoded(encoded);
  const proofReceipt = await proofTx.wait();
  console.log(`Proof (${proofName}) accepted: tx ${proofTx.hash}, status ${proofReceipt.status}`);

  const verifiedAfter = await identityRegistry.isVerified(wallet.address);
  console.log(`isVerified after ZK proof: ${verifiedAfter}`);

  console.log("\nStep 3: attempting mint AFTER ZK verification (expected to succeed)...");
  const mintTx = await token.mint(wallet.address, 100n);
  const mintReceipt = await mintTx.wait();
  console.log(`ACCEPTED: mint tx ${mintTx.hash}, status ${mintReceipt.status}`);

  const balance = await token.balanceOf(wallet.address);
  console.log(`\nFinal RWAToken balance of ${wallet.address}: ${balance.toString()}`);

  fs.writeFileSync(
    path.join(root, "artifacts/deployment/erc3643_gate_demo.json"),
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        investor: wallet.address,
        verifiedBefore,
        verifiedAfter,
        proofUsed: proofName,
        proofTx: proofTx.hash,
        mintTx: mintTx.hash,
        gas: { verifyProof: gasInfo(proofReceipt), mint: gasInfo(mintReceipt) },
        finalBalance: balance.toString(),
      },
      null,
      2
    )
  );
  console.log("\nSaved artifacts/deployment/erc3643_gate_demo.json");
}

main().catch((e) => {
  console.error("FAILED:", e.shortMessage || e.message || e);
  process.exit(1);
});
