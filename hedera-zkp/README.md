# Hedera ZKP and ERC-3643 component

This directory contains the Hedera smart contracts, Circom eligibility
circuit, proof submission and deployment scripts from the V5 ZKP project.
It is kept separate from the existing Python ANN API at the repository root.

## Contents

- `contracts/` and `contracts/erc3643/`: verifier registry and ERC-3643
  identity, compliance, and token contracts.
- `circuits/`: the eligibility circuit source.
- `scripts/`: compile, deploy, submit proof, benchmark, and reporting
  commands.
- `artifacts/`: generated Solidity verifier, compiled contract artifacts,
  and saved testnet run records. Private inputs, witnesses, proving keys,
  and individual proof batches are excluded.

## Local setup

Install Node.js, Circom, and the project dependencies:

```powershell
cd hedera-zkp
npm ci
```

Copy `.env.example` to `.env` and provide a Hedera Testnet RPC URL and
operator private key locally. Never commit `.env`.

Compile contracts with `npm run compile:contracts`. Deployment and proof
commands are listed in `docs/DEPLOY_HEDERA.md`. These commands send
transactions when run; they are not part of the Python API's server startup.

The saved deployment JSON documents a Hedera Testnet run from September
2026. Testnet state can change or reset; check the contract records on
HashScan before relying on those addresses.
