import { profileData } from "@/application/queries";
import { ProfileForm } from "@dtr/identity/presentation/profile-form";
import { WorkspaceHeader } from "@/components/workspace-header";
import { internshipToday } from "@dtr/shared/domain/internship-date";
export default async function SettingsPage() {
  const profile = await profileData();
  return <main id="main" className="app-main"><WorkspaceHeader /><div className="page-heading"><h1>Your profile and internship</h1><p>Manage the details used in reports, your required internship hours, and any hours carried over from before Daybook.</p></div><ProfileForm profile={profile} today={internshipToday()} />
  </main>;
}
