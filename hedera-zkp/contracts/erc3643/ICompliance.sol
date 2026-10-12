// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// ERC-3643 ICompliance interface, exact signatures per EIP-3643.
interface ICompliance {
    event TokenBound(address _token);
    event TokenUnbound(address _token);

    function bindToken(address _token) external;
    function unbindToken(address _token) external;

    function isTokenBound(address _token) external view returns (bool);
    function getTokenBound() external view returns (address);

    function canTransfer(address _from, address _to, uint256 _amount) external view returns (bool);
    function transferred(address _from, address _to, uint256 _amount) external;
    function created(address _to, uint256 _amount) external;
    function destroyed(address _from, uint256 _amount) external;
}
