#!/bin/bash

# Script to help find deployment blocks for Sake Finance contracts on Soneium
# Run this to get the actual deployment blocks, then update subgraph.yaml

echo "=== Sake Finance Contract Deployment Blocks ==="
echo ""
echo "Please check the following contracts on Soneium Block Explorer:"
echo "https://soneium.blockscout.com/"
echo ""

contracts=(
  "PoolAddressesProvider:0x73a35ca19Da0357651296c40805c31585f19F741"
  "AaveOracle:0x18530Af497F558e23134E223244F353ea776aF2A"
  "RewardsController:0x76516A0Bee8c0908C85Fe7Ba085DF68b8732979e"
)

echo "Contracts to check:"
echo ""

for contract in "${contracts[@]}"; do
  IFS=':' read -r name address <<< "$contract"
  echo "- $name"
  echo "  Address: $address"
  echo "  URL: https://soneium.blockscout.com/address/$address"
  echo "  → Find the 'Contract Creation' transaction and note the block number"
  echo ""
done

echo "After finding the block numbers, update subgraph.yaml:"
echo ""
echo "dataSources:"
echo "  - name: AaveOracle"
echo "    source:"
echo "      startBlock: <BLOCK_NUMBER>  # Replace with actual block"
echo ""
echo "  - name: PoolAddressesProvider"
echo "    source:"
echo "      startBlock: <BLOCK_NUMBER>  # Replace with actual block"
echo ""
echo "  - name: RewardsController"
echo "    source:"
echo "      startBlock: <BLOCK_NUMBER>  # Replace with actual block"
echo ""
echo "Tip: Use the earliest block number for all data sources to simplify"
