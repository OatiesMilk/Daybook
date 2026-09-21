import { profileData } from "@/controllers/queries";
import { ProfileForm } from "@/views/profile-form";
import { WorkspaceHeader } from "@/components/workspace-header";
export default async function SettingsPage() {
  const profile = await profileData();
  return <main id="main" className="app-main"><WorkspaceHeader /><div className="page-heading"><h1>Your report profile</h1><p>These details appear in your report snapshots and export filenames.</p></div><ProfileForm profile={profile} /></main>;
}
