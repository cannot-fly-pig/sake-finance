import { Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import {
  ContractToPoolMapping,
  Pool,
  Protocol,
  Reserve,
  SubToken,
  User,
  UserReserve,
} from '../../generated/schema';
import { zeroAddress, zeroBI } from '../utils/converters';

// Lightweight version: Minimal initialization functions only

export function getOrInitUser(address: Address): User {
  let addressHex = address.toHexString();
  let user = User.load(addressHex);
  if (!user) {
    user = new User(addressHex);
    user.borrowedReservesCount = 0;
    user.save();
  }
  return user as User;
}

export function getOrInitUserReserve(
  user: Address,
  underlyingAsset: Bytes,
  event: ethereum.Event
): UserReserve {
  let userReserveId = user.toHexString() + underlyingAsset.toHexString();
  let userReserve = UserReserve.load(userReserveId);
  if (!userReserve) {
    userReserve = new UserReserve(userReserveId);
    // Convert Bytes to Address for getOrInitReserve
    let underlyingAssetAddress = Address.fromBytes(underlyingAsset);
    let reserve = getOrInitReserve(underlyingAssetAddress, event);
    userReserve.pool = reserve.pool;
    userReserve.user = user.toHexString();
    userReserve.reserve = reserve.id;

    // Collateral fields
    userReserve.scaledATokenBalance = zeroBI();
    userReserve.currentATokenBalance = zeroBI();
    userReserve.usageAsCollateralEnabledOnUser = false;

    // Debt fields
    userReserve.scaledVariableDebt = zeroBI();
    userReserve.currentVariableDebt = zeroBI();
    userReserve.principalStableDebt = zeroBI();
    userReserve.currentStableDebt = zeroBI();
    userReserve.currentTotalDebt = zeroBI();

    // Interest rate indexes
    userReserve.variableBorrowIndex = zeroBI();
    userReserve.liquidityIndex = zeroBI();
    userReserve.liquidityRate = zeroBI();
    userReserve.variableBorrowRate = zeroBI();
    userReserve.stableBorrowRate = zeroBI();
    userReserve.stableBorrowLastUpdateTimestamp = 0;

    userReserve.lastUpdateTimestamp = 0;

    // Initialize user if not exists
    getOrInitUser(user);
  }
  return userReserve as UserReserve;
}

export function getOrInitReserve(underlyingAsset: Address, event: ethereum.Event): Reserve {
  let reserveId = underlyingAsset.toHexString();
  let reserve = Reserve.load(reserveId);
  if (!reserve) {
    reserve = new Reserve(reserveId);
    reserve.underlyingAsset = underlyingAsset;
    reserve.pool = getPoolByContract(event);
    reserve.symbol = '';
    reserve.name = '';
    reserve.decimals = 0;
    reserve.isActive = false;
    reserve.isFrozen = false;

    // These will be set by handleReserveInitialized
    reserve.aToken = zeroAddress().toHexString();
    reserve.vToken = zeroAddress().toHexString();
  }
  return reserve as Reserve;
}

export function getOrInitSubToken(address: Address): SubToken {
  let subTokenId = address.toHexString();
  let subToken = SubToken.load(subTokenId);
  if (!subToken) {
    subToken = new SubToken(subTokenId);
    subToken.underlyingAssetAddress = zeroAddress();
    subToken.pool = '';
    subToken.underlyingAssetDecimals = 0;
    subToken.tokenContractImpl = zeroAddress();
  }
  return subToken as SubToken;
}

export function getPoolByContract(event: ethereum.Event): string {
  let contractAddress = event.address.toHexString();
  let contractToPoolMapping = ContractToPoolMapping.load(contractAddress);
  if (contractToPoolMapping === null) {
    throw new Error(contractAddress + 'is not registered in ContractToPoolMapping');
  }
  return contractToPoolMapping.pool;
}

export function createMapContractToPool(contractAddress: Bytes, poolId: string): void {
  let contractAddressHex = contractAddress.toHexString();
  let contractToPoolMapping = ContractToPoolMapping.load(contractAddressHex);

  if (contractToPoolMapping) {
    return;
  }
  contractToPoolMapping = new ContractToPoolMapping(contractAddressHex);
  contractToPoolMapping.pool = poolId;
  contractToPoolMapping.save();
}

export function getProtocol(): Protocol {
  let protocolId = '1';
  let protocol = Protocol.load(protocolId);
  if (!protocol) {
    protocol = new Protocol(protocolId);
    protocol.save();
  }
  return protocol as Protocol;
}

export function getOrInitPool(id: string): Pool {
  let pool = Pool.load(id);
  if (!pool) {
    pool = new Pool(id);
    pool.protocol = getProtocol().id;
    pool.active = true;
    pool.paused = false;
  }
  return pool as Pool;
}
