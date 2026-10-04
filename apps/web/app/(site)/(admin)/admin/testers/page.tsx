import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { requireDeveloper } from "@/lib/auth";
import { AdminTesterBuildsPanel } from "@/components/admin/tester-builds-panel";
import { pagePath } from "@/lib/tester-builds";

export const metadata: Metadata = { title: "Testers" };

// Pipeline state and who has downloaded what change by the minute.
export const dynamic = "force-dynamic";

/**
 * Staff side of the plugin test builds. Developer gate rather than superadmin:
 * it is a read-only diagnostic view, and developers are the ones who need to
 * know whether a build went out and who has tried it.
 */
export default async function AdminTestersPage() {
  await requireDeveloper("/admin/testers");
  const data = await api.adminTesterBuilds();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Plugin test builds for Bug Testers. Testers download the current build from{" "}
        <Link href={pagePath as Route} className="text-osrs-gold-bright hover:underline">
          {pagePath}
        </Link>
        . This page shows whether the build job is healthy, which builds are out, and what each
        tester has downloaded and run.
      </p>
      <AdminTesterBuildsPanel data={data} />
    </div>
  );
}
