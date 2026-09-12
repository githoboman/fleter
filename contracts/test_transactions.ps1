$ErrorActionPreference = "Stop"
$env:PATH += ";C:\Users\OWNER\.foundry\bin"

$PK = "0x702d8bed065d31c47fc79f6770edf1327b1fd8eabe824ae68b6fb21743e4e6f0"
$RPC = "https://rpc.bohr.life"

$ADAPTER = "0x90C70e356540C8b53Bb5cd0BA35B8f2779c9a10c"
$MARKET = "0x0478E0bF2d6C969365Ae33eDbBbB40e467F43BAB"

$timestamp = [int][double]::Parse((Get-Date (Get-Date).ToUniversalTime() -UFormat %s))
$price = 6000000 # $60k * 100 

Write-Host ">>> Posting mock BTC/USD price to Adapter ($price at $timestamp)..."
cast send $ADAPTER "postPrice(uint128,uint128)" $price $timestamp --rpc-url $RPC --private-key $PK --legacy

Write-Host ">>> Opening 1-minute UP market on PredictionMarketV2 with 0.1 BOT..."
cast send $MARKET "openMarket(uint8,uint256)" 0 60 --value 0.1ether --rpc-url $RPC --private-key $PK --legacy

Write-Host ">>> Done! Testnet transactions successfully executed."
