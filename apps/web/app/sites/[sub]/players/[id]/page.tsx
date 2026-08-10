/**
 * Tenant-branded player profile (sites-v1).
 *
 * Clan-site widgets (top players, drops, leaderboards) link to
 * `/players/{ref}`; before this wrapper existed those paths fell through the
 * tenant rewrites to the MAIN app route and rendered DropTracker chrome on
 * the clan's domain. This re-exports the same public profile page inside the
 * tenant layout, so drilling into a player keeps the clan's branding.
 */
import type { Metadata } from "next";
import PlayerPage, {
  generateMetadata as playerMetadata,
} from "@/app/(site)/(public)/players/[id]/page";

export const revalidate = 30;

type Params = Promise<{ sub: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return playerMetadata({ params: Promise.resolve({ id }) });
}

export default async function TenantPlayerPage({ params }: { params: Params }) {
  const { id } = await params;
  return <PlayerPage params={Promise.resolve({ id })} />;
}
