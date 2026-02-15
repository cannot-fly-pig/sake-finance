import {
  Mint as VTokenMint,
  Burn as VTokenBurn,
  BorrowAllowanceDelegated as VBorrowAllowanceDelegated,
} from '../../generated/templates/VariableDebtToken/VariableDebtToken';
import {
  UserReserve,
  VariableTokenDelegatedAllowance,
} from '../../generated/schema';
import {
  getOrInitUserReserve,
  getOrInitSubToken,
  getOrInitUser,
  updateUserHealthFactor,
} from '../helpers/initializers';
import { Pool } from '../../generated/schema';
import { zeroBI } from '../utils/converters';
import { rayDiv, rayMul } from '../helpers/math';
import { Address, Bytes } from '@graphprotocol/graph-ts';

// Lightweight version: Only track borrowedReservesCount
export function handleVariableDebtBurn(event: VTokenBurn): void {
  let vToken = getOrInitSubToken(event.address);
  let from = event.params.from;
  let value = event.params.value;
  let balanceIncrease = event.params.balanceIncrease;
  const userBalanceChange = value.plus(balanceIncrease);
  let index = event.params.index;
  let userReserve = getOrInitUserReserve(from, vToken.underlyingAssetAddress, event);

  let calculatedAmount = rayDiv(userBalanceChange, index);
  userReserve.scaledVariableDebt = userReserve.scaledVariableDebt.minus(calculatedAmount);
  userReserve.currentVariableDebt = rayMul(userReserve.scaledVariableDebt, index);
  userReserve.currentTotalDebt = userReserve.currentStableDebt.plus(
    userReserve.currentVariableDebt
  );

  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();

  // Update borrowedReservesCount (KEY LOGIC)
  let user = getOrInitUser(from);
  if (
    userReserve.scaledVariableDebt.equals(zeroBI()) &&
    userReserve.principalStableDebt.equals(zeroBI())
  ) {
    user.borrowedReservesCount -= 1;
    user.save();
  }

  // Update health factor
  let pool = Pool.load(userReserve.pool);
  if (pool && pool.pool) {
    updateUserHealthFactor(from, Address.fromBytes(pool.pool as Bytes));
  }
}

export function handleVariableDebtMint(event: VTokenMint): void {
  let vToken = getOrInitSubToken(event.address);

  let from = event.params.onBehalfOf;
  let value = event.params.value;
  const balanceIncrease = event.params.balanceIncrease;
  const userBalanceChange = value.minus(balanceIncrease);
  let index = event.params.index;

  let userReserve = getOrInitUserReserve(from, vToken.underlyingAssetAddress, event);

  // Update borrowedReservesCount (KEY LOGIC)
  let user = getOrInitUser(from);
  if (
    userReserve.scaledVariableDebt.equals(zeroBI()) &&
    userReserve.principalStableDebt.equals(zeroBI())
  ) {
    user.borrowedReservesCount += 1;
    user.save();
  }

  let calculatedAmount = rayDiv(userBalanceChange, index);
  userReserve.scaledVariableDebt = userReserve.scaledVariableDebt.plus(calculatedAmount);
  userReserve.currentVariableDebt = rayMul(userReserve.scaledVariableDebt, index);

  userReserve.currentTotalDebt = userReserve.currentStableDebt.plus(
    userReserve.currentVariableDebt
  );

  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();

  // Update health factor
  let pool = Pool.load(userReserve.pool);
  if (pool && pool.pool) {
    updateUserHealthFactor(from, Address.fromBytes(pool.pool as Bytes));
  }
}

export function handleVariableTokenBorrowAllowanceDelegated(
  event: VBorrowAllowanceDelegated
): void {
  let fromUser = event.params.fromUser;
  let toUser = event.params.toUser;
  let asset = event.params.asset;
  let amount = event.params.amount;

  let userReserve = getOrInitUserReserve(fromUser, asset, event);

  let delegatedAllowanceId =
    'variable' + fromUser.toHexString() + toUser.toHexString() + asset.toHexString();
  let delegatedAllowance = VariableTokenDelegatedAllowance.load(delegatedAllowanceId);
  if (delegatedAllowance == null) {
    delegatedAllowance = new VariableTokenDelegatedAllowance(delegatedAllowanceId);
    delegatedAllowance.fromUser = fromUser.toHexString();
    delegatedAllowance.toUser = toUser.toHexString();
    delegatedAllowance.userReserve = userReserve.id;
  }
  delegatedAllowance.amountAllowed = amount;
  delegatedAllowance.save();
}
