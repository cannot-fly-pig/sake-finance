import {
  BalanceTransfer,
  Mint as ATokenMint,
  Burn as ATokenBurn,
} from '../../generated/templates/AToken/AToken';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import {
  getOrInitUserReserve,
  getOrInitSubToken,
} from '../helpers/initializers';
import { rayDiv, rayMul } from '../helpers/math';
import { zeroBI } from '../utils/converters';

// Lightweight version: Only track user balances for collateral calculation
function tokenBurn(
  event: ethereum.Event,
  from: Address,
  value: BigInt,
  balanceIncrease: BigInt,
  index: BigInt
): void {
  let aToken = getOrInitSubToken(event.address);
  let userReserve = getOrInitUserReserve(from, aToken.underlyingAssetAddress, event);

  const userBalanceChange = value.plus(balanceIncrease);
  let calculatedAmount = rayDiv(userBalanceChange, index);

  userReserve.scaledATokenBalance = userReserve.scaledATokenBalance.minus(calculatedAmount);
  userReserve.currentATokenBalance = rayMul(userReserve.scaledATokenBalance, index);
  userReserve.liquidityIndex = index;
  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();
}

function tokenMint(
  event: ethereum.Event,
  onBehalf: Address,
  value: BigInt,
  balanceIncrease: BigInt,
  index: BigInt
): void {
  let aToken = getOrInitSubToken(event.address);

  // Skip treasury mints (mainnet, polygon, etc.)
  const treasuryAddresses = [
    '0xB2289E329D2F85F1eD31Adbb30eA345278F21bcf',
    '0xe8599F3cc5D38a9aD6F3684cd5CEa72f10Dbc383',
    '0xBe85413851D195fC6341619cD68BfDc26a25b928',
    '0x5ba7fd868c40c16f7aDfAe6CF87121E13FC2F7a0',
    '0x8A020d92D6B119978582BE4d3EdFdC9F7b28BF31',
    '0x053D55f9B5AF8694c503EB288a1B7E552f590710',
    '0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c',
  ];

  let isTreasuryMint = false;
  for (let i = 0; i < treasuryAddresses.length; i++) {
    if (onBehalf.toHexString().toLowerCase() == treasuryAddresses[i].toLowerCase()) {
      isTreasuryMint = true;
      break;
    }
  }

  if (!isTreasuryMint) {
    const userBalanceChange = value.minus(balanceIncrease);
    let userReserve = getOrInitUserReserve(onBehalf, aToken.underlyingAssetAddress, event);
    let calculatedAmount = rayDiv(userBalanceChange, index);

    userReserve.scaledATokenBalance = userReserve.scaledATokenBalance.plus(calculatedAmount);
    userReserve.currentATokenBalance = rayMul(userReserve.scaledATokenBalance, index);
    userReserve.liquidityIndex = index;
    userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
    userReserve.save();
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

export function handleATokenTransfer(event: BalanceTransfer): void {
  // For transfers, just burn from sender and mint to receiver
  tokenBurn(event, event.params.from, event.params.value, zeroBI(), event.params.index);
  tokenMint(event, event.params.to, event.params.value, zeroBI(), event.params.index);
}
