import type { Metadata } from "next";
import { api } from "@/lib/api";
import { B2UsagePanel } from "@/components/admin/b2-usage-panel";

export const metadata: Metadata = { title: "B2 usage" };

// The usage scan lists the live bucket on every load — never cache this page.
export const dynamic = "force-dynamic";

export default async function AdminB2Page() {
  let usage = null;
  let error: string | null = null;
  try {
    usage = await api.adminB2Usage();
  } catch (e) {
    error = (e as Error).message || "B2 usage scan failed.";
  }

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Live storage usage for the Backblaze B2 bucket (video uploads + database backups), with an
        estimated monthly storage bill. Bandwidth used is not exposed by B2&apos;s API — egress and
        transaction caps live in the B2 console under Caps &amp; Alerts.
      </p>
      {error ? (
        <p className="text-osrs-red text-sm">Could not reach B2: {error}</p>
      ) : (
        usage && <B2UsagePanel usage={usage} />
      )}
    </div>
  );
}
