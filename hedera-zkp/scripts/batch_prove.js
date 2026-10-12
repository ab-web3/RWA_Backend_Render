const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

const root = path.resolve(__dirname, "..");
const inputDir = path.join(root, "artifacts", "batch", "inputs");
const outDir = path.join(root, "artifacts", "batch", "proofs");
const wasm = path.join(root, "artifacts", "circuit", "v5_eligibility_js", "v5_eligibility.wasm");
const zkey = path.join(root, "artifacts", "circuit", "v5_eligibility_final.zkey");
const vkey = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "circuit", "verification_key.json")));

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(inputDir).filter((x) => x.endsWith(".json") && x !== "manifest.json").sort();
  const summary = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = file.slice(0, -5);
    try {
      const input = JSON.parse(fs.readFileSync(path.join(inputDir, file)));
      const result = await snarkjs.groth16.fullProve(input, wasm, zkey);
      const valid = await snarkjs.groth16.verify(vkey, result.publicSignals, result.proof);
      const record = { input: file, valid, publicSignals: result.publicSignals };
      fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(result, null, 2));
      summary.push(record);
      if (valid) passed++; else failed++;
    } catch (error) {
      failed++;
      summary.push({ input: file, valid: false, error: String(error.message || error) });
    }
    if ((i + 1) % 100 === 0 || i + 1 === files.length) {
      console.log(`Processed ${i + 1}/${files.length}; passed=${passed}; failed=${failed}`);
    }
  }

  fs.writeFileSync(path.join(root, "artifacts", "batch", "batch_summary.json"), JSON.stringify({
    total: files.length, passed, failed, records: summary
  }, null, 2));
  console.log(JSON.stringify({ total: files.length, passed, failed }));
}

main().catch((error) => { console.error(error); process.exit(1); });
