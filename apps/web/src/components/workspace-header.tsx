import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import { Brand } from "@dtr/shared/ui/brand";
import { WorkspaceNav } from "@/components/workspace-nav";
import { CurrentDateTime } from "@/components/current-date-time";
import { AccountMenu, AccountMenuPlaceholder } from "@/components/account-menu";
import { NotificationCenter } from "@dtr/attendance/presentation/notification-center";
import { loadReminders } from "@/application/notification-actions";
import { accountData } from "@/application/queries";
import { HelpChat } from "@/help/presentation/help-chat";

// Streams in after the page so the name lookup never delays content. A failed profile
// read degrades to "Your account" rather than breaking the whole page.
async function Account() {
  let account: Awaited<ReturnType<typeof accountData>> = { name: null, email: null };
  try { account = await accountData(); } catch (error) { unstable_rethrow(error); }
  return <AccountMenu {...account} />;
}

function AccountSlot({ className }: { className: string }) {
  return <div className={className}><Suspense fallback={<AccountMenuPlaceholder />}><Account /></Suspense></div>;
}

export function WorkspaceHeader() {
  return <>
    <header className="workspace-header">
      <div className="workspace-identity">
        <Brand />
        <CurrentDateTime />
        <div className="workspace-header-tools"><NotificationCenter load={loadReminders} /><HelpChat /><AccountSlot className="account-slot-mobile" /></div>
      </div>
      <nav aria-label="Main navigation" className="workspace-nav">
        <WorkspaceNav />
      </nav>
      <AccountSlot className="account-slot-desktop" />
    </header>
    <nav aria-label="Mobile navigation" className="mobile-bottom-nav"><WorkspaceNav /></nav>
  </>;
}
