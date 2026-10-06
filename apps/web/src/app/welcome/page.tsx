import { redirect } from "next/navigation";
import { Brand } from "@dtr/shared/ui/brand";
import { ThemeToggle } from "@dtr/shared/ui/theme-toggle";
import { ProfileForm } from "@dtr/identity/presentation/profile-form";
import { isProfileComplete } from "@dtr/identity/domain/profile";
import { logout } from "@dtr/identity/application/actions";
import { internshipToday } from "@dtr/shared/domain/internship-date";
import { profileData } from "@/application/queries";

// First-run onboarding. Workspace pages redirect here until the profile is complete;
// a completed profile is edited from the Profile page instead.
export default async function WelcomePage() {
  const profile = await profileData();
  if (isProfileComplete(profile)) redirect("/");
  return <main id="main" className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16 sm:px-6">
    <header className="flex items-center justify-between gap-4"><Brand /><ThemeToggle /></header>
    <div className="page-heading"><h1>Set up your internship record</h1>
      <p>These details appear on your daily activity reports and set the target your progress is measured against. If you started your internship before Daybook, you can carry over the hours you already rendered.</p></div>
    <ProfileForm profile={profile} today={internshipToday()} onboarding />
    <form action={logout} className="mt-6"><button className="text-sm font-semibold text-accent underline min-h-11">Sign out</button></form>
  </main>;
}
