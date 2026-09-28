import { redirect } from "next/navigation";

// Keep old bookmarks working; reminders now live in the workspace header.
export default function NotificationsPage() { redirect("/"); }
