# Immediate implementation steps

1. Install the Node dependencies in this project.
2. Compile `circuits/v5_eligibility.circom`.
3. Create one eligible and one ineligible witness from the V5 CSV.
4. Run a local proof-generation and proof-verification test.
5. Generate the Solidity verifier with snarkjs after trusted setup.
6. Compile and deploy the verifier and registry to Hedera Testnet.
7. Add positive, tampering, expiry, wrong-token, and nullifier-reuse tests.
8. Connect successful verification to an ERC-3643 compliance function.

The current circuit rule is deliberately provisional: it proves
`eligibility_label == 1`. It must be replaced or justified after the V5 target
construction and leakage audit.
