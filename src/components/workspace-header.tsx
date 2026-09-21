import { Brand } from "@/components/brand";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/auth/actions";

export function WorkspaceHeader() {
  return <header className="workspace-header">
    <Brand /><nav aria-label="Main navigation" className="workspace-nav">
      <WorkspaceNav />
      <ThemeToggle />
      <form action={logout}><button className="secondary-button">Sign out</button></form>
    </nav>
  </header>;
}
