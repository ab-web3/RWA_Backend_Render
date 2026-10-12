// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IZKProofVerifierBytes {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicSignals
    ) external view returns (bool);
}

/**
 * Hedera Contract Builder adapter.
 * The proof is ABI-encoded off-chain and submitted as one bytes value because
 * Contract Builder does not reliably accept fixed-array function arguments.
 */
contract ZKPVerifierRegistryBytes {
    address public owner;
    IZKProofVerifierBytes public proofVerifier;
    mapping(uint256 => bool) public usedNullifier;
    mapping(bytes32 => bool) public approvedCredential;

    event ProofAccepted(
        uint256 indexed tokenId,
        uint256 indexed nullifier,
        uint256 indexed claimCommitment,
        address caller
    );

    constructor(address verifier_) {
        require(verifier_ != address(0), "zero verifier");
        owner = msg.sender;
        proofVerifier = IZKProofVerifierBytes(verifier_);
    }

    function verifyEncoded(bytes calldata encoded) external returns (bool) {
        (
            uint256[2] memory a,
            uint256[2][2] memory b,
            uint256[2] memory c,
            uint256[6] memory s
        ) = abi.decode(
            encoded,
            (uint256[2], uint256[2][2], uint256[2], uint256[6])
        );

        require(s[2] == 1, "not eligible");
        require(!usedNullifier[s[1]], "nullifier already used");

        uint256[] memory signals = new uint256[](6);
        for (uint256 i = 0; i < 6; i++) {
            signals[i] = s[i];
        }

        require(proofVerifier.verifyProof(a, b, c, signals), "invalid proof");

        usedNullifier[s[1]] = true;
        approvedCredential[bytes32(s[0])] = true;
        emit ProofAccepted(s[3], s[1], s[0], msg.sender);
        return true;
    }
}
