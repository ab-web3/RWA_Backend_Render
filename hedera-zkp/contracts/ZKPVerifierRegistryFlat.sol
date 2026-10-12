// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IZKProofVerifierFlat {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicSignals
    ) external view returns (bool);
}

/**
 * Portal-friendly registry. Scalar parameters are used because the Hedera
 * Contract Builder does not accept fixed-array form inputs reliably.
 */
contract ZKPVerifierRegistryFlat {
    address public owner;
    IZKProofVerifierFlat public proofVerifier;
    mapping(uint256 => bool) public usedNullifier;
    mapping(bytes32 => bool) public approvedCredential;

    event ProofAccepted(
        uint256 indexed tokenId,
        uint256 indexed nullifier,
        uint256 indexed claimCommitment,
        address caller
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address verifier_) {
        require(verifier_ != address(0), "zero verifier");
        owner = msg.sender;
        proofVerifier = IZKProofVerifierFlat(verifier_);
    }

    function verifyAndRecordFlat(
        uint256 a0,
        uint256 a1,
        uint256 b00,
        uint256 b01,
        uint256 b10,
        uint256 b11,
        uint256 c0,
        uint256 c1,
        uint256 claimCommitment,
        uint256 nullifier,
        uint256 eligible,
        uint256 tokenId,
        uint256 credentialExpiry,
        uint256 currentTime
    ) external returns (bool) {
        require(eligible == 1, "not eligible");
        require(!usedNullifier[nullifier], "nullifier already used");

        uint256[2] memory a;
        a[0] = a0;
        a[1] = a1;

        uint256[2][2] memory b;
        b[0][0] = b00;
        b[0][1] = b01;
        b[1][0] = b10;
        b[1][1] = b11;

        uint256[2] memory c;
        c[0] = c0;
        c[1] = c1;

        uint256[] memory publicSignals = new uint256[](6);
        publicSignals[0] = claimCommitment;
        publicSignals[1] = nullifier;
        publicSignals[2] = eligible;
        publicSignals[3] = tokenId;
        publicSignals[4] = credentialExpiry;
        publicSignals[5] = currentTime;

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
