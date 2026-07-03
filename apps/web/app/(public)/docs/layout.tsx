import { api } from "@/lib/api";
import { groupDocsByCategory } from "@/lib/docs";
import { DocsSidebar } from "@/components/docs-sidebar";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const groups = groupDocsByCategory(await api.docs());

  return (
    <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
      <aside className="md:sticky md:top-6 md:self-start">
        <DocsSidebar groups={groups} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
