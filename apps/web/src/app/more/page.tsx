import Link from "next/link";
import { requireOwner } from "@dtr/identity/application/auth";
import { WorkspaceHeader } from "@/components/workspace-header";

const destinations = [
  { href: "/history", title: "Attendance history", description: "Review and edit previous workdays and absences." },
  { href: "/reports/all", title: "All reports", description: "Find saved drafts, ready reports, and submissions." },
  { href: "/settings", title: "Profile and account", description: "Manage internship hours, report details, appearance, and sign out." },
];

export default async function MorePage() {
  await requireOwner();
  return <main id="main" className="app-main"><WorkspaceHeader />
    <div className="page-heading"><h1>More</h1><p>Your records and account settings, together in one place.</p></div>
    <nav className="more-destinations" aria-label="Records and account">
      {destinations.map(item => <Link className="panel more-destination" key={item.href} href={item.href}><div><h2 className="section-title">{item.title}</h2><p className="muted-copy mt-2">{item.description}</p></div><span aria-hidden="true">→</span></Link>)}
    </nav>
  </main>;
}
