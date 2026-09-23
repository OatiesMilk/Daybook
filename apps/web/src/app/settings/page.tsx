import { profileData } from "@/application/queries";
import { ProfileForm } from "@dtr/identity/presentation/profile-form";
import { WorkspaceHeader } from "@/components/workspace-header";
import { ThemeToggle } from "@dtr/shared/ui/theme-toggle";
import { logout } from "@dtr/identity/application/actions";
export default async function SettingsPage() {
  const profile = await profileData();
  return <main id="main" className="app-main"><WorkspaceHeader /><div className="page-heading"><h1>Your profile and internship</h1><p>Manage the details used in reports and your required internship hours.</p></div><ProfileForm profile={profile} />
    <section className="mobile-account-actions panel mt-6 max-w-2xl" aria-labelledby="mobile-account-heading"><h2 id="mobile-account-heading" className="section-title">Account</h2><p className="muted-copy mt-2">Adjust the app appearance or end your session.</p><div className="mobile-account-row mt-5"><div><span className="mobile-account-label">Appearance</span><ThemeToggle /></div><form action={logout}><button className="secondary-button">Sign out</button></form></div></section>
  </main>;
}
