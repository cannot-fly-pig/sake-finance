# Sake Finance Subgraph - Example Queries

This document provides example GraphQL queries for the Sake Finance subgraph.

## Basic Queries

### 1. Get All Reserves

Query all lending reserves with their current state:

```graphql
{
  reserves(first: 10, orderBy: totalLiquidity, orderDirection: desc) {
    id
    symbol
    name
    decimals
    underlyingAsset

    # Liquidity metrics
    totalLiquidity
    availableLiquidity
    totalATokenSupply

    # Interest rates (in Ray units - divide by 10^27 for actual rate)
    liquidityRate
    variableBorrowRate
    stableBorrowRate

    # Utilization
    utilizationRate

    # Configuration
    isActive
    isFrozen
    isPaused
    borrowingEnabled
    stableBorrowRateEnabled

    # Collateral parameters
    baseLTVasCollateral
    reserveLiquidationThreshold
    reserveLiquidationBonus

    # Token addresses
    aToken
    vToken
    sToken
  }
}
```

### 2. Get Reserve Details by Symbol

Get detailed information for a specific reserve (e.g., USDC):

```graphql
{
  reserves(where: { symbol: "USDC" }) {
    id
    symbol
    name
    decimals

    # Current state
    totalLiquidity
    availableLiquidity
    totalCurrentVariableDebt
    totalPrincipalStableDebt

    # Rates
    liquidityRate
    variableBorrowRate
    stableBorrowRate
    averageStableRate

    # Indexes (used for interest accrual)
    liquidityIndex
    variableBorrowIndex

    # Lifetime stats
    lifetimeLiquidity
    lifetimeBorrows
    lifetimeRepayments
    lifetimeWithdrawals
    lifetimeLiquidated
    lifetimeFlashLoans

    # Configuration
    reserveFactor
    usageAsCollateralEnabled

    # Price
    price {
      priceInEth
      priceSource
    }
  }
}
```

## User Queries

### 3. Get User Positions

Get all positions for a specific user address:

```graphql
{
  user(id: "0x1234567890abcdef1234567890abcdef12345678") {
    id
    borrowedReservesCount

    # All user reserves
    reserves {
      id

      # Deposit balances
      currentATokenBalance
      scaledATokenBalance

      # Borrow balances
      currentVariableDebt
      scaledVariableDebt
      currentStableDebt
      principalStableDebt

      # Stable rate info
      stableBorrowRate

      # Collateral status
      usageAsCollateralEnabledOnUser

      # Reserve info
      reserve {
        symbol
        name
        decimals
        liquidityRate
        variableBorrowRate

        price {
          priceInEth
        }
      }
    }

    # Rewards
    unclaimedRewards
    lifetimeRewards
  }
}
```

### 4. Get Users with Active Borrows

Find users who have active borrows:

```graphql
{
  users(
    where: { borrowedReservesCount_gt: 0 }
    first: 20
    orderBy: borrowedReservesCount
    orderDirection: desc
  ) {
    id
    borrowedReservesCount

    reserves(where: { currentTotalDebt_gt: "0" }) {
      currentTotalDebt
      currentVariableDebt
      currentStableDebt

      reserve {
        symbol
        variableBorrowRate
      }
    }
  }
}
```

## Transaction History Queries

### 5. Recent Supply Transactions

Get recent supply (deposit) transactions:

```graphql
{
  supplies(
    first: 20
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    txHash
    timestamp

    user
    caller
    amount

    reserve {
      symbol
      name
    }

    assetPriceUSD

    referrer {
      id
    }
  }
}
```

### 6. Recent Borrow Transactions

Get recent borrow transactions:

```graphql
{
  borrows(
    first: 20
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    txHash
    timestamp

    user
    caller
    amount
    borrowRateMode  # 1 = stable, 2 = variable
    borrowRate

    reserve {
      symbol
      name
    }

    assetPriceUSD

    stableTokenDebt
    variableTokenDebt
  }
}
```

### 7. Liquidation Events

Get liquidation events:

```graphql
{
  liquidationCalls(
    first: 20
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    txHash
    timestamp

    user
    liquidator

    collateralReserve {
      symbol
      name
    }
    collateralAmount

    principalReserve {
      symbol
      name
    }
    principalAmount

    collateralAssetPriceUSD
    borrowAssetPriceUSD
  }
}
```

### 8. Flash Loan History

Get flash loan transactions:

```graphql
{
  flashLoans(
    first: 20
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    txHash
    timestamp

    initiator
    target
    amount
    totalFee
    lpFee
    protocolFee

    reserve {
      symbol
      name
    }

    assetPriceUSD
  }
}
```

## Advanced Queries

### 9. Reserve Utilization Analysis

Get reserves with their utilization rates:

```graphql
{
  reserves(
    where: { isActive: true }
    orderBy: utilizationRate
    orderDirection: desc
  ) {
    symbol
    utilizationRate

    totalLiquidity
    availableLiquidity
    totalCurrentVariableDebt
    totalPrincipalStableDebt

    liquidityRate
    variableBorrowRate

    # Calculate total debt
    totalDeposits: totalLiquidity
    totalBorrows: totalCurrentVariableDebt
  }
}
```

### 10. User Health Factor Calculation

Get data needed to calculate user health factor:

