$ErrorActionPreference = "Stop"
$env:PATH += ";C:\Users\OWNER\.foundry\bin"

$PK = "0x702d8bed065d31c47fc79f6770edf1327b1fd8eabe824ae68b6fb21743e4e6f0"
$OWNER = "0x29284e93b68C84A40c89873e567B9e14B95247b7"
$RPC = "https://rpc.bohr.life"

function Deploy-Contract {
    param(
        [string]$ContractName,
        [string]$File,
        [string[]]$Arguments
    )
    Write-Host "`n>>> Deploying $ContractName..."
    if ($Arguments.Count -gt 0) {
        $output = forge create "$File`:$ContractName" --rpc-url $RPC --private-key $PK  --legacy --constructor-args $Arguments 2>&1
    } else {
        $output = forge create "$File`:$ContractName" --rpc-url $RPC --private-key $PK  --legacy 2>&1
    }
    
    $addr = ($output | Select-String -Pattern "Deployed to:\s+(0x[a-fA-F0-9]+)").Matches.Groups[1].Value
    Write-Host "    $ContractName => $addr"
    return $addr
}

Write-Host "========================================="
Write-Host "  BitDrum V2 Manual Deployment (Bot Chain)"
Write-Host "========================================="

$ADAPTER = Deploy-Contract -ContractName "BitdrumPriceAdapter" -File "src/BitdrumPriceAdapter.sol" -Arguments $OWNER
$VAULT = Deploy-Contract -ContractName "LiquidityVaultV2" -File "src/LiquidityVaultV2.sol" -Arguments $OWNER
$TREASURY = Deploy-Contract -ContractName "TreasuryV2" -File "src/TreasuryV2.sol" -Arguments $VAULT, $OWNER, $OWNER
$LEADERBOARD = Deploy-Contract -ContractName "LeaderboardRegistry" -File "src/LeaderboardRegistry.sol" -Arguments $OWNER
$MARKET = Deploy-Contract -ContractName "PredictionMarketV2" -File "src/PredictionMarketV2.sol" -Arguments $VAULT, $TREASURY, $ADAPTER, $OWNER
$ENGINE = Deploy-Contract -ContractName "SettlementEngineV2" -File "src/SettlementEngineV2.sol" -Arguments $MARKET, $LEADERBOARD, $ADAPTER, $OWNER

Write-Host "`n========================================="
Write-Host "  Wiring contracts..."
Write-Host "========================================="

Write-Host ">>> vault.setPredictionMarket($MARKET)"
cast send $VAULT "setPredictionMarket(address)" $MARKET --rpc-url $RPC --private-key $PK  --legacy

Write-Host ">>> market.setSettlementEngine($ENGINE) [via keeper setter on PredictionMarketV2]"
cast send $MARKET "setSettlementEngine(address)" $ENGINE --rpc-url $RPC --private-key $PK  --legacy

Write-Host ">>> leaderboard.setSettlementEngine($ENGINE)"
cast send $LEADERBOARD "setSettlementEngine(address)" $ENGINE --rpc-url $RPC --private-key $PK  --legacy

Write-Host ">>> adapter.setKeeper($OWNER) [owner is keeper initially]"
cast send $ADAPTER "setKeeper(address)" $OWNER --rpc-url $RPC --private-key $PK  --legacy

Write-Host ">>> vault.deposit() with 50 BOT seed"
cast send $VAULT "deposit()" --value 50ether --rpc-url $RPC --private-key $PK  --legacy

Write-Host "`n========================================="
Write-Host "  DEPLOYMENT COMPLETE"
Write-Host "  BitdrumPriceAdapter: $ADAPTER"
Write-Host "  LiquidityVaultV2:    $VAULT"
Write-Host "  TreasuryV2:          $TREASURY"
Write-Host "  LeaderboardRegistry: $LEADERBOARD"
Write-Host "  PredictionMarketV2:  $MARKET"
Write-Host "  SettlementEngineV2:  $ENGINE"
Write-Host "========================================="
