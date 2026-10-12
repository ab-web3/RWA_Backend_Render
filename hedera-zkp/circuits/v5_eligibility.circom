pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// Prototype circuit for the V5 synthetic dataset.
//
// Private inputs:
//   eligibility_label, investor_secret, issuer_secret
// Public inputs/outputs:
//   token_id, credential_expiry, current_time, claim_commitment,
//   nullifier, eligible
//
// IMPORTANT: eligibility_label == 1 is only a temporary integration rule.
// Replace it with the approved eligibility policy after auditing how the V5
// target was generated.
template V5EligibilityClaim() {
    signal input eligibility_label;
    signal input investor_secret;
    signal input issuer_secret;

    signal input token_id;
    signal input credential_expiry;
    signal input current_time;

    signal output claim_commitment;
    signal output nullifier;
    signal output eligible;

    // The supplied label must be binary and eligible for this prototype.
    eligibility_label * (eligibility_label - 1) === 0;
    eligibility_label === 1;

    // Credential must still be valid at proof-verification time.
    component expiry_check = LessThan(64);
    expiry_check.in[0] <== current_time;
    expiry_check.in[1] <== credential_expiry;
    expiry_check.out === 1;

    // Bind the proof to the issuer and private investor secret.
    component commitment_hash = Poseidon(3);
    commitment_hash.inputs[0] <== eligibility_label;
    commitment_hash.inputs[1] <== investor_secret;
    commitment_hash.inputs[2] <== issuer_secret;
    claim_commitment <== commitment_hash.out;

    // A token-specific nullifier prevents the same private credential from
    // being reused for the same token offering.
    component nullifier_hash = Poseidon(2);
    nullifier_hash.inputs[0] <== investor_secret;
    nullifier_hash.inputs[1] <== token_id;
    nullifier <== nullifier_hash.out;

    eligible <== eligibility_label;
}

component main {public [token_id, credential_expiry, current_time]} = V5EligibilityClaim();
