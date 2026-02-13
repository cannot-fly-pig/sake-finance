# Sake Finance Subgraph

GraphQL subgraph for Sake Finance (Aave V3 fork) on Soneium network.

## About

This subgraph indexes lending and borrowing activities on Sake Finance, enabling efficient querying of:
- Reserve states (liquidity, interest rates, utilization)
- User positions (deposits, borrows, collateral)
- Transaction history (supply, withdraw, borrow, repay, liquidation)
- Price oracle data
- Rewards and incentives

## Network

- **Chain**: Soneium (Chain ID: 1868)
- **Pool**: `0x3C3987A310ee13F7B8cBBe21D97D4436ba5E4B5f`
- **PoolAddressesProvider**: `0x73a35ca19Da0357651296c40805c31585f19F741`

## Development

```bash
# Install dependencies
npm install

# Generate types
npm run codegen

# Build subgraph
npm run build

# Deploy to The Graph Studio
npm run deploy:studio
```

## Attribution

This project is derived from and uses code from the [Aave Protocol Subgraphs](https://github.com/aave/protocol-subgraphs) repository.

**Original work**: Copyright (c) 2020 Aave
**License**: GNU Affero General Public License v3.0 (AGPL-3.0)

See [LICENSE](./LICENSE) for full license text.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](./LICENSE) file for details.

As required by the AGPL-3.0 license:
- Any modifications must be released under the same license
- Source code must be made available to users
- Changes must be documented
