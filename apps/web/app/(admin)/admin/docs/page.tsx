import type { Metadata } from "next";
import { api } from "@/lib/api";
import { DocsManager } from "@/components/admin/docs-manager";

export const metadata: Metadata = { title: "Docs" };
export const dynamic = "force-dynamic";

export default async function AdminDocsPage() {
  const docs = await api.docs();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Add, edit, and delete documentation pages — no code deploy required. Changes are live on{" "}
        <span className="text-osrs-gold-bright">/docs</span> immediately.
      </p>
      <DocsManager docs={docs} />
    </div>
  );
}
