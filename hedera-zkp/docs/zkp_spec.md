# ZKP specification - initial draft

## Goal

Prove that an investor satisfies the approved eligibility condition for an RWA
token offering without revealing the investor's raw V5 attributes.

## Privacy boundary

Raw investor attributes remain off-chain. They must not be written to Hedera,
the verifier contract, event logs, proof files committed to the repository, or
public artifacts.

## Initial prototype

The first integration test can use the V5 `eligibility_label` as a private
witness and prove that it equals `1`. This only tests the proof and contract
plumbing; it does not validate the eligibility policy.

## Final intended statement

The investor holds a valid issuer credential, the credential is not expired or
revoked, the investor satisfies the offering's eligibility rule, and this proof
has not already been used.

## On-chain verifier inputs

- proof parameters;
- issuer or credential commitment;
- token/property identifier;
- expiry or validity reference;
- nullifier;
- claimed eligibility result.

## Required negative tests

- ineligible investor;
- tampered private witness;
- wrong token/property identifier;
- expired credential;
- revoked credential;
- reused nullifier;
- invalid issuer commitment.

