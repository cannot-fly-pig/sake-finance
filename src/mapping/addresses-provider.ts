import { Address, log } from '@graphprotocol/graph-ts';
import {
  ProxyCreated,
} from '../../generated/PoolAddressesProvider/PoolAddressesProvider';
import {
  PoolConfigurator as PoolConfiguratorContract,
} from '../../generated/templates';
import { createMapContractToPool, getProtocol } from '../helpers/initializers';
import { Pool } from '../../generated/schema';

// Lightweight version: Only handle PoolConfigurator creation
export function handleProxyCreated(event: ProxyCreated): void {
  let newProxyAddress = event.params.proxyAddress;
  let contractId = event.params.id.toString();

  if (contractId == 'POOL_CONFIGURATOR') {
    PoolConfiguratorContract.create(newProxyAddress);

    // Create or update Pool entity
    let poolAddress = event.address.toHexString();
    let pool = Pool.load(poolAddress);
    if (pool == null) {
      pool = new Pool(poolAddress);
      let protocol = getProtocol();
      pool.protocol = protocol.id;
      pool.active = true;
      pool.paused = false;
      log.warning('Creating new pool entity: {}', [poolAddress]);
    }

    pool.pool = newProxyAddress;
    pool.save();

    createMapContractToPool(newProxyAddress, pool.id);
  }
}
