import { Pool } from '../../generated/templates/Pool/Pool';
import {
  BalanceTransfer,
  Mint as ATokenMint,
  Burn as ATokenBurn,
} from '../../generated/templates/AToken/AToken';
import {
  ATokenBalanceHistoryItem,
  UserReserve,
  Reserve,
  Pool as PoolSchema,
} from '../../generated/schema';
import {
  getOrInitReserve,
  getOrInitUserReserve,
  getOrInitSubToken,
  getOrInitUser,
  getPriceOracleAsset,
  getOrInitReserveParamsHistoryItem,
  getPoolByContract,
} from '../helpers/initializers';
import { getUpdateBlock, zeroBI } from '../utils/converters';
import { calculateUtilizationRate } from '../helpers/reserve-logic';
import { Address, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts';
import { rayDiv, rayMul } from '../helpers/math';
import { getHistoryEntityId } from '../utils/id-generation';
import { dataSource } from '@graphprotocol/graph-ts';

// TODO: check if we need to add stuff to history
function saveUserReserveAHistory(
  userReserve: UserReserve,
  event: ethereum.Event,
  index: BigInt
): void {
  let aTokenBalanceHistoryItem = new ATokenBalanceHistoryItem(
    userReserve.id + event.transaction.hash.toHexString()
  );
  aTokenBalanceHistoryItem.scaledATokenBalance = userReserve.scaledATokenBalance;
  aTokenBalanceHistoryItem.currentATokenBalance = userReserve.currentATokenBalance;
  aTokenBalanceHistoryItem.userReserve = userReserve.id;
  aTokenBalanceHistoryItem.index = index;
  aTokenBalanceHistoryItem.timestamp = event.block.timestamp.toI32();
  aTokenBalanceHistoryItem.save();
}

function saveReserve(reserve: Reserve, event: ethereum.Event): void {
  reserve.utilizationRate = calculateUtilizationRate(reserve);
  reserve.save();

  let reserveParamsHistoryItem = getOrInitReserveParamsHistoryItem(
    getHistoryEntityId(event),
    reserve
  );
  reserveParamsHistoryItem.totalScaledVariableDebt = reserve.totalScaledVariableDebt;
  reserveParamsHistoryItem.totalCurrentVariableDebt = reserve.totalCurrentVariableDebt;
  reserveParamsHistoryItem.totalPrincipalStableDebt = reserve.totalPrincipalStableDebt;
  reserveParamsHistoryItem.lifetimePrincipalStableDebt = reserve.lifetimePrincipalStableDebt;
  reserveParamsHistoryItem.lifetimeScaledVariableDebt = reserve.lifetimeScaledVariableDebt;
  reserveParamsHistoryItem.lifetimeCurrentVariableDebt = reserve.lifetimeCurrentVariableDebt;
  reserveParamsHistoryItem.lifetimeLiquidity = reserve.lifetimeLiquidity;
  reserveParamsHistoryItem.lifetimeBorrows = reserve.lifetimeBorrows;
  reserveParamsHistoryItem.lifetimeRepayments = reserve.lifetimeRepayments;
  reserveParamsHistoryItem.lifetimeWithdrawals = reserve.lifetimeWithdrawals;
  reserveParamsHistoryItem.lifetimeLiquidated = reserve.lifetimeLiquidated;
  reserveParamsHistoryItem.lifetimeFlashLoanPremium = reserve.lifetimeFlashLoanPremium;
  reserveParamsHistoryItem.lifetimeFlashLoanLPPremium = reserve.lifetimeFlashLoanLPPremium;
  reserveParamsHistoryItem.lifetimeFlashLoanProtocolPremium =
    reserve.lifetimeFlashLoanProtocolPremium;
  reserveParamsHistoryItem.lifetimeFlashLoans = reserve.lifetimeFlashLoans;
  // reserveParamsHistoryItem.lifetimeStableDebFeeCollected = reserve.lifetimeStableDebFeeCollected;
  // reserveParamsHistoryItem.lifetimeVariableDebtFeeCollected = reserve.lifetimeVariableDebtFeeCollected;
  reserveParamsHistoryItem.lifetimeReserveFactorAccrued = reserve.lifetimeReserveFactorAccrued;
  reserveParamsHistoryItem.lifetimeSuppliersInterestEarned =
    reserve.lifetimeSuppliersInterestEarned;
  reserveParamsHistoryItem.availableLiquidity = reserve.availableLiquidity;
  reserveParamsHistoryItem.totalLiquidity = reserve.totalLiquidity;
  reserveParamsHistoryItem.totalLiquidityAsCollateral = reserve.totalLiquidityAsCollateral;
  reserveParamsHistoryItem.utilizationRate = reserve.utilizationRate;
  reserveParamsHistoryItem.variableBorrowRate = reserve.variableBorrowRate;
  reserveParamsHistoryItem.variableBorrowIndex = reserve.variableBorrowIndex;
  reserveParamsHistoryItem.stableBorrowRate = reserve.stableBorrowRate;
  reserveParamsHistoryItem.liquidityIndex = reserve.liquidityIndex;
  reserveParamsHistoryItem.liquidityRate = reserve.liquidityRate;
  reserveParamsHistoryItem.totalATokenSupply = reserve.totalATokenSupply;
  reserveParamsHistoryItem.averageStableBorrowRate = reserve.averageStableRate;
  reserveParamsHistoryItem.accruedToTreasury = reserve.accruedToTreasury;
  let priceOracleAsset = getPriceOracleAsset(reserve.price);
  reserveParamsHistoryItem.priceInEth = priceOracleAsset.priceInEth;

  reserveParamsHistoryItem.priceInUsd = reserveParamsHistoryItem.priceInEth.toBigDecimal();

  reserveParamsHistoryItem.timestamp = event.block.timestamp.toI32();
  reserveParamsHistoryItem.save();
}

function tokenBurn(
  event: ethereum.Event,
  from: Address,
  value: BigInt,
  balanceIncrease: BigInt,
  index: BigInt
): void {
  let aToken = getOrInitSubToken(event.address);
  let userReserve = getOrInitUserReserve(from, aToken.underlyingAssetAddress, event);
  let poolReserve = getOrInitReserve(aToken.underlyingAssetAddress, event);

  const userBalanceChange = value.plus(balanceIncrease);
  let calculatedAmount = rayDiv(userBalanceChange, index);

  userReserve.scaledATokenBalance = userReserve.scaledATokenBalance.minus(calculatedAmount);
  userReserve.currentATokenBalance = rayMul(userReserve.scaledATokenBalance, index);
  userReserve.variableBorrowIndex = poolReserve.variableBorrowIndex;
  userReserve.liquidityRate = poolReserve.liquidityRate;

  // TODO: review liquidity?
  poolReserve.totalSupplies = poolReserve.totalSupplies.minus(userBalanceChange);
  // poolReserve.availableLiquidity = poolReserve.totalDeposits
  //   .minus(poolReserve.totalPrincipalStableDebt)
  //   .minus(poolReserve.totalScaledVariableDebt);

  poolReserve.availableLiquidity = poolReserve.availableLiquidity.minus(userBalanceChange);
  poolReserve.totalATokenSupply = poolReserve.totalATokenSupply.minus(userBalanceChange);

  poolReserve.totalLiquidity = poolReserve.totalLiquidity.minus(userBalanceChange);
  poolReserve.lifetimeWithdrawals = poolReserve.lifetimeWithdrawals.plus(userBalanceChange);

  if (userReserve.usageAsCollateralEnabledOnUser) {
    poolReserve.totalLiquidityAsCollateral = poolReserve.totalLiquidityAsCollateral.minus(
      userBalanceChange
    );
  }
  saveReserve(poolReserve, event);

  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();
  saveUserReserveAHistory(userReserve, event, index);
}

function tokenMint(
  event: ethereum.Event,
  onBehalf: Address,
  value: BigInt,
  balanceIncrease: BigInt,
  index: BigInt
): void {
  let aToken = getOrInitSubToken(event.address);
  let poolReserve = getOrInitReserve(aToken.underlyingAssetAddress, event);

  const userBalanceChange = value.minus(balanceIncrease);

  poolReserve.totalATokenSupply = poolReserve.totalATokenSupply.plus(userBalanceChange);
  let poolId = getPoolByContract(event);
  let pool = PoolSchema.load(poolId);
  if (pool && pool.pool) {
    let poolContract = Pool.bind(Address.fromString((pool.pool as Bytes).toHexString()));
    const reserveData = poolContract.try_getReserveData(
      Address.fromString(aToken.underlyingAssetAddress.toHexString())
    );
    if (!reserveData.reverted) {
      poolReserve.accruedToTreasury = reserveData.value.accruedToTreasury;
    } else {
      log.error('error reading reserveData. Pool: {}, Underlying: {}', [
        (pool.pool as Bytes).toHexString(),
        aToken.underlyingAssetAddress.toHexString(),
      ]);
    }
  }

  // Check if we are minting to treasury for mainnet and polygon
  if (
    onBehalf.toHexString() != '0xB2289E329D2F85F1eD31Adbb30eA345278F21bcf'.toLowerCase() &&
    onBehalf.toHexString() != '0xe8599F3cc5D38a9aD6F3684cd5CEa72f10Dbc383'.toLowerCase() &&
    onBehalf.toHexString() != '0xBe85413851D195fC6341619cD68BfDc26a25b928'.toLowerCase() &&
    onBehalf.toHexString() != '0x5ba7fd868c40c16f7aDfAe6CF87121E13FC2F7a0'.toLowerCase() &&
    onBehalf.toHexString() != '0x8A020d92D6B119978582BE4d3EdFdC9F7b28BF31'.toLowerCase() &&
    onBehalf.toHexString() != '0x053D55f9B5AF8694c503EB288a1B7E552f590710'.toLowerCase() &&
    onBehalf.toHexString() != '0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c'.toLowerCase()
  ) {
    let userReserve = getOrInitUserReserve(onBehalf, aToken.underlyingAssetAddress, event);
    let calculatedAmount = rayDiv(userBalanceChange, index);

    userReserve.scaledATokenBalance = userReserve.scaledATokenBalance.plus(calculatedAmount);
    userReserve.currentATokenBalance = rayMul(userReserve.scaledATokenBalance, index);

    userReserve.liquidityRate = poolReserve.liquidityRate;
    userReserve.variableBorrowIndex = poolReserve.variableBorrowIndex;
    userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();

    userReserve.save();

    // TODO: review
    poolReserve.totalSupplies = poolReserve.totalSupplies.plus(userBalanceChange);
    // poolReserve.availableLiquidity = poolReserve.totalDeposits
    //   .minus(poolReserve.totalPrincipalStableDebt)
    //   .minus(poolReserve.totalScaledVariableDebt);

    poolReserve.availableLiquidity = poolReserve.availableLiquidity.plus(userBalanceChange);
    poolReserve.totalLiquidity = poolReserve.totalLiquidity.plus(userBalanceChange);
    poolReserve.lifetimeLiquidity = poolReserve.lifetimeLiquidity.plus(userBalanceChange);

    if (userReserve.usageAsCollateralEnabledOnUser) {
      poolReserve.totalLiquidityAsCollateral = poolReserve.totalLiquidityAsCollateral.plus(
        userBalanceChange
      );
    }
    saveReserve(poolReserve, event);
    saveUserReserveAHistory(userReserve, event, index);
  } else {
    poolReserve.lifetimeReserveFactorAccrued = poolReserve.lifetimeReserveFactorAccrued.plus(
      userBalanceChange
    );
    saveReserve(poolReserve, event);
    // log.error('Minting to treasuey {} an amount of: {}', [from.toHexString(), value.toString()]);
  }
}

export function handleATokenBurn(event: ATokenBurn): void {
  tokenBurn(
    event,
    event.params.from,
    event.params.value,
    event.params.balanceIncrease,
    event.params.index
  );
}

export function handleATokenMint(event: ATokenMint): void {
  tokenMint(
    event,
    event.params.onBehalfOf,
    event.params.value,
    event.params.balanceIncrease,
    event.params.index
  );
}

export function handleBalanceTransfer(event: BalanceTransfer): void {
  let balanceTransferValue = event.params.value;
  const network = dataSource.network();
  const v301UpdateBlock = getUpdateBlock(network);
  if (event.block.number.toU32() > v301UpdateBlock) {
    balanceTransferValue = rayMul(balanceTransferValue, event.params.index);
  }

  tokenBurn(event, event.params.from, balanceTransferValue, BigInt.fromI32(0), event.params.index);
  tokenMint(event, event.params.to, balanceTransferValue, BigInt.fromI32(0), event.params.index);

  // TODO: is this really necessary(from v1)? if we transfer aToken we are not moving the collateral (underlying token)
  let aToken = getOrInitSubToken(event.address);
  let userFromReserve = getOrInitUserReserve(
    event.params.from,
    aToken.underlyingAssetAddress,
    event
  );
  let userToReserve = getOrInitUserReserve(event.params.to, aToken.underlyingAssetAddress, event);

  let reserve = getOrInitReserve(aToken.underlyingAssetAddress, event);
  if (
    userFromReserve.usageAsCollateralEnabledOnUser &&
    !userToReserve.usageAsCollateralEnabledOnUser
  ) {
    reserve.totalLiquidityAsCollateral = reserve.totalLiquidityAsCollateral.minus(
      event.params.value
    );
    saveReserve(reserve, event);
  } else if (
    !userFromReserve.usageAsCollateralEnabledOnUser &&
    userToReserve.usageAsCollateralEnabledOnUser
  ) {
    reserve.totalLiquidityAsCollateral = reserve.totalLiquidityAsCollateral.plus(
      event.params.value
    );
    saveReserve(reserve, event);
  }
}
