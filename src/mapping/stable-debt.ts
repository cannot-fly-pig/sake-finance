import {
  Mint as STokenMint,
  Burn as STokenBurn,
  BorrowAllowanceDelegated as SBorrowAllowanceDelegated,
} from '../../generated/templates/StableDebtToken/StableDebtToken';
import {
  UserReserve,
  StableTokenDelegatedAllowance,
} from '../../generated/schema';
import {
  getOrInitUserReserve,
  getOrInitSubToken,
  getOrInitUser,
} from '../helpers/initializers';
import { zeroBI } from '../utils/converters';
import { Address } from '@graphprotocol/graph-ts';

// Lightweight version: Only track borrowedReservesCount
export function handleStableDebtMint(event: STokenMint): void {
  let balanceChangeIncludingInterest = event.params.amount;
  let sToken = getOrInitSubToken(event.address);
  let from = event.params.user;
  if (from.toHexString() != event.params.onBehalfOf.toHexString()) {
    from = event.params.onBehalfOf;
  }
  let userReserve = getOrInitUserReserve(from, sToken.underlyingAssetAddress, event);

  // Update borrowedReservesCount (KEY LOGIC)
  let user = getOrInitUser(from);
  if (
    userReserve.scaledVariableDebt.equals(zeroBI()) &&
    userReserve.principalStableDebt.equals(zeroBI())
  ) {
    user.borrowedReservesCount += 1;
    user.save();
  }

  userReserve.principalStableDebt = userReserve.principalStableDebt.plus(
    balanceChangeIncludingInterest
  );
  userReserve.currentStableDebt = userReserve.principalStableDebt;
  userReserve.currentTotalDebt = userReserve.currentStableDebt.plus(
    userReserve.currentVariableDebt
  );

  userReserve.stableBorrowRate = event.params.newRate;
  userReserve.stableBorrowLastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();
}

export function handleStableDebtBurn(event: STokenBurn): void {
  let sTokenAddress = event.address;
  let sToken = getOrInitSubToken(sTokenAddress);
  let userReserve = getOrInitUserReserve(event.params.from, sToken.underlyingAssetAddress, event);
  let amount = event.params.amount;

  userReserve.principalStableDebt = userReserve.principalStableDebt.minus(amount);
  userReserve.currentStableDebt = userReserve.principalStableDebt;
  userReserve.currentTotalDebt = userReserve.currentStableDebt.plus(
    userReserve.currentVariableDebt
  );

  userReserve.stableBorrowLastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();

  // Update borrowedReservesCount (KEY LOGIC)
  let user = getOrInitUser(event.params.from);
  if (
    userReserve.scaledVariableDebt.equals(zeroBI()) &&
    userReserve.principalStableDebt.equals(zeroBI())
  ) {
    user.borrowedReservesCount -= 1;
    user.save();
  }
}

export function handleStableTokenBorrowAllowanceDelegated(event: SBorrowAllowanceDelegated): void {
  let fromUser = event.params.fromUser;
  let toUser = event.params.toUser;
  let asset = event.params.asset;
  let amount = event.params.amount;

  let userReserve = getOrInitUserReserve(fromUser, asset, event);

  let delegatedAllowanceId =
    'stable' + fromUser.toHexString() + toUser.toHexString() + asset.toHexString();
  let delegatedAllowance = StableTokenDelegatedAllowance.load(delegatedAllowanceId);
  if (delegatedAllowance == null) {
    delegatedAllowance = new StableTokenDelegatedAllowance(delegatedAllowanceId);
    delegatedAllowance.fromUser = fromUser.toHexString();
    delegatedAllowance.toUser = toUser.toHexString();
    delegatedAllowance.userReserve = userReserve.id;
  }
  delegatedAllowance.amountAllowed = amount;
  delegatedAllowance.save();
}
