// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IZKProofVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicSignals
    ) external view returns (bool);
}

/**
 * Minimal Hedera-deployable registry for the generated ZKP verifier.
 *
 * This is not the ERC-3643 token itself. It records successful, non-replayed
 * eligibility proofs and is intended to be called by an ERC-3643 identity or
 * compliance adapter after the verifier has been configured.
 */
contract ZKPVerifierRegistry {
    address public owner;
    IZKProofVerifier public proofVerifier;
    mapping(uint256 => bool) public usedNullifier;
    mapping(bytes32 => bool) public approvedCredential;

    event ProofAccepted(
        uint256 indexed tokenId,
        uint256 indexed nullifier,
        uint256 indexed claimCommitment,
        address caller
    );
    event ProofVerifierUpdated(address indexed verifier);
    event CredentialRevoked(bytes32 indexed credentialCommitment);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address verifier_) {
        owner = msg.sender;
        proofVerifier = IZKProofVerifier(verifier_);
    }

    function setProofVerifier(address verifier_) external onlyOwner {
        require(verifier_ != address(0), "zero verifier");
        proofVerifier = IZKProofVerifier(verifier_);
        emit ProofVerifierUpdated(verifier_);
    }

    function revokeCredential(bytes32 credentialCommitment) external onlyOwner {
        approvedCredential[credentialCommitment] = false;
        emit CredentialRevoked(credentialCommitment);
    }

    function verifyAndRecord(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicSignals,
        uint256 tokenId,
        uint256 nullifier,
        uint256 claimCommitment
    ) external returns (bool) {

        // Circom exports main-component outputs first, followed by the
        // explicitly declared public inputs. For this circuit the order is:
        // [claimCommitment, nullifier, eligible, tokenId, expiry, now].
        require(publicSignals.length == 6, "wrong public signal count");
        require(publicSignals[2] == 1, "not eligible");
        require(publicSignals[3] == tokenId, "token mismatch");
        require(publicSignals[0] == claimCommitment, "commitment mismatch");
        require(publicSignals[1] == nullifier, "nullifier mismatch");
        require(!usedNullifier[nullifier], "nullifier already used");
        require(
            proofVerifier.verifyProof(a, b, c, publicSignals),
            "invalid proof"
        );

        usedNullifier[nullifier] = true;
        approvedCredential[bytes32(claimCommitment)] = true;
        emit ProofAccepted(tokenId, nullifier, claimCommitment, msg.sender);
        return true;
    }
}
