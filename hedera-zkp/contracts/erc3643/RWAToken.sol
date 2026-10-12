// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./IERC3643.sol";

/**
 * ERC-3643 token implementation for the V5 RWA offering. Every transfer,
 * transferFrom, and mint requires identityRegistry.isVerified(to) to be
 * true, which is only set once a Groth16 ZK proof of eligibility has been
 * verified on-chain (see IdentityRegistry.sol and
 * ../ZKPVerifierRegistryBytesV2.sol).
 */
contract RWAToken is IERC3643 {
    string private _name;
    string private _symbol;
    uint8 private constant DECIMALS = 18;
    string private constant VERSION = "1.0.0";
    address private _onchainID;
    uint256 private _totalSupply;
    bool private _paused;

    address public owner;
    IIdentityRegistry private _identityRegistry;
    ICompliance private _compliance;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _frozen;
    mapping(address => uint256) private _frozenTokens;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(string memory name_, string memory symbol_, address identityRegistry_, address compliance_) {
        _name = name_;
        _symbol = symbol_;
        owner = msg.sender;
        _identityRegistry = IIdentityRegistry(identityRegistry_);
        _compliance = ICompliance(compliance_);
        emit IdentityRegistryAdded(identityRegistry_);
        emit ComplianceAdded(compliance_);
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner_, address spender) external view override returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function onchainID() external view override returns (address) {
        return _onchainID;
    }

    function version() external pure override returns (string memory) {
        return VERSION;
    }

    function identityRegistry() external view override returns (IIdentityRegistry) {
        return _identityRegistry;
    }

    function compliance() external view override returns (ICompliance) {
        return _compliance;
    }

    function paused() external view override returns (bool) {
        return _paused;
    }

    function isFrozen(address _userAddress) external view override returns (bool) {
        return _frozen[_userAddress];
    }

    function getFrozenTokens(address _userAddress) external view override returns (uint256) {
        return _frozenTokens[_userAddress];
    }

    function setName(string calldata name_) external override onlyOwner {
        _name = name_;
        _emitInfo();
    }

    function setSymbol(string calldata symbol_) external override onlyOwner {
        _symbol = symbol_;
        _emitInfo();
    }

    function setOnchainID(address onchainID_) external override onlyOwner {
        _onchainID = onchainID_;
        _emitInfo();
    }

    function pause() external override onlyOwner {
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external override onlyOwner {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    function setAddressFrozen(address _userAddress, bool _freeze) public override onlyOwner {
        _frozen[_userAddress] = _freeze;
        emit AddressFrozen(_userAddress, _freeze, msg.sender);
    }

    function freezePartialTokens(address _userAddress, uint256 _amount) public override onlyOwner {
        require(_balances[_userAddress] - _frozenTokens[_userAddress] >= _amount, "amount exceeds available balance");
        _frozenTokens[_userAddress] += _amount;
        emit TokensFrozen(_userAddress, _amount);
    }

    function unfreezePartialTokens(address _userAddress, uint256 _amount) public override onlyOwner {
        require(_frozenTokens[_userAddress] >= _amount, "amount exceeds frozen tokens");
        _frozenTokens[_userAddress] -= _amount;
        emit TokensUnfrozen(_userAddress, _amount);
    }

    function setIdentityRegistry(address _identityRegistry_) external override onlyOwner {
        _identityRegistry = IIdentityRegistry(_identityRegistry_);
        emit IdentityRegistryAdded(_identityRegistry_);
    }

    function setCompliance(address _compliance_) external override onlyOwner {
        _compliance = ICompliance(_compliance_);
        emit ComplianceAdded(_compliance_);
    }

    function _transferChecked(address from, address to, uint256 amount) internal {
        require(!_paused, "paused");
        require(!_frozen[from] && !_frozen[to], "address frozen");
        require(_balances[from] - _frozenTokens[from] >= amount, "insufficient unfrozen balance");
        require(_identityRegistry.isVerified(to), "receiver not ZK-verified");
        require(_compliance.canTransfer(from, to, amount), "compliance check failed");

        _balances[from] -= amount;
        _balances[to] += amount;
        _compliance.transferred(from, to, amount);
        emit Transfer(from, to, amount);
    }

    function transfer(address _to, uint256 _amount) public override returns (bool) {
        _transferChecked(msg.sender, _to, _amount);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _amount) public override returns (bool) {
        uint256 allowed = _allowances[_from][msg.sender];
        require(allowed >= _amount, "allowance exceeded");
        _allowances[_from][msg.sender] = allowed - _amount;
        _transferChecked(_from, _to, _amount);
        return true;
    }

    function forcedTransfer(address _from, address _to, uint256 _amount) public override onlyOwner returns (bool) {
        require(_balances[_from] >= _amount, "insufficient balance");
        _balances[_from] -= _amount;
        _balances[_to] += _amount;
        _compliance.transferred(_from, _to, _amount);
        emit Transfer(_from, _to, _amount);
        return true;
    }

    function mint(address _to, uint256 _amount) public override onlyOwner {
        require(_identityRegistry.isVerified(_to), "receiver not ZK-verified");
        require(_compliance.canTransfer(address(0), _to, _amount), "compliance check failed");
        _totalSupply += _amount;
        _balances[_to] += _amount;
        _compliance.created(_to, _amount);
        emit Transfer(address(0), _to, _amount);
    }

    uint256 public constant DEMO_CLAIM_AMOUNT = 100 * 1e18;
    mapping(address => bool) public hasClaimedDemoTokens;

    /**
     * Not part of the ERC-3643 interface. Lets any wallet that has been
     * ZK-verified (via ZKPVerifierRegistryBytesV2) mint itself a fixed demo
     * allocation directly from a connected wallet (e.g. MetaMask), without
     * needing the contract owner's key. Still fully gated by the same
     * identityRegistry.isVerified() / compliance.canTransfer() checks as
     * mint(), and one-time per address.
     */
    function claimDemoTokens() external {
        require(!hasClaimedDemoTokens[msg.sender], "already claimed");
        require(_identityRegistry.isVerified(msg.sender), "receiver not ZK-verified");
        require(_compliance.canTransfer(address(0), msg.sender, DEMO_CLAIM_AMOUNT), "compliance check failed");

        hasClaimedDemoTokens[msg.sender] = true;
        _totalSupply += DEMO_CLAIM_AMOUNT;
        _balances[msg.sender] += DEMO_CLAIM_AMOUNT;
        _compliance.created(msg.sender, DEMO_CLAIM_AMOUNT);
        emit Transfer(address(0), msg.sender, DEMO_CLAIM_AMOUNT);
    }

    function burn(address _userAddress, uint256 _amount) public override onlyOwner {
        require(_balances[_userAddress] >= _amount, "insufficient balance");
        _balances[_userAddress] -= _amount;
        _totalSupply -= _amount;
        _compliance.destroyed(_userAddress, _amount);
        emit Transfer(_userAddress, address(0), _amount);
    }

    function recoveryAddress(
        address _lostWallet,
        address _newWallet,
        address _investorOnchainID
    ) external override onlyOwner returns (bool) {
        uint256 balance = _balances[_lostWallet];
        _balances[_lostWallet] = 0;
        _balances[_newWallet] += balance;
        emit RecoverySuccess(_lostWallet, _newWallet, _investorOnchainID);
        emit Transfer(_lostWallet, _newWallet, balance);
        return true;
    }

    function batchTransfer(address[] calldata _toList, uint256[] calldata _amounts) external override {
        for (uint256 i = 0; i < _toList.length; i++) {
            transfer(_toList[i], _amounts[i]);
        }
    }

    function batchForcedTransfer(
        address[] calldata _fromList,
        address[] calldata _toList,
        uint256[] calldata _amounts
    ) external override {
        for (uint256 i = 0; i < _fromList.length; i++) {
            forcedTransfer(_fromList[i], _toList[i], _amounts[i]);
        }
    }

    function batchMint(address[] calldata _toList, uint256[] calldata _amounts) external override {
        for (uint256 i = 0; i < _toList.length; i++) {
            mint(_toList[i], _amounts[i]);
        }
    }

    function batchBurn(address[] calldata _userAddresses, uint256[] calldata _amounts) external override {
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            burn(_userAddresses[i], _amounts[i]);
        }
    }

    function batchSetAddressFrozen(address[] calldata _userAddresses, bool[] calldata _freeze) external override {
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            setAddressFrozen(_userAddresses[i], _freeze[i]);
        }
    }

    function batchFreezePartialTokens(address[] calldata _userAddresses, uint256[] calldata _amounts) external override {
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            freezePartialTokens(_userAddresses[i], _amounts[i]);
        }
    }

    function batchUnfreezePartialTokens(address[] calldata _userAddresses, uint256[] calldata _amounts) external override {
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            unfreezePartialTokens(_userAddresses[i], _amounts[i]);
        }
    }

    function _emitInfo() internal {
        emit UpdatedTokenInformation(_name, _symbol, DECIMALS, VERSION, _onchainID);
    }
}
