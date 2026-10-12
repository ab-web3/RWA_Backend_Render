# Deploying to Hedera Testnet

Nothing has been deployed yet. This is the manual, one-time path to deploy the
generated verifier and `ZKPVerifierRegistryBytesV2` to Hedera Testnet via its
EVM-compatible JSON-RPC relay. No Hedera-specific SDK is required.

## 1. Create and fund a testnet account

1. Go to the Hedera Portal (https://portal.hedera.com) and create a testnet
   account. It gives you an EVM-compatible account with a private key and
   comes pre-funded with testnet HBAR.
2. If you need more testnet HBAR, use the Hedera Testnet faucet.

## 2. Set your credentials locally

Copy `.env.example` to `.env` (already gitignored) and fill in your private
key:

```
HEDERA_TESTNET_RPC_URL=https://testnet.hashio.io/api
OPERATOR_PRIVATE_KEY=<your testnet account private key, no 0x needed either way>
```

In PowerShell, you can instead set these for the current session without a
file:

```powershell
$env:HEDERA_TESTNET_RPC_URL = "https://testnet.hashio.io/api"
$env:OPERATOR_PRIVATE_KEY = "<your testnet account private key>"
```

Never commit `.env` or paste the private key anywhere shared.

## 3. Compile and deploy

```powershell
npm run compile:contracts
npm run deploy:hedera
```

This deploys, in order:

1. `Groth16Verifier` (from `artifacts/circuit/V5EligibilityVerifier.generated.sol`)
2. `ZKPVerifierRegistryBytesV2`, constructed with the verifier's address

Deployed addresses are printed and saved to
`artifacts/deployment/hedera_testnet.json`.

## 4. Verify a real proof on-chain (do this before submitting many)

```powershell
npm run submit:hedera -- row_00001_INV000001.json
```

This encodes and submits one proof from `artifacts/batch/proofs/` to the
deployed registry and prints the transaction hash and confirmation status.
Confirmed working on Hedera Testnet: tx
`0xe34e015c640572f9f5094895e51613224d6506138a876910530d3242f5536132`,
status 1, nullifier marked used.

Do not submit thousands of proofs automatically — see
`docs/BATCH_ZKP_WORKFLOW.md`. Each submission is a separate on-chain
transaction and costs testnet HBAR gas.

## Full ERC-3643 stack (IdentityRegistry, Compliance, RWAToken)

`contracts/erc3643/` implements the real ERC-3643 interfaces
(`IERC3643`, `IIdentityRegistry`, `ICompliance`), signatures taken directly
from EIP-3643, not a bespoke approximation. `ZKPVerifierRegistryBytesV2` acts
as the ERC-3643 "agent": on a verified proof it calls
`identityRegistry.registerIdentity(...)`, standing in for the usual
claim-issuer inspection. Deploy the whole stack (IdentityRegistry,
Compliance, Groth16Verifier, ZKPVerifierRegistryBytesV2, RWAToken, wired
together) with:

```powershell
npm run compile:contracts
npm run deploy:erc3643
```

Addresses are saved to `artifacts/deployment/hedera_testnet_erc3643.json`.

To demonstrate the actual compliance gate end to end (mint blocked before ZK
verification, allowed after) run:

```powershell
npm run demo:erc3643 -- row_00050_INV000050.json
```

Confirmed working on Hedera Testnet: mint before proof reverted with
"receiver not ZK-verified"; proof tx
`0xfc0a7ad58f01cdb131390b5302fa393cd836fe108dd7aa9a2639471fd1fa0e64`
verified; mint after proof succeeded, tx
`0xad67a3cee42ca78560ecb3419d6687f6fbac2f61edf261c3926f0a91dba6becc`,
balance 100. Results saved to `artifacts/deployment/erc3643_gate_demo.json`.

## Why ZKPVerifierRegistryBytesV2 and not the others

`ZKPVerifierRegistry.sol`, `ZKPVerifierRegistryBytes.sol`,
`ZKPVerifierRegistryFlat.sol`, and `ZKPVerifierRegistryPortal.sol` all declare
their verifier interface with a dynamic `uint256[] publicSignals` parameter.
The actual generated verifier uses a fixed `uint256[6]`. Fixed- and
dynamic-size arrays produce different Solidity function selectors, so those
four contracts would call the wrong selector on-chain and every proof
submission would revert. Only `ZKPVerifierRegistryBytesV2.sol` and
`ZKPVerifierRegistryDirect.sol` match the real verifier's ABI; BytesV2 is the
one built as a reusable registry rather than a one-off hardcoded demo, so it
is the one this deploy script uses. Fix the interface type before deploying
any of the other four.
