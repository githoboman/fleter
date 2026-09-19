$ErrorActionPreference = "Continue"
$env:PATH += ";C:\Users\OWNER\.foundry\bin"

$PK = "0x702d8bed065d31c47fc79f6770edf1327b1fd8eabe824ae68b6fb21743e4e6f0"
$OWNER = "0x29284e93b68C84A40c89873e567B9e14B95247b7"
$RPC = "https://rpc.botchain.ai"

$ADAPTER = "0x833E8336d77F7Da45c155e6df4E5c72391073E6c"
$VAULT = "0x042D0fb514f9753980055B34f210e7b19CB5AAF8"
$TREASURY = "0x0aeeC511e30c7271ded720f17206c85F2F9EeFe7"
$LEADERBOARD = "0x90C70e356540C8b53Bb5cd0BA35B8f2779c9a10c"
$MARKET = "0x86f62D80fbdD194fAb3ABFC86C676cF5C4411A9D"

function Deploy-Contract {
    param(
        [string]$ContractName,
        [string]$File,
        [string[]]$Arguments
    )
    Write-Host "`n>>> Deploying $ContractName..."
    if ($Arguments.Count -gt 0) {
        $output = forge create "$File`:$ContractName" --rpc-url $RPC --private-key $PK --broadcast --legacy --constructor-args $Arguments 2>&1
    } else {
        $output = forge create "$File`:$ContractName" --rpc-url $RPC --private-key $PK --broadcast --legacy 2>&1
    }
    
    $addr = ($output | Select-String -Pattern "Deployed to:\s+(0x[a-fA-F0-9]+)").Matches.Groups[1].Value
    Write-Host "    $ContractName => $addr"
    return $addr
}

Write-Host "========================================="
Write-Host "  BitDrum V2 Manual Deployment (RESUME)"
Write-Host "========================================="

$ENGINE = Deploy-Contract -ContractName "SettlementEngineV2" -File "src/SettlementEngineV2.sol" -Arguments $MARKET, $LEADERBOARD, $ADAPTER, $OWNER

Write-Host "`n========================================="
Write-Host "  Wiring contracts..."
Write-Host "========================================="

Write-Host ">>> market.setSettlementEngine($ENGINE) [via keeper setter on PredictionMarketV2]"
cast send $MARKET "setSettlementEngine(address)" $ENGINE --rpc-url $RPC --private-key $PK --legacy

Write-Host ">>> leaderboard.setSettlementEngine($ENGINE)"
cast send $LEADERBOARD "setSettlementEngine(address)" $ENGINE --rpc-url $RPC --private-key $PK --legacy

Write-Host ">>> vault.deposit() with 1 BOT seed"
cast send $VAULT "deposit()" --value 1ether --rpc-url $RPC --private-key $PK --legacy

Write-Host "`n========================================="
Write-Host "  DEPLOYMENT COMPLETE"
Write-Host "  BitdrumPriceAdapter: $ADAPTER"
Write-Host "  LiquidityVaultV2:    $VAULT"
Write-Host "  TreasuryV2:          $TREASURY"
Write-Host "  LeaderboardRegistry: $LEADERBOARD"
Write-Host "  PredictionMarketV2:  $MARKET"
Write-Host "  SettlementEngineV2:  $ENGINE"
Write-Host "========================================="

# Save to a file
$markdown = @"
# BitDrum V2 Deployment Addresses (BOT Chain Mainnet)

Deployed on: $(Get-Date -Format 'yyyy-MM-dd')
Deployer/Owner: $OWNER
Chain ID: 677

| Contract | Address |
| :--- | :--- |
| **BitdrumPriceAdapter** | `$ADAPTER` |
| **LiquidityVaultV2** | `$VAULT` |
| **TreasuryV2** | `$TREASURY` |
| **LeaderboardRegistry** | `$LEADERBOARD` |
| **PredictionMarketV2** | `$MARKET` |
| **SettlementEngineV2** | `$ENGINE` |
"@
$markdown | Out-File -FilePath "MAINNET_DEPLOYMENT_ADDRESSES.md" -Encoding UTF8
Write-Host "Addresses saved to MAINNET_DEPLOYMENT_ADDRESSES.md"
