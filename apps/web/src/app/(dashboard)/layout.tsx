import { AppShell } from "../../components/app-shell";
import { UpgradeModalProvider } from "../../components/upgrade-modal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UpgradeModalProvider>
      <AppShell>{children}</AppShell>
    </UpgradeModalProvider>
  );
}
