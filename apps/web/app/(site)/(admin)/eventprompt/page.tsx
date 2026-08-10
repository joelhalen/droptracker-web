import type { Metadata } from "next";
import { requireSuperadmin } from "@/lib/auth";
import { EventPromptClient } from "./eventprompt-client";

export const metadata: Metadata = { title: "AI task generator" };

// Temporary superadmin tool: describes an event task in plain English and a
// headless Claude session (subscription auth, no metered API) generates the
// EventTaskInput, rendered into the normal task editor for review. This
// subtree sits outside /admin, so it carries its own guard (rule 5).
export const dynamic = "force-dynamic";

export default async function EventPromptPage() {
  await requireSuperadmin("/eventprompt");
  return <EventPromptClient />;
}
