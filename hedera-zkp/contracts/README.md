# Contracts

`ZKPVerifierRegistry.sol` is the first on-chain integration layer. It is
intended for Hedera Testnet and is separate from the ERC-3643 token contract.

Deployment order:

1. Generate the circuit-specific Groth16 verifier.
2. Deploy the generated verifier on Hedera EVM/Testnet.
3. Deploy `ZKPVerifierRegistry` with the generated verifier address.
4. Connect the registry result to the ERC-3643 identity/compliance adapter.

The current registry is a prototype and still requires access control review,
multisignature ownership, and a real ERC-3643 integration before production use.

## Which contract to deploy

Deploy `ZKPVerifierRegistryBytesV2.sol`. The other variants
(`ZKPVerifierRegistry.sol`, `ZKPVerifierRegistryBytes.sol`,
`ZKPVerifierRegistryFlat.sol`, `ZKPVerifierRegistryPortal.sol`) declare their
verifier interface with a dynamic `uint256[]` where the generated verifier
actually expects a fixed `uint256[6]` — different function selectors, so
calls from these four to the real verifier will revert. Fix that interface
type before deploying any of them. `ZKPVerifierRegistryDirect.sol` has the
correct ABI but is a hardcoded single-proof demo, not a reusable registry.
See `docs/DEPLOY_HEDERA.md` for the deploy steps.
