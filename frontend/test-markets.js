"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const viem_2 = require("viem");
// 1. Define Bot Chain Testnet
const botchainTestnet = (0, viem_2.defineChain)({
    id: 968, // Replace with actual Bot Chain Testnet ID if different
    name: 'Bot Chain Testnet',
    nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.bohr.life'] },
        public: { http: ['https://rpc.bohr.life'] },
    },
    blockExplorers: {
        default: { name: 'BotScan', url: 'https://scan.bohr.life' },
    },
});
// 2. Setup Clients
const rpcUrl = 'https://rpc.bohr.life';
const publicClient = (0, viem_1.createPublicClient)({
    chain: botchainTestnet,
    transport: (0, viem_1.http)(rpcUrl)
});
// IMPORTANT: Replace this with your funded Testnet private key (e.g. from .env)
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x702d8bed065d31c47fc79f6770edf1327b1fd8eabe824ae68b6fb21743e4e6f0';
const account = (0, accounts_1.privateKeyToAccount)(PRIVATE_KEY);
const walletClient = (0, viem_1.createWalletClient)({
    account,
    chain: botchainTestnet,
    transport: (0, viem_1.http)(rpcUrl)
});
// 3. Contract Addresses and ABI
const PREDICTION_MARKET_ADDRESS = '0x0478E0bF2d6C969365Ae33eDbBbB40e467F43BAB';
// Minimal ABI to open a market
const MARKET_ABI = [
    {
        "inputs": [
            { "internalType": "uint8", "name": "direction", "type": "uint8" }, // 0 = UP, 1 = DOWN
            { "internalType": "uint256", "name": "duration", "type": "uint256" }
        ],
        "name": "openMarket",
        "outputs": [{ "internalType": "uint256", "name": "marketId", "type": "uint256" }],
        "stateMutability": "payable",
        "type": "function"
    }
];
async function main() {
    console.log(`Starting Market Test script...`);
    console.log(`Testing from account: ${account.address}`);
    try {
        const balance = await publicClient.getBalance({ address: account.address });
        console.log(`Current Balance: ${balance} wei`);
        if (balance === 0n) {
            console.error("Error: Account has no BOT. Please fund it first.");
            return;
        }
        const direction = 0; // UP
        const duration = 60n; // 1 Minute
        const stakeAmount = (0, viem_1.parseUnits)('0.1', 18); // 0.1 BOT
        console.log(`Opening a 1-minute UP market with 0.1 BOT...`);
        const { request, result: marketId } = await publicClient.simulateContract({
            account,
            address: PREDICTION_MARKET_ADDRESS,
            abi: MARKET_ABI,
            functionName: 'openMarket',
            args: [direction, duration],
            value: stakeAmount
        });
        const txHash = await walletClient.writeContract(request);
        console.log(`Transaction sent! Waiting for confirmation...`);
        console.log(`Tx Hash: ${txHash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`Success! You have entered a position on Bot Chain Testnet.`);
    }
    catch (error) {
        console.error("Test failed:");
        console.error(error);
    }
}
main().catch(console.error);
