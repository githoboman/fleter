import { AppShell } from '@/components/AppShell';
import { TradingDashboard } from '@/components/TradingDashboard';

export default function ArenaPage() {
  return (
    <AppShell
      title="The trading arena"
      description="One-tap Up/Down calls on BitDrum Markets, priced by BitDrum Edge before you sign."
    >
      <TradingDashboard />
    </AppShell>
  );
}
