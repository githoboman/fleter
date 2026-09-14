import { AppShell } from '@/components/AppShell';
import { SignalsPageView } from '@/components/SignalsPageView';

export default function SignalsPage() {
  return (
    <AppShell
      title="Botrem Edge"
      description="The fair-value model behind every call: what Botrem thinks the window is worth versus what the Botrem book is charging."
    >
      <SignalsPageView />
    </AppShell>
  );
}
