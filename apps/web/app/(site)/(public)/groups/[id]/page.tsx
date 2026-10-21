import type { Metadata } from "next";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef } from "@/lib/entity-ref";
import { groupSocialMetadata, entityCanonical } from "@/lib/seo";
import { defaultGroupLayout } from "@/lib/page-layout/catalog";
import { loadGroupPageContext } from "@/lib/page-layout/load";
import { EntityDisambiguation } from "@/components/entity-disambiguation";
import { GroupPageView } from "@/components/page-layout/group-page-view";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("group", id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Group" };
  try {
    const group = await api.group(ref.id);
    return {
      ...groupSocialMetadata(group, { title: group.name }),
      alternates: entityCanonical("groups", group.id, group.canonical_slug),
    };
  } catch {
    return { title: "Group" };
  }
}

export default async function GroupPage({ params }: { params: Params }) {
  const { id } = await params;
  const ref = await resolveRef("group", id);
  if (ref.ambiguous) {
    return (
      <EntityDisambiguation kind="groups" slug={decodeURIComponent(id)} candidates={ref.candidates} />
    );
  }
  const group = await orNotFound(api.group(ref.id));
  // The group's own design when it has published one (and its plan covers
  // it), else the standard page. Both render through the same view.
  const [layout, ctx] = await Promise.all([
    api.groupPageLayout(group.id).catch(() => null),
    loadGroupPageContext(group),
  ]);
  return <GroupPageView layout={layout ?? defaultGroupLayout()} ctx={ctx} />;
}
