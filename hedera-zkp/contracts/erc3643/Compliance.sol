// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./ICompliance.sol";
import "./IIdentityRegistry.sol";

/**
 * Minimal ERC-3643 ModularCompliance-style implementation. The only rule
 * enforced is identity verification of the receiver, delegated to
 * IdentityRegistry.isVerified(), which this project's ZK proof flow sets.
 */
contract Compliance is ICompliance {
    address public owner;
    address private _boundToken;
    IIdentityRegistry public identityRegistry;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address identityRegistry_) {
        owner = msg.sender;
        identityRegistry = IIdentityRegistry(identityRegistry_);
    }

    function bindToken(address _token) external override onlyOwner {
        _boundToken = _token;
        emit TokenBound(_token);
    }

    function unbindToken(address _token) external override onlyOwner {
        require(_boundToken == _token, "not bound");
        _boundToken = address(0);
        emit TokenUnbound(_token);
    }

    function isTokenBound(address _token) external view override returns (bool) {
        return _boundToken == _token;
    }

    function getTokenBound() external view override returns (address) {
        return _boundToken;
    }

    function canTransfer(address, address _to, uint256) external view override returns (bool) {
        return identityRegistry.isVerified(_to);
    }

    function transferred(address, address, uint256) external override {}

    function created(address, uint256) external override {}

    function destroyed(address, uint256) external override {}
}
