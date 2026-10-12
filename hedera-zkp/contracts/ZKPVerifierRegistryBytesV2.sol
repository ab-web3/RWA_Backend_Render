// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./erc3643/IIdentityRegistry.sol";
import "./erc3643/IIdentity.sol";

interface IZKProofVerifierV2 {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[6] calldata input
    ) external view returns (bool);
}

/**
 * On successful ZK proof verification, this contract acts as the ERC-3643
 * "agent" that registers the caller as a verified identity in the
 * IdentityRegistry, in place of the usual claim-issuer inspection. Any
 * ERC-3643 token pointed at that IdentityRegistry will then treat the
 * caller as eligible via the standard isVerified() check.
 */
contract ZKPVerifierRegistryBytesV2 {
    address public owner;
    IZKProofVerifierV2 public proofVerifier;
    IIdentityRegistry public identityRegistry;

    mapping(uint256 => bool) public usedNullifier;
    mapping(bytes32 => bool) public approvedCredential;

    event ProofAccepted(
        uint256 indexed tokenId,
        uint256 indexed nullifier,
        uint256 claimCommitment,
        uint256 expiry
    );

    event CredentialRevoked(bytes32 indexed credential);
    event ProofVerifierUpdated(address indexed verifier);
    event IdentityRegistryUpdated(address indexed identityRegistry);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address verifier_, address identityRegistry_) {
        require(verifier_ != address(0), "Invalid verifier");
        require(identityRegistry_ != address(0), "Invalid identity registry");
        owner = msg.sender;
        proofVerifier = IZKProofVerifierV2(verifier_);
        identityRegistry = IIdentityRegistry(identityRegistry_);
    }

    function verifyEncoded(bytes calldata encoded)
        external
        returns (bool)
    {
        (
            uint256[2] memory a,
            uint256[2][2] memory b,
            uint256[2] memory c,
            uint256[6] memory input
        ) = abi.decode(
            encoded,
            (uint256[2], uint256[2][2], uint256[2], uint256[6])
        );

        uint256 claimCommitment = input[0];
        uint256 nullifier = input[1];
        uint256 eligible = input[2];
        uint256 tokenId = input[3];
        uint256 expiry = input[4];

        require(eligible == 1, "Not eligible");
        require(!usedNullifier[nullifier], "Nullifier already used");

        bool valid = proofVerifier.verifyProof(a, b, c, input);
        require(valid, "Invalid ZK proof");

        usedNullifier[nullifier] = true;
        approvedCredential[bytes32(claimCommitment)] = true;
        identityRegistry.registerIdentity(msg.sender, IIdentity(msg.sender), 0);

        emit ProofAccepted(tokenId, nullifier, claimCommitment, expiry);
        return true;
    }

    function revokeCredential(bytes32 credential) external onlyOwner {
        approvedCredential[credential] = false;
        emit CredentialRevoked(credential);
    }

    function setProofVerifier(address verifier_) external onlyOwner {
        require(verifier_ != address(0), "Invalid verifier");
        proofVerifier = IZKProofVerifierV2(verifier_);
        emit ProofVerifierUpdated(verifier_);
    }

    function setIdentityRegistry(address identityRegistry_) external onlyOwner {
        require(identityRegistry_ != address(0), "Invalid identity registry");
        identityRegistry = IIdentityRegistry(identityRegistry_);
        emit IdentityRegistryUpdated(identityRegistry_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}
