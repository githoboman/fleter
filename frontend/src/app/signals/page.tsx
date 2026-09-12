import { AppShell } from '@/components/AppShell';
import { SignalsPageView } from '@/components/SignalsPageView';

export default function SignalsPage() {
  return (
    <AppShell
      title="BitDrum Edge"
      description="The fair-value model behind every call: what BitDrum thinks the window is worth versus what the DreamDEX book is charging."
    >
      <SignalsPageView />
    </AppShell>
  );
}
