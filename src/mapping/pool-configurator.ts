/* eslint-disable @typescript-eslint/no-inferrable-types */
import { IERC20Detailed } from '../../generated/templates/PoolConfigurator/IERC20Detailed';
import { IERC20DetailedBytes } from '../../generated/templates/PoolConfigurator/IERC20DetailedBytes';
import {
  AToken as ATokenContract,
  StableDebtToken as STokenContract,
  VariableDebtToken as VTokenContract,
} from '../../generated/templates';
import {
  createMapContractToPool,
  getOrInitSubToken,
  getOrInitReserve,
} from '../helpers/initializers';
import {
  ReserveInitialized,
} from '../../generated/templates/PoolConfigurator/PoolConfigurator';
import { zeroAddress } from '../utils/converters';

// Lightweight version: Only handle reserve initialization
export function handleReserveInitialized(event: ReserveInitialized): void {
  let underlyingAssetAddress = event.params.asset;
  let reserve = getOrInitReserve(underlyingAssetAddress, event);

  let ERC20ReserveContract = IERC20Detailed.bind(underlyingAssetAddress);
  let ERC20DetailedBytesContract = IERC20DetailedBytes.bind(underlyingAssetAddress);

  let nameStringCall = ERC20ReserveContract.try_name();
  if (nameStringCall.reverted) {
    let bytesNameCall = ERC20DetailedBytesContract.try_name();
    if (bytesNameCall.reverted) {
      reserve.name = '';
    } else {
      reserve.name = bytesNameCall.value.toString();
    }
  } else {
    reserve.name = nameStringCall.value;
  }

  let symbolCall = ERC20ReserveContract.try_symbol();
  if (symbolCall.reverted) {
    let bytesSymbolCall = ERC20DetailedBytesContract.try_symbol();
    if (bytesSymbolCall.reverted) {
      reserve.symbol = '';
    } else {
      reserve.symbol = bytesSymbolCall.value.toString();
    }
  } else {
    reserve.symbol = symbolCall.value;
  }

  reserve.decimals = ERC20ReserveContract.decimals();

  // Create AToken template and entity
  ATokenContract.create(event.params.aToken);
  createMapContractToPool(event.params.aToken, reserve.pool);
  let aToken = getOrInitSubToken(event.params.aToken);
  aToken.underlyingAssetAddress = reserve.underlyingAsset;
  aToken.underlyingAssetDecimals = reserve.decimals;
  aToken.pool = reserve.pool;
  aToken.save();

  // Create VariableDebtToken template and entity
  VTokenContract.create(event.params.variableDebtToken);
  createMapContractToPool(event.params.variableDebtToken, reserve.pool);
  let vToken = getOrInitSubToken(event.params.variableDebtToken);
  vToken.underlyingAssetAddress = reserve.underlyingAsset;
  vToken.underlyingAssetDecimals = reserve.decimals;
  vToken.pool = reserve.pool;
  vToken.save();

  // Create StableDebtToken template and entity (if exists)
  if (event.params.stableDebtToken.toHexString() != zeroAddress().toHexString()) {
    STokenContract.create(event.params.stableDebtToken);
    createMapContractToPool(event.params.stableDebtToken, reserve.pool);
    let sToken = getOrInitSubToken(event.params.stableDebtToken);
    sToken.underlyingAssetAddress = reserve.underlyingAsset;
    sToken.underlyingAssetDecimals = reserve.decimals;
    sToken.pool = reserve.pool;
    sToken.save();
    reserve.sToken = sToken.id;
  }

  // Set reserve token references
  reserve.aToken = aToken.id;
  reserve.vToken = vToken.id;
  reserve.isActive = true;
  reserve.isFrozen = false;
  reserve.save();
}
