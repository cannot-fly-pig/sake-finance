import { Address } from '@graphprotocol/graph-ts';
import {
  AssetSourceUpdated,
  BaseCurrencySet,
} from '../../generated/AaveOracle/AaveOracle';
import {
  getOrInitPriceOracle,
  getPriceOracleAsset,
} from '../helpers/initializers';

export function handleAssetSourceUpdated(event: AssetSourceUpdated): void {
  let priceOracle = getOrInitPriceOracle();
  priceOracle.fallbackPriceOracle = event.params.source;
  priceOracle.save();

  // Update price oracle asset
  let priceOracleAsset = getPriceOracleAsset(event.params.asset.toHexString());
  priceOracleAsset.priceSource = event.params.source;
  priceOracleAsset.fromChainlinkSourcesRegistry = true;
  priceOracleAsset.lastUpdateTimestamp = event.block.timestamp.toI32();
  priceOracleAsset.save();
}

export function handleBaseCurrencySet(event: BaseCurrencySet): void {
  let priceOracle = getOrInitPriceOracle();
  priceOracle.baseCurrency = event.params.baseCurrency;
  priceOracle.baseCurrencyUnit = event.params.baseCurrencyUnit;
  priceOracle.lastUpdateTimestamp = event.block.timestamp.toI32();
  priceOracle.save();
}
