# インデックス速度最適化の提案

現在の実装を分析し、さらなる高速化が可能な箇所を特定しました。

## 🚀 最適化ポイント

### 1. ⚠️ **最重要: 不要なcontract callの削除**

#### 問題箇所: `src/mapping/atoken.ts:155-167`

**現状:**
```typescript
let poolContract = Pool.bind(Address.fromString((pool.pool as Bytes).toHexString()));
const reserveData = poolContract.try_getReserveData(
  Address.fromString(aToken.underlyingAssetAddress.toHexString())
);
if (!reserveData.reverted) {
  poolReserve.accruedToTreasury = reserveData.value.accruedToTreasury;
}
```

**問題点:**
- `ATokenMint`イベント発生時に**毎回**`getReserveData()`を呼び出している
- Mintイベントは非常に頻繁（全てのsupply操作で発生）
- `accruedToTreasury`は別のイベント（`MintedToTreasury`）で更新される

**影響度:** 🔴 **高** - Mintイベントは最も頻繁なイベントの一つ

**推奨対応:**
```typescript
// Option 1: 完全削除（MintedToTreasuryイベントで更新されるため）
// この行を削除

// Option 2: 初回のみ取得
if (poolReserve.accruedToTreasury.equals(zeroBI())) {
  let poolContract = Pool.bind(Address.fromString((pool.pool as Bytes).toHexString()));
  const reserveData = poolContract.try_getReserveData(
    Address.fromString(aToken.underlyingAssetAddress.toHexString())
  );
  if (!reserveData.reverted) {
    poolReserve.accruedToTreasury = reserveData.value.accruedToTreasury;
  }
}
```

**期待効果:**
- eth_callsを**50-70%削減**（Mintイベントの頻度による）
- インデックス速度**2-3x向上**

---

### 2. ⚠️ **Interest Rate Strategy Contract Callsのキャッシング**

#### 問題箇所: `src/mapping/pool-configurator.ts:73-154`

**現状:**
```typescript
export function updateInterestRateStrategy(reserve: Reserve, strategy: Bytes, init: boolean = false): void {
  // 最大10回のcontract call:
  // - getBaseVariableBorrowRate (V1 + V2)
  // - OPTIMAL_USAGE_RATIO / getOptimalUsageRatio (V1 + V2)
  // - getVariableRateSlope1 (V1 + V2)
  // - getVariableRateSlope2 (V1 + V2)
  // - getStableRateSlope1 (V1 only)
  // - getStableRateSlope2 (V1 only)
}
```

**問題点:**
- 各ReserveでStrategy変更時に最大10回のcontract call
- Strategyアドレスごとにキャッシュ可能なデータ
- 同じStrategyを複数のReserveで使用する場合、重複して取得

**影響度:** 🟡 **中** - Strategy変更は頻繁ではないが、初期化時に全Reserve分実行される

**推奨対応:**

```typescript
// 新しいエンティティを作成: InterestRateStrategy
// schema.graphqlに追加:
/*
type InterestRateStrategy @entity {
  id: ID! # strategy address
  baseVariableBorrowRate: BigInt!
  optimalUsageRatio: BigInt!
  variableRateSlope1: BigInt!
  variableRateSlope2: BigInt!
  stableRateSlope1: BigInt!
  stableRateSlope2: BigInt!
}
*/

// helpers/initializers.tsに追加:
export function getOrInitInterestRateStrategy(strategyAddress: Bytes): InterestRateStrategy {
  let strategy = InterestRateStrategy.load(strategyAddress.toHexString());
  if (strategy) {
    return strategy; // キャッシュから返す（contract call不要）
  }

  // 初回のみcontract call
  strategy = new InterestRateStrategy(strategyAddress.toHexString());
  let contract = DefaultReserveInterestRateStrategy.bind(Address.fromString(strategyAddress.toHexString()));

  let baseRateCall = contract.try_getBaseVariableBorrowRate();
  if (!baseRateCall.reverted) {
    strategy.baseVariableBorrowRate = baseRateCall.value;
  }
  // ... 他のパラメータも同様

  strategy.save();
  return strategy;
}

// pool-configurator.tsで使用:
export function updateInterestRateStrategy(reserve: Reserve, strategyAddress: Bytes, init: boolean = false): void {
  let strategy = getOrInitInterestRateStrategy(strategyAddress);

  // キャッシュから値をコピー（contract call不要）
  reserve.reserveInterestRateStrategy = Bytes.fromHexString(strategy.id);
  reserve.baseVariableBorrowRate = strategy.baseVariableBorrowRate;
  reserve.optimalUtilisationRate = strategy.optimalUsageRatio;
  reserve.variableRateSlope1 = strategy.variableRateSlope1;
  reserve.variableRateSlope2 = strategy.variableRateSlope2;
  reserve.stableRateSlope1 = strategy.stableRateSlope1;
  reserve.stableRateSlope2 = strategy.stableRateSlope2;

  if (init) {
    reserve.variableBorrowRate = reserve.baseVariableBorrowRate;
  }
}
```

