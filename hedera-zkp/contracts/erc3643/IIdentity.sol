// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// Minimal marker type standing in for OnchainID's IIdentity in the full
/// T-REX suite. The full interface manages ERC-734/735 keys and claims;
/// this project substitutes claim verification with a ZK proof instead,
/// so only the type is needed to satisfy IIdentityRegistry's signatures.
interface IIdentity {}