```graphql
{
  user(id: "0x1234567890abcdef1234567890abcdef12345678") {
    reserves {
      # Collateral value
      currentATokenBalance
      usageAsCollateralEnabledOnUser

      reserve {
        symbol
        decimals
        baseLTVasCollateral
        reserveLiquidationThreshold

        price {
          priceInEth
        }
      }

      # Debt value
      currentTotalDebt
    }
  }
}
```

### 11. Reserve Configuration History

Track changes to reserve configuration:

```graphql
{
  reserveConfigurationHistoryItems(
    where: { reserve: "0x..." }
    orderBy: timestamp
    orderDirection: desc
    first: 10
  ) {
    id
    timestamp

    reserve {
      symbol
    }

    baseLTVasCollateral
    reserveLiquidationThreshold
    reserveLiquidationBonus

    borrowingEnabled
    stableBorrowRateEnabled
    isActive
    isFrozen
  }
}
```

### 12. E-Mode Categories

Get information about efficiency mode (E-Mode) categories:

```graphql
{
  eModeCategories {
    id
    ltv
    liquidationThreshold
    liquidationBonus
    priceSource
    label
  }
}
```

## Price Oracle Queries

### 13. Asset Prices

Get current prices for all assets:

```graphql
{
  priceOracleAssets(first: 20) {
    id
    priceInEth
    priceSource
    lastUpdateTimestamp
    isFallbackRequired
    type
    platform
    fromChainlinkSourcesRegistry
  }
}
```

### 14. Price History

Get price history for a specific asset:

```graphql
{
  priceHistoryItems(
    where: { asset: "0x..." }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    id
    price
    timestamp

    asset {
      id
      oracle {
        usdPriceEth
      }
    }
  }
}
```

## Rewards Queries

### 15. User Rewards

Get rewards information for a user:

```graphql
{
  user(id: "0x1234567890abcdef1234567890abcdef12345678") {
    unclaimedRewards
    lifetimeRewards
    rewardsLastUpdated
  }
}
```

### 16. Recent Rewards Claims

Get recent reward claim events:

```graphql
{
  claimRewardsCall: claimRewardsCalls(
    first: 20
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    txHash
    timestamp

    user
    amount
    to
    caller

    rewardsController
  }
}
```

## Aggregation Queries

### 17. Protocol Overview

Get overall protocol statistics:

```graphql
{
  protocol(id: "1") {
    pools {
      id
      active
      paused

      bridgeProtocolFee
      flashloanPremiumTotal
      flashloanPremiumToProtocol

      reserves(where: { isActive: true }) {
        symbol
        totalLiquidity
        totalCurrentVariableDebt
        totalPrincipalStableDebt
      }
    }
  }
}
```

### 18. Pool Statistics

Get detailed statistics for the main pool:

```graphql
{
  pool(id: "0x...") {
    id
    active
    paused
    lastUpdateTimestamp

    # Count active reserves
    reserves(where: { isActive: true }) {
      symbol
      totalLiquidity
      availableLiquidity
    }

    # Recent activity counts
    supplyHistory(first: 1) {
      timestamp
    }
    borrowHistory(first: 1) {
      timestamp
    }
    liquidationCallHistory(first: 1) {
      timestamp
    }
  }
}
```

## Filtering and Pagination

### 19. Paginated Results with Filtering

Example of pagination and filtering:

```graphql
{
  # First page
  reserves(
    first: 10
    skip: 0
    where: {
      isActive: true
      borrowingEnabled: true
      totalLiquidity_gt: "0"
    }
    orderBy: totalLiquidity
    orderDirection: desc
  ) {
    id
    symbol
    totalLiquidity
  }

  # Second page (skip first 10)
  reservesPage2: reserves(
    first: 10
    skip: 10
    where: {
      isActive: true
      borrowingEnabled: true
      totalLiquidity_gt: "0"
    }
    orderBy: totalLiquidity
    orderDirection: desc
  ) {
    id
    symbol
    totalLiquidity
  }
}
```

## Rate Conversion

When querying rates, remember they are stored in Ray units (10^27). To convert:

```javascript
// Ray to decimal (e.g., 0.05 for 5%)
const rateDecimal = BigInt(liquidityRate) / BigInt(10**27);

// Ray to percentage (e.g., 5.00%)
const ratePercentage = Number(BigInt(liquidityRate) * BigInt(10000) / BigInt(10**27)) / 100;

// Annual Percentage Yield (APY) from rate
const secondsPerYear = 31536000;
const apy = (1 + rateDecimal / secondsPerYear) ** secondsPerYear - 1;
```

## Time-based Queries

### 20. Activity in Last 24 Hours

Get recent activity (requires timestamp in Unix seconds):

```graphql
query RecentActivity($timestamp: Int!) {
  supplies(
    where: { timestamp_gte: $timestamp }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    amount
    timestamp
    reserve { symbol }
  }

  borrows(
    where: { timestamp_gte: $timestamp }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    amount
    timestamp
    reserve { symbol }
  }
}

# Variables (24 hours ago)
# { "timestamp": 1708041600 }
```

## Notes

- All addresses should be lowercase
- BigInt values are returned as strings
- Rates are in Ray units (10^27)
- Timestamps are Unix timestamps (seconds)
- Use `first`, `skip`, `orderBy`, and `orderDirection` for pagination
- Maximum `first` value is typically 1000
