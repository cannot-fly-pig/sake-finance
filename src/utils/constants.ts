import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';

// USD precision constant (as BigDecimal for division)
export const USD_PRECISION = BigDecimal.fromString('100000000'); // 10^8

// Other price constants
export const PRICE_PRECISION = BigInt.fromI32(8);

// Mock addresses for testing
export const MOCK_USD_ADDRESS = '0x10f7fc1f91ba351f9c629c5947ad69bd03c05b96';

// Zero values
export const ZERO_BI = BigInt.fromI32(0);
export const ZERO_BD = BigDecimal.fromString('0');

// Network-specific constants
export const SONEIUM_CHAIN_ID = 1868;
