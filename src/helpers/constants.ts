import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const SONEIUM_CHAIN_ID = 1868;

// BigInt and BigDecimal constants
export const ZERO_BD = BigDecimal.fromString('0');
export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);

// Ray and WAD math constants (10^27 and 10^18)
export const RAY = BigInt.fromI32(10).pow(27);
export const WAD = BigInt.fromI32(10).pow(18);
export const HALF_RAY = RAY.div(BigInt.fromI32(2));
export const HALF_WAD = WAD.div(BigInt.fromI32(2));

// Percentage constants
export const PERCENTAGE_FACTOR = BigInt.fromI32(10000);

// Seconds per year for interest rate calculations
export const SECONDS_PER_YEAR = BigInt.fromI32(31536000);

// Protocol constants
export const PROTOCOL_ID = '1';