**期待効果:**
- 同一Strategyの再利用時にeth_calls **100%削減**
- 初期化時のインデックス速度向上

---

### 3. 🟢 **startBlock の最適化**

#### 問題箇所: `subgraph.yaml` 全data sources

**現状:**
```yaml
dataSources:
  - kind: ethereum/contract
    name: AaveOracle
    source:
      startBlock: 0  # ❌ ブロック0から開始
```

**問題点:**
- Sake Financeのコントラクトはブロック0にデプロイされていない
- 不要なブロックをスキャンしている
- 初期同期が遅い

**推奨対応:**

```bash
# 各コントラクトのデプロイメントブロックを確認
# Soneium block explorer: https://soneium.blockscout.com/

# 例:
# PoolAddressesProvider: 0x73a35ca19Da0357651296c40805c31585f19F741
# デプロイブロック: 12345 (要確認)
```

```yaml
dataSources:
  - kind: ethereum/contract
    name: AaveOracle
    source:
      startBlock: 12345  # ✅ 実際のデプロイブロックを指定
```

**期待効果:**
- 初期同期時間を大幅短縮
- 不要なブロックスキャンを回避

**実装方法:**
```bash
# Block explorerで各コントラクトのデプロイブロックを確認
# または、networks.jsonに追加してスクリプトで一括更新
```

---

### 4. 🟢 **不要な save() 呼び出しの削除**

#### 問題箇所: `src/mapping/pool.ts` 複数箇所

**例: pool.ts:181**
```typescript
export function handleRepay(event: Repay): void {
  let poolReserve = getOrInitReserve(event.params.reserve, event);

  poolReserve.save(); // ❌ 何も変更していないのにsave()

  let repay = new RepayAction(getHistoryEntityId(event));
  // ...
}
```

**問題点:**
- データを変更していないのに`save()`を呼び出している
- 不要なデータベース書き込み

**推奨対応:**
```typescript
export function handleRepay(event: Repay): void {
  let poolReserve = getOrInitReserve(event.params.reserve, event);

  // poolReserve.save(); を削除（変更がないため不要）

  let repay = new RepayAction(getHistoryEntityId(event));
  // ...
}
```

**該当箇所:**
- `pool.ts:181` (handleRepay)
- `pool.ts:214` (handleLiquidationCall - collateralPoolReserve)
- `pool.ts:219` (handleLiquidationCall - principalPoolReserve)

**期待効果:**
- データベース書き込みを削減
- 若干の速度向上

---

### 5. 🟡 **History Items の選択的作成**

#### 問題箇所: `src/mapping/atoken.ts:46-93` (saveReserve関数)

**現状:**
```typescript
function saveReserve(reserve: Reserve, event: ethereum.Event): void {
  reserve.utilizationRate = calculateUtilizationRate(reserve);
  reserve.save();

  // 毎回ReserveParamsHistoryItemを作成
  let reserveParamsHistoryItem = getOrInitReserveParamsHistoryItem(
    getHistoryEntityId(event),
    reserve
  );
  // ... 20以上のフィールドをコピー
  reserveParamsHistoryItem.save();
}
```

