import { Address, log } from '@graphprotocol/graph-ts';
import {
  ProxyCreated,
} from '../../generated/PoolAddressesProvider/PoolAddressesProvider';
import {
  PoolConfigurator as PoolConfiguratorContract,
} from '../../generated/templates';
import { createMapContractToPool, getProtocol } from '../helpers/initializers';
import { Pool } from '../../generated/schema';

// Lightweight version: Handle Pool and PoolConfigurator creation
export function handleProxyCreated(event: ProxyCreated): void {
  let newProxyAddress = event.params.proxyAddress;
  let contractId = event.params.id.toString();
  let poolAddressesProviderAddress = event.address.toHexString();

  // Create Pool entity when POOL is created
  if (contractId == 'POOL') {
    let pool = Pool.load(poolAddressesProviderAddress);
    if (pool == null) {
      pool = new Pool(poolAddressesProviderAddress);
      let protocol = getProtocol();
      pool.protocol = protocol.id;
      pool.active = true;
      pool.paused = false;
      log.warning('Creating new pool entity: {}', [poolAddressesProviderAddress]);
    }

    // Store the Pool contract address
    pool.pool = newProxyAddress;
    pool.save();

    createMapContractToPool(newProxyAddress, pool.id);
  }

  // Create PoolConfigurator template when POOL_CONFIGURATOR is created
  if (contractId == 'POOL_CONFIGURATOR') {
    PoolConfiguratorContract.create(newProxyAddress);
    createMapContractToPool(newProxyAddress, poolAddressesProviderAddress);
  }
}
