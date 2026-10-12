// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IZKProofVerifierDirect {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[6] calldata input
    ) external view returns (bool);
}

contract ZKPVerifierRegistryDirect {
    address public owner;
    IZKProofVerifierDirect public proofVerifier;

    mapping(uint256 => bool) public usedNullifier;
    mapping(bytes32 => bool) public approvedCredential;

    event ProofAccepted(
        uint256 indexed tokenId,
        uint256 indexed nullifier,
        uint256 claimCommitment,
        uint256 expiry
    );

    constructor(address verifier_) {
        require(verifier_ != address(0), "Invalid verifier");
        owner = msg.sender;
        proofVerifier = IZKProofVerifierDirect(verifier_);
    }

    function verifyDemo() external returns (bool) {
        uint256[2] memory a = [
            uint256(6457708229708190706945048543683005197482565973940591322205035243280357062835),
            uint256(18742809342001996737833077612277545582446864259134472376103225812938446034818)
        ];

        uint256[2][2] memory b = [
            [
                uint256(17947784740393521595747954933477275212080099497729211934934759830051521252481),
                uint256(17405469228738617002861917931974370849661199935053766983787295587640849311255)
            ],
            [
                uint256(19752185505284003385433869181054240791465598989935995450415067859959020332648),
                uint256(19419610247815376769372991053996922119150189968378616458045031567947271437680)
            ]
        ];

        uint256[2] memory c = [
            uint256(13662098974978174272041372468374086631160313494928451792431248248503662920014),
            uint256(2545313132814285037882589440290515329306728659779869642039355690664780255060)
        ];

        uint256[6] memory input = [
            uint256(12581539431898168050929484727927525631559858896555387709431014368482929558289),
            uint256(20063279438478801825164003529040707726865486590458371412478588979750230752517),
            uint256(1),
            uint256(1001),
            uint256(2000000000),
            uint256(1700000000)
        ];

        require(!usedNullifier[input[1]], "Nullifier already used");
        require(proofVerifier.verifyProof(a, b, c, input), "Invalid ZK proof");

        usedNullifier[input[1]] = true;
        approvedCredential[bytes32(input[0])] = true;

        emit ProofAccepted(input[3], input[1], input[0], input[4]);
        return true;
    }
}
