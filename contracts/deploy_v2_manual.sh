#!/bin/bash
# Manual V2 deployment script - deploys each contract individually and wires them
set -e

PK="0x702d8bed065d31c47fc79f6770edf1327b1fd8eabe824ae68b6fb21743e4e6f0"
OWNER="0x29284e93b68C84A40c89873e567B9e14B95247b7"
RPC="https://rpc.bohr.life"
COMMON="--rpc-url $RPC --private-key $PK --broadcast --legacy"

deploy() {
  local contract=$1
  local file=$2
  shift 2
  echo ""
  echo ">>> Deploying $contract..."
  ADDR=$(forge create $file:$contract $COMMON "$@" 2>&1 | grep "Deployed to:" | awk '{print $3}')
  echo "    $contract => $ADDR"
  echo "$ADDR"
}

echo "========================================="
echo "  BitDrum V2 Manual Deployment"
echo "========================================="

ADAPTER=$(deploy BitdrumPriceAdapter src/BitdrumPriceAdapter.sol --constructor-args $OWNER)
echo "ADAPTER=$ADAPTER"

VAULT=$(deploy LiquidityVaultV2 src/LiquidityVaultV2.sol --constructor-args $OWNER)
echo "VAULT=$VAULT"

TREASURY=$(deploy TreasuryV2 src/TreasuryV2.sol --constructor-args $VAULT $OWNER $OWNER)
echo "TREASURY=$TREASURY"

LEADERBOARD=$(deploy LeaderboardRegistry src/LeaderboardRegistry.sol --constructor-args $OWNER)
echo "LEADERBOARD=$LEADERBOARD"

MARKET=$(deploy PredictionMarketV2 src/PredictionMarketV2.sol --constructor-args $VAULT $TREASURY $ADAPTER $OWNER)
echo "MARKET=$MARKET"

ENGINE=$(deploy SettlementEngineV2 src/SettlementEngineV2.sol --constructor-args $MARKET $LEADERBOARD $ADAPTER $OWNER)
echo "ENGINE=$ENGINE"

echo ""
echo "========================================="
echo "  Wiring contracts..."
echo "========================================="

echo ">>> vault.setPredictionMarket($MARKET)"
cast send $VAULT "setPredictionMarket(address)" $MARKET $COMMON

echo ">>> market.setSettlementEngine($ENGINE) [via keeper setter on PredictionMarketV2]"
cast send $MARKET "setSettlementEngine(address)" $ENGINE $COMMON

echo ">>> leaderboard.setSettlementEngine($ENGINE)"
cast send $LEADERBOARD "setSettlementEngine(address)" $ENGINE $COMMON

echo ">>> adapter.setKeeper($OWNER) [owner is keeper initially]"
cast send $ADAPTER "setKeeper(address)" $OWNER $COMMON

echo ">>> vault.deposit() with 50 BOT seed"
cast send $VAULT "deposit()" --value 50ether $COMMON

echo ""
echo "========================================="
echo "  DEPLOYMENT COMPLETE"
echo "  BitdrumPriceAdapter: $ADAPTER"
echo "  LiquidityVaultV2:    $VAULT"
echo "  TreasuryV2:          $TREASURY"
echo "  LeaderboardRegistry: $LEADERBOARD"
echo "  PredictionMarketV2:  $MARKET"
echo "  SettlementEngineV2:  $ENGINE"
echo "========================================="
