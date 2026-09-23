import { Brand } from "@dtr/shared/ui/brand";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ThemeToggle } from "@dtr/shared/ui/theme-toggle";
import { logout } from "@dtr/identity/application/actions";
import { CurrentDateTime } from "@/components/current-date-time";

export function WorkspaceHeader() {
  return <>
    <header className="workspace-header">
      <div className="workspace-identity"><Brand /><CurrentDateTime /></div><nav aria-label="Main navigation" className="workspace-nav">
        <WorkspaceNav />
        <ThemeToggle />
        <form action={logout}><button className="secondary-button">Sign out</button></form>
      </nav>
    </header>
    <nav aria-label="Mobile navigation" className="mobile-bottom-nav"><WorkspaceNav /></nav>
  </>;
}
