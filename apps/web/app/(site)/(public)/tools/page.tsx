import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { ToolsDirectory } from "@/components/tools/tools-directory";
import type { ToolDirectory } from "@/lib/tools-directory";

export const metadata: Metadata = {
  title: "Tools & communities",
  description: "Tools and communities The DropTracker uses or recommends for Old School RuneScape players and clans.",
  // Staff preview for now; drop this when the page goes public.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  // Staff preview: the Web API only answers staff and the maintainers of a
  // listing (so they can edit theirs). Going public means opening up
  // GET /tools/listings and dropping the sign-in here and `robots` above.
  await requireUser("/tools");

  let directory: ToolDirectory | null = null;
  let loadError: string | null = null;
  try {
    directory = await api.toolListings();
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) forbidden();
    loadError = err instanceof Error ? err.message : "Could not load the directory.";
  }

  return (
    <div className="space-y-10">
      <header>
        <span className="bg-osrs-red/20 text-osrs-red rounded px-2 py-0.5 text-xs font-medium">
          Staff preview
        </span>
        <h1 className="text-osrs-gold mt-2 text-3xl font-bold">Tools & communities</h1>
        <p className="text-osrs-parchment-dark/80 mt-2 max-w-2xl">
          The projects we build on and the places we point players to. None of these are run by
          The DropTracker. We just use them and think you should too.
        </p>
      </header>

      {directory ? (
        <ToolsDirectory initialListings={directory.listings} canAdmin={directory.can_admin} />
      ) : (
        <Alert>{loadError}</Alert>
      )}
    </div>
  );
}
