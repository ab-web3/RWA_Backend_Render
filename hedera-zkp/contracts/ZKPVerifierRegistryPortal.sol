// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IZKProofVerifierPortal {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicSignals
    ) external view returns (bool);
}

/**
 * Hedera Contract Builder-friendly registry.
 * Fixed arrays are entered through separate scalar setter calls.
 */
contract ZKPVerifierRegistryPortal {
    address public owner;
    IZKProofVerifierPortal public proofVerifier;
    mapping(uint256 => bool) public usedNullifier;
    mapping(bytes32 => bool) public approvedCredential;

    struct PendingProof {
        uint256 a0;
        uint256 a1;
        uint256 b00;
        uint256 b01;
        uint256 b10;
        uint256 b11;
        uint256 c0;
        uint256 c1;
        uint256 claimCommitment;
        uint256 nullifier;
        uint256 eligible;
        uint256 tokenId;
        uint256 credentialExpiry;
        uint256 currentTime;
        bool partA;
        bool partB;
        bool signals;
    }

    mapping(address => PendingProof) public pendingProof;

    event ProofAccepted(
        uint256 indexed tokenId,
        uint256 indexed nullifier,
        uint256 indexed claimCommitment,
        address caller
    );

    constructor(address verifier_) {
        require(verifier_ != address(0), "zero verifier");
        owner = msg.sender;
        proofVerifier = IZKProofVerifierPortal(verifier_);
    }

    function setProofPartA(
        uint256 a0,
        uint256 a1,
        uint256 c0,
        uint256 c1
    ) external {
        PendingProof storage p = pendingProof[msg.sender];
        p.a0 = a0;
        p.a1 = a1;
        p.c0 = c0;
        p.c1 = c1;
        p.partA = true;
    }

    function setProofPartB(
        uint256 b00,
        uint256 b01,
        uint256 b10,
        uint256 b11
    ) external {
        PendingProof storage p = pendingProof[msg.sender];
        p.b00 = b00;
        p.b01 = b01;
        p.b10 = b10;
        p.b11 = b11;
        p.partB = true;
    }

    function setPublicSignals(
        uint256 claimCommitment,
        uint256 nullifier,
        uint256 eligible,
        uint256 tokenId,
        uint256 credentialExpiry,
        uint256 currentTime
    ) external {
        PendingProof storage p = pendingProof[msg.sender];
        p.claimCommitment = claimCommitment;
        p.nullifier = nullifier;
        p.eligible = eligible;
        p.tokenId = tokenId;
        p.credentialExpiry = credentialExpiry;
        p.currentTime = currentTime;
        p.signals = true;
    }

    function verifyStoredProof() external returns (bool) {
        PendingProof storage p = pendingProof[msg.sender];
        require(p.partA && p.partB && p.signals, "proof parts missing");
        require(p.eligible == 1, "not eligible");
        require(!usedNullifier[p.nullifier], "nullifier already used");

        uint256[2] memory a;
        a[0] = p.a0;
        a[1] = p.a1;

        uint256[2][2] memory b;
        b[0][0] = p.b00;
        b[0][1] = p.b01;
        b[1][0] = p.b10;
        b[1][1] = p.b11;

        uint256[2] memory c;
        c[0] = p.c0;
        c[1] = p.c1;

        uint256[] memory signals = new uint256[](6);
        signals[0] = p.claimCommitment;
        signals[1] = p.nullifier;
        signals[2] = p.eligible;
        signals[3] = p.tokenId;
        signals[4] = p.credentialExpiry;
        signals[5] = p.currentTime;

        require(proofVerifier.verifyProof(a, b, c, signals), "invalid proof");

        usedNullifier[p.nullifier] = true;
        approvedCredential[bytes32(p.claimCommitment)] = true;
        emit ProofAccepted(p.tokenId, p.nullifier, p.claimCommitment, msg.sender);
        return true;
    }
}
