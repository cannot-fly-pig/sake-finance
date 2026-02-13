import { BigDecimal, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { RAY, HALF_RAY, WAD, HALF_WAD, ZERO_BD } from './constants';

export function rayToWad(ray: BigInt): BigInt {
  return ray.plus(HALF_RAY).div(BigInt.fromI32(10).pow(9));
}

export function wadToRay(wad: BigInt): BigInt {
  return wad.times(BigInt.fromI32(10).pow(9));
}

export function rayMul(a: BigInt, b: BigInt): BigInt {
  return HALF_RAY.plus(a.times(b)).div(RAY);
}

export function rayDiv(a: BigInt, b: BigInt): BigInt {
  let halfB = b.div(BigInt.fromI32(2));
  return halfB.plus(a.times(RAY)).div(b);
}

export function wadMul(a: BigInt, b: BigInt): BigInt {
  return HALF_WAD.plus(a.times(b)).div(WAD);
}

export function wadDiv(a: BigInt, b: BigInt): BigInt {
  let halfB = b.div(BigInt.fromI32(2));
  return halfB.plus(a.times(WAD)).div(b);
}

export function convertTokenAmountToDecimals(amount: BigInt, decimals: i32): BigDecimal {
  let bd = amount.toBigDecimal();
  let decimalsBD = BigInt.fromI32(10)
    .pow(decimals as u8)
    .toBigDecimal();
  return bd.div(decimalsBD);
}

export function zeroBI(): BigInt {
  return BigInt.fromI32(0);
}

export function zeroAddress(): Bytes {
  return Bytes.fromHexString('0x0000000000000000000000000000000000000000');
}

export function calculateUtilizationRate(
  totalBorrows: BigInt,
  totalLiquidity: BigInt
): BigDecimal {
  if (totalLiquidity.equals(zeroBI())) {
    return ZERO_BD;
  }

  let utilizationRate = totalBorrows.toBigDecimal().div(totalLiquidity.toBigDecimal());
  return utilizationRate;
}

export function calculateAvailableLiquidity(
  totalLiquidity: BigInt,
  totalBorrows: BigInt
): BigInt {
  if (totalLiquidity.lt(totalBorrows)) {
    return zeroBI();
  }
  return totalLiquidity.minus(totalBorrows);
}
