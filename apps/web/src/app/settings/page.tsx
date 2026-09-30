import { profileData } from "@/application/queries";
import { ProfileForm } from "@dtr/identity/presentation/profile-form";
import { WorkspaceHeader } from "@/components/workspace-header";
export default async function SettingsPage() {
  const profile = await profileData();
  return <main id="main" className="app-main"><WorkspaceHeader /><div className="page-heading"><h1>Your profile and internship</h1><p>Manage the details used in reports and your required internship hours.</p></div><ProfileForm profile={profile} />
  </main>;
}
