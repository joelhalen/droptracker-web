import type { Metadata } from "next";
import { requireDeveloper } from "@/lib/auth";
import { EventPromptClient } from "./eventprompt-client";

export const metadata: Metadata = { title: "AI task generator" };

// Temporary staff tool (developer or superadmin): describes an event task in
// plain English and a headless Claude session (subscription auth, no metered
// API) generates the EventTaskInput, rendered into the normal task editor for
// review. This subtree sits outside /admin, so it carries its own guard
// (rule 5). The form's site-wide meta lookups allow developers too — see
// assertCanUseEventMeta in the events actions.
export const dynamic = "force-dynamic";

export default async function EventPromptPage() {
  await requireDeveloper("/eventprompt");
  return <EventPromptClient />;
}