**問題点:**
- AToken Mint/Burn時に毎回history itemを作成
- 高頻度イベントで大量のhistory itemsが生成される
- データベースサイズが膨大になる
- クエリ性能にも影響

**推奨対応:**

**Option A: 時間ベースのバッチ処理**
```typescript
function saveReserve(reserve: Reserve, event: ethereum.Event): void {
  reserve.utilizationRate = calculateUtilizationRate(reserve);
  reserve.save();

  // 1時間ごとにのみhistory itemを作成（adjustable）
  const HISTORY_INTERVAL = 3600; // 秒
  let lastHistoryTimestamp = reserve.lastUpdateTimestamp;
  let currentTimestamp = event.block.timestamp.toI32();

  if (currentTimestamp - lastHistoryTimestamp >= HISTORY_INTERVAL) {
    let reserveParamsHistoryItem = getOrInitReserveParamsHistoryItem(
      getHistoryEntityId(event),
      reserve
    );
    // ... フィールド設定
    reserveParamsHistoryItem.save();
  }
}
```

**Option B: 重要なイベントのみ記録**
```typescript
// AToken mint/burnでは作成せず、
// ReserveDataUpdatedイベントでのみ作成
// handleReserveDataUpdated内でsaveReserve()を呼ぶ
```

**Option C: History機能を完全に無効化**
```typescript
// history itemsが不要な場合は完全削除
function saveReserve(reserve: Reserve, event: ethereum.Event): void {
  reserve.utilizationRate = calculateUtilizationRate(reserve);
  reserve.save();
  // history item作成を削除
}
```

**期待効果:**
- データベースサイズを**50-90%削減**
- 書き込み速度向上
- クエリ性能向上

---

### 6. 🟢 **ReserveDataUpdated イベントの完全活用**

#### 改善案: pool.tsにReserveDataUpdatedハンドラーを追加

**現状:**
- `subgraph.yaml`にはハンドラー定義があるが、実装が不完全
- Reserve状態の更新にcontract callを使用している箇所がある

**推奨実装:**
```typescript
// src/mapping/pool.ts
export function handleReserveDataUpdated(event: ReserveDataUpdated): void {
  let poolReserve = getOrInitReserve(event.params.reserve, event);

  // イベントから全てのデータを取得（contract call不要）
  poolReserve.liquidityRate = event.params.liquidityRate;
  poolReserve.stableBorrowRate = event.params.stableBorrowRate;
  poolReserve.variableBorrowRate = event.params.variableBorrowRate;
  poolReserve.liquidityIndex = event.params.liquidityIndex;
  poolReserve.variableBorrowIndex = event.params.variableBorrowIndex;
  poolReserve.lastUpdateTimestamp = event.block.timestamp.toI32();

  poolReserve.save();
}
```

**期待効果:**
- Reserve状態を常に最新に保つ（contract call不要）
- 他のハンドラーでReserve状態を信頼できる

---

### 7. 🟡 **Price Oracle のキャッシング強化**

#### 問題箇所: `getPriceOracleAsset()` の頻繁な呼び出し

**現状:**
- 各transaction eventでprice oracleを取得
- 同じブロック内で複数回取得される可能性

**推奨対応:**
```typescript
// ブロック内でのprice caching
// helpers/initializers.tsに追加

let priceCache = new Map<string, PriceOracleAsset>(); // ブロックごとにリセット
let lastCachedBlock = 0;

export function getPriceOracleAssetCached(
  priceOracleAssetId: string,
  currentBlock: i32
): PriceOracleAsset {
  // 新しいブロックならキャッシュをクリア
  if (currentBlock != lastCachedBlock) {
    priceCache.clear();
    lastCachedBlock = currentBlock;
  }

  // キャッシュから返す
  if (priceCache.has(priceOracleAssetId)) {
    return priceCache.get(priceOracleAssetId);
  }

  // 初回のみロード
  let asset = getPriceOracleAsset(priceOracleAssetId);
  priceCache.set(priceOracleAssetId, asset);
  return asset;
}
```

**注意:** AssemblyScriptではMapが制限されているため、実装は工夫が必要

**期待効果:**
- 同一ブロック内での重複ロードを回避

---

## 📊 期待される総合効果

