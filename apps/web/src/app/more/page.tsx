import { redirect } from "next/navigation";

// Preserve bookmarks while removing the intermediate navigation page.
export default function MorePage() { redirect("/"); }
