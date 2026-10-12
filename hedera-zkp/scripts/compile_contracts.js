import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import solc from "solc";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts", "contracts_compiled");
const contractsDir = path.join(root, "contracts");

// Keys mirror the real relative path from contractsDir, so relative imports
// ("./erc3643/IIdentity.sol" etc.) resolve the way solc expects.
const SOURCE_FILES = {
  "V5EligibilityVerifier.sol": path.join(root, "artifacts", "circuit", "V5EligibilityVerifier.generated.sol"),
  "ZKPVerifierRegistryBytesV2.sol": path.join(contractsDir, "ZKPVerifierRegistryBytesV2.sol"),
  "erc3643/IIdentity.sol": path.join(contractsDir, "erc3643", "IIdentity.sol"),
  "erc3643/IIdentityRegistryStorage.sol": path.join(contractsDir, "erc3643", "IIdentityRegistryStorage.sol"),
  "erc3643/ITrustedIssuersRegistry.sol": path.join(contractsDir, "erc3643", "ITrustedIssuersRegistry.sol"),
  "erc3643/IClaimTopicsRegistry.sol": path.join(contractsDir, "erc3643", "IClaimTopicsRegistry.sol"),
  "erc3643/IIdentityRegistry.sol": path.join(contractsDir, "erc3643", "IIdentityRegistry.sol"),
  "erc3643/ICompliance.sol": path.join(contractsDir, "erc3643", "ICompliance.sol"),
  "erc3643/IERC3643.sol": path.join(contractsDir, "erc3643", "IERC3643.sol"),
  "erc3643/IdentityRegistry.sol": path.join(contractsDir, "erc3643", "IdentityRegistry.sol"),
  "erc3643/Compliance.sol": path.join(contractsDir, "erc3643", "Compliance.sol"),
  "erc3643/RWAToken.sol": path.join(contractsDir, "erc3643", "RWAToken.sol"),
};

const CONTRACTS_TO_EXPORT = {
  "V5EligibilityVerifier.sol": "Groth16Verifier",
  "ZKPVerifierRegistryBytesV2.sol": "ZKPVerifierRegistryBytesV2",
  "erc3643/IdentityRegistry.sol": "IdentityRegistry",
  "erc3643/Compliance.sol": "Compliance",
  "erc3643/RWAToken.sol": "RWAToken",
};

function compile() {
  const sources = {};
  for (const [key, filePath] of Object.entries(SOURCE_FILES)) {
    sources[key] = { content: fs.readFileSync(filePath, "utf8") };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage);
    throw new Error("Solidity compilation failed");
  }
  for (const w of output.errors || []) {
    if (w.severity === "warning") console.warn(w.formattedMessage);
  }

  fs.mkdirSync(outDir, { recursive: true });

  for (const [fileKey, contractName] of Object.entries(CONTRACTS_TO_EXPORT)) {
    const compiled = output.contracts[fileKey][contractName];
    const artifact = {
      contractName,
      abi: compiled.abi,
      bytecode: "0x" + compiled.evm.bytecode.object,
    };
    fs.writeFileSync(
      path.join(outDir, `${contractName}.json`),
      JSON.stringify(artifact, null, 2)
    );
    console.log(`Compiled ${contractName} -> artifacts/contracts_compiled/${contractName}.json`);
  }
}

compile();
