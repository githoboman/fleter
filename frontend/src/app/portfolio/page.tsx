import { AppShell } from '@/components/AppShell';
import { PortfolioBoard } from '@/components/PortfolioBoard';

export default function PortfolioPage() {
  return (
    <AppShell
      title="Portfolio"
      description="A dedicated surface for open positions, settlement countdowns, outcomes, and claims."
    >
      <PortfolioBoard />
    </AppShell>
  );
}
