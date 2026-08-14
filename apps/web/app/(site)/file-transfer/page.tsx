import type { Metadata } from "next";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { FileTransferPanel } from "@/components/file-transfer-panel";

/**
 * Unlisted file hand-off page (web95a). Any signed-in user may use it, but
 * nothing links here — no nav entry, no dashboard tab — so it is reachable
 * only by someone who was given the URL. That is an obscurity measure, not an
 * access control: the real gate is `requireUser` plus the backend's own
 * session check, and each transfer is readable only by its owner and staff.
 *
 * It sits directly under (site) rather than in the (dashboard) group on
 * purpose. That layout's own `requireUser("/dashboard")` runs *before* a
 * nested page's guard, so a signed-out visitor following the link would come
 * back from Discord OAuth on /dashboard and have to re-enter the URL they were
 * given — the one thing an unlisted page cannot ask of people. Out here the
 * guard below is the first to run and returns them to /file-transfer.
 *
 * `noindex` keeps the URL out of search results if it ever gets shared
 * somewhere public.
 */
export const metadata: Metadata = {
  title: "Send a file",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function FileTransferPage() {
  await requireUser("/file-transfer");
  const data = await api.myFileTransfers();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-osrs-gold text-xl font-bold">Send a file</h1>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Upload a file for site staff to look at. They can send back an updated copy, and every
          version stays downloadable here. Files are deleted {data.retention_days} days after the
          most recent version — download anything you want to keep.
        </p>
      </div>

      <FileTransferPanel
        transfers={data.items}
        maxBytes={data.max_bytes}
        retentionDays={data.retention_days}
      />
    </div>
  );
}