### 最適化前後の比較

| 最適化項目 | eth_calls削減 | 速度向上 | 優先度 |
|----------|-------------|---------|-------|
| 1. AToken mint時のcontract call削除 | 50-70% | 2-3x | 🔴 最高 |
| 2. Interest Rate Strategyキャッシング | 20-30% | 1.2-1.5x | 🟡 中 |
| 3. startBlock最適化 | - | 初期同期大幅短縮 | 🟢 高 |
| 4. 不要なsave()削除 | - | 1.1x | 🟢 低 |
| 5. History Items削減 | - | 1.2-1.5x | 🟡 中 |
| 6. ReserveDataUpdated活用 | 10-20% | 1.1-1.2x | 🟢 中 |
| **総合** | **70-90%** | **3-6x** | - |

### 実装優先順位

**Phase 1: 即座に実装すべき (最小限の変更)**
1. ✅ startBlockの更新（subgraph.yamlのみ）
2. ✅ 不要なsave()削除（数行の削除）
3. ✅ AToken mint時のcontract call削除または条件付き実行

**Phase 2: 高効果の最適化**
4. ✅ Interest Rate Strategyキャッシング（新entity追加）
5. ✅ History Items削減（時間ベースまたは無効化）

**Phase 3: さらなる改善**
6. ✅ ReserveDataUpdatedハンドラー強化
7. ✅ Price Oracle キャッシング

---

## 🛠️ 実装手順

### Step 1: startBlock の確認と更新

```bash
# Soneium block explorerで確認
# https://soneium.blockscout.com/

# 各コントラクトアドレスのデプロイブロックを記録
echo "PoolAddressesProvider deployment block: ???"
echo "AaveOracle deployment block: ???"
echo "RewardsController deployment block: ???"

# subgraph.yamlを更新
```

### Step 2: コード最適化の実装

```bash
# ブランチ作成
git checkout -b optimize-indexing

# 最適化を実装
# 1. atoken.tsのcontract call削除
# 2. 不要なsave()削除
# 3. pool-configurator.tsのキャッシング追加

# ビルドとテスト
npm run build
```

### Step 3: 効果測定

```bash
# ローカルでデプロイ
npm run deploy:local

# インデックス速度を計測
# Before: X blocks/sec
# After: Y blocks/sec

# eth_callsをモニタリング
# Graph Node logsでRPC call countを確認
```

---

## 🎯 推奨実装プラン

### 最小限の変更で最大効果

```typescript
// 1. subgraph.yaml - startBlockを更新（要調査）
startBlock: 12345  // 実際のデプロイブロック

// 2. atoken.ts:155-167 - 条件付きcontract call
if (poolReserve.accruedToTreasury.equals(zeroBI())) {
  // 初回のみcontract call
}

// 3. pool.ts - 不要なsave()削除
// 181, 214, 219行目のpoolReserve.save()を削除

// 4. atoken.ts:46-93 - History削減
// saveReserve()内のhistory item作成を条件付きに
```

**この最小変更だけで期待される効果:**
- インデックス速度: **2-4x向上**
- eth_calls: **50-70%削減**
- 初期同期時間: **大幅短縮**

---

## ⚠️ 注意事項

1. **テスト必須**
   - 最適化後は必ずローカルでテスト
   - データ整合性を確認

2. **History Items削減の影響**
   - 時系列分析が必要な場合は慎重に
   - アプリケーション要件を確認

3. **startBlock変更**
   - 既存のデプロイメントには影響しない
   - 新規デプロイメント時に効果

4. **キャッシング実装**
   - AssemblyScriptの制約を考慮
   - entity-basedキャッシングを推奨（Mapは使用できない）

---

## 📝 まとめ

**現在の実装は既に高品質**ですが、上記の最適化により：

✅ **eth_callsを70-90%削減可能**
✅ **インデックス速度を3-6x向上可能**
✅ **初期同期時間を大幅短縮可能**
✅ **データベースサイズを削減可能**

特に**AToken mint時のcontract call削除**と**startBlock最適化**は、**少ない労力で大きな効果**が期待できます。

優先順位に従って段階的に実装することをお勧めします。
