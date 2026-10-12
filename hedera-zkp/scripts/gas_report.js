// Reads gasUsed / fee for already-mined Hedera Testnet transactions and writes
// artifacts/deployment/gas_report.json. Read-only: no private key needed.
// Optional: HBAR_USD_PRICE=0.20 node scripts/gas_report.js  (adds a USD column)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dep = (f) => JSON.parse(fs.readFileSync(path.join(root, "artifacts/deployment", f), "utf8"));

const usd = Number(process.env.HBAR_USD_PRICE || 0);
const provider = new ethers.JsonRpcProvider(process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api");

const demo = dep("erc3643_gate_demo.json");
const bench = dep("onchain_benchmark.json");
const txs = [
  ["ZK proof verify + registerIdentity (CLI demo)", demo.proofTx],
  ["RWAToken.mint after ZK verification (CLI demo)", demo.mintTx],
  ["ZK proof verify (MetaMask, live demo)", "0xdb9f49638ffc55c8be6d76605cbfbd531b917bf7432e8d82e928836b3e55f427"],
  ["claimDemoTokens (MetaMask, live demo)", "0xdf0fefb58c5fc76b1615c71184f299ed1c78a1587d4a2be5ee3fe31933fc6c2d"],
  ["ZK proof verify (benchmark, sample 1)", bench.records[0].tx],
];

const rows = [];
for (const [label, hash] of txs) {
  const r = await provider.getTransactionReceipt(hash);
  if (!r) { console.log(`not found: ${label}`); continue; }
  const gasPrice = r.gasPrice ?? 0n;
  const feeHbar = Number(ethers.formatEther(r.gasUsed * gasPrice));
  rows.push({ label, tx: hash, gasUsed: Number(r.gasUsed), gasPriceWei: gasPrice.toString(), feeHbar, feeUsd: usd ? feeHbar * usd : null });
  console.log(`${label}: gas ${r.gasUsed}, fee ${feeHbar} HBAR`);
}
fs.writeFileSync(path.join(root, "artifacts/deployment/gas_report.json"),
  JSON.stringify({ ranAt: new Date().toISOString(), hbarUsd: usd || null, rows }, null, 2));
console.log("Saved artifacts/deployment/gas_report.json");
