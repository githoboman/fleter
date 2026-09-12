import { NextFunction, Request, Response } from 'express';
import { Contract, JsonRpcProvider } from 'ethers';

const SOMNIA_RPC_URL = process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network';
const SUBSCRIPTION_CONTRACT_ADDRESS = process.env.SUBSCRIPTION_CONTRACT_ADDRESS || '';

const subscriptionAbi = [
  'function isActive(address user, uint8 tier) view returns (bool)',
];

let subscriptionsContract: Contract | null = null;

function resolveTier(requiredTier: string) {
  const normalized = requiredTier.toUpperCase();

  if (normalized === 'PRO') {
    return 1;
  }

  if (normalized === 'ELITE') {
    return 2;
  }

  return null;
}

function getSubscriptionsContract() {
  if (!SUBSCRIPTION_CONTRACT_ADDRESS) {
    return null;
  }

  if (!subscriptionsContract) {
    const provider = new JsonRpcProvider(SOMNIA_RPC_URL);
    subscriptionsContract = new Contract(SUBSCRIPTION_CONTRACT_ADDRESS, subscriptionAbi, provider);
  }

  return subscriptionsContract;
}

export const checkSubscription = async (req: Request, res: Response, next: NextFunction) => {
  const requiredTier = String(req.query.tier || '');
  const userAddress = (req.headers['x-wallet-address'] || req.headers['x-user-address']) as string | undefined;

  if (!requiredTier) {
    return next();
  }

  const tierValue = resolveTier(requiredTier);
  if (!tierValue) {
    return res.status(400).json({ error: `Unsupported subscription tier: ${requiredTier}` });
  }

  if (!userAddress) {
    return res.status(401).json({ error: 'Missing x-wallet-address header' });
  }

  const contract = getSubscriptionsContract();

  if (!contract) {
    console.warn('[Auth] SUBSCRIPTION_CONTRACT_ADDRESS not configured, allowing request');
    return next();
  }

  try {
    const active = await contract.isActive(userAddress, tierValue);

    if (!active) {
      return res.status(403).json({ error: 'Insufficient subscription tier' });
    }

    next();
  } catch (error) {
    console.error('Subscription check failed:', error);
    res.status(500).json({ error: 'Failed to verify subscription on-chain' });
  }
};
