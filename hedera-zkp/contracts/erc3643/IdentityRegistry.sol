// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./IIdentityRegistry.sol";

/**
 * ERC-3643 IdentityRegistry implementation.
 *
 * Standard T-REX registers an identity after inspecting signed claims held
 * by the investor's OnchainID contract. This project substitutes that claim
 * inspection with ZK-proof verification: an authorized agent (this project's
 * ZKPVerifierRegistryBytesV2, see ../ZKPVerifierRegistryBytesV2.sol) calls
 * registerIdentity() only after a Groth16 proof of eligibility has verified
 * on-chain. isVerified() and the rest of the interface behave exactly as
 * ERC-3643 specifies, so any compliant token can consume this registry
 * unmodified.
 */
contract IdentityRegistry is IIdentityRegistry {
    address public owner;
    mapping(address => bool) public agents;

    IIdentityRegistryStorage private _identityStorage;
    ITrustedIssuersRegistry private _issuersRegistry;
    IClaimTopicsRegistry private _topicsRegistry;

    mapping(address => IIdentity) private _identities;
    mapping(address => uint16) private _countries;
    mapping(address => bool) private _verified;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAgent() {
        require(agents[msg.sender] || msg.sender == owner, "not agent");
        _;
    }

    constructor() {
        owner = msg.sender;
        agents[msg.sender] = true;
    }

    function setAgent(address agent_, bool allowed) external onlyOwner {
        agents[agent_] = allowed;
    }

    function identityStorage() external view override returns (IIdentityRegistryStorage) {
        return _identityStorage;
    }

    function issuersRegistry() external view override returns (ITrustedIssuersRegistry) {
        return _issuersRegistry;
    }

    function topicsRegistry() external view override returns (IClaimTopicsRegistry) {
        return _topicsRegistry;
    }

    function contains(address _userAddress) external view override returns (bool) {
        return address(_identities[_userAddress]) != address(0);
    }

    function isVerified(address _userAddress) external view override returns (bool) {
        return _verified[_userAddress];
    }

    function identity(address _userAddress) external view override returns (IIdentity) {
        return _identities[_userAddress];
    }

    function investorCountry(address _userAddress) external view override returns (uint16) {
        return _countries[_userAddress];
    }

    function setIdentityRegistryStorage(address _identityRegistryStorage) external override onlyOwner {
        _identityStorage = IIdentityRegistryStorage(_identityRegistryStorage);
        emit IdentityStorageSet(_identityRegistryStorage);
    }

    function setClaimTopicsRegistry(address _claimTopicsRegistry) external override onlyOwner {
        _topicsRegistry = IClaimTopicsRegistry(_claimTopicsRegistry);
        emit ClaimTopicsRegistrySet(_claimTopicsRegistry);
    }

    function setTrustedIssuersRegistry(address _trustedIssuersRegistry) external override onlyOwner {
        _issuersRegistry = ITrustedIssuersRegistry(_trustedIssuersRegistry);
        emit TrustedIssuersRegistrySet(_trustedIssuersRegistry);
    }

    function registerIdentity(address _userAddress, IIdentity _identity, uint16 _country) public override onlyAgent {
        _identities[_userAddress] = _identity;
        _countries[_userAddress] = _country;
        _verified[_userAddress] = true;
        emit IdentityRegistered(_userAddress, _identity);
    }

    function deleteIdentity(address _userAddress) external override onlyAgent {
        IIdentity removed = _identities[_userAddress];
        delete _identities[_userAddress];
        delete _countries[_userAddress];
        _verified[_userAddress] = false;
        emit IdentityRemoved(_userAddress, removed);
    }

    function updateCountry(address _userAddress, uint16 _country) external override onlyAgent {
        _countries[_userAddress] = _country;
        emit CountryUpdated(_userAddress, _country);
    }

    function updateIdentity(address _userAddress, IIdentity _identity) external override onlyAgent {
        IIdentity oldIdentity = _identities[_userAddress];
        _identities[_userAddress] = _identity;
        emit IdentityUpdated(oldIdentity, _identity);
    }

    function batchRegisterIdentity(
        address[] calldata _userAddresses,
        IIdentity[] calldata _batchIdentities,
        uint16[] calldata _batchCountries
    ) external override onlyAgent {
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            registerIdentity(_userAddresses[i], _batchIdentities[i], _batchCountries[i]);
        }
    }
}
