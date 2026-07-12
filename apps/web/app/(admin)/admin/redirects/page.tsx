import type { Metadata } from "next";
import { api } from "@/lib/api";
import { RedirectsManager } from "@/components/admin/redirects-manager";

export const metadata: Metadata = { title: "Redirects" };
export const dynamic = "force-dynamic";

export default async function AdminRedirectsPage() {
  const redirects = await api.adminRedirects();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Configure URL redirects — add, edit, and remove them here with no code deploy; changes go
        live within seconds. <span className="text-osrs-gold-bright">Source</span> uses
        path-to-regexp (same syntax as before, e.g.{" "}
        <code className="text-osrs-gold-bright">/players/view/:id(\d+)</code>), and{" "}
        <span className="text-osrs-gold-bright">destination</span> is an internal path (
        <code>/docs</code>) or an external URL (<code>https://runelite.net</code>).
      </p>
      <RedirectsManager redirects={redirects} />
    </div>
  );
}
