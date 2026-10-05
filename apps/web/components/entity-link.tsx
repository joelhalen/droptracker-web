"use client";

/**
 * A link to a player, group, NPC or item that works in every front-end.
 *
 * On the site it is a plain `<Link>` to the entity's page. Under an embed host
 * (the Discord Activity) it is a button that asks the host to show the entity
 * in place, because a route change would leave the iframe's single-page app.
 * Use it in shared components instead of `<Link href={entityPath(...)}>`.
 */
import Link from "next/link";
import { entityPath, type EntityKind } from "@/lib/slug";
import { useEmbedHost, type EntityTarget } from "@/lib/embed-host";

const PLURAL: Record<EntityTarget["kind"], EntityKind> = {
  player: "players",
  group: "groups",
  npc: "npcs",
  item: "items",
};

export function EntityLink({
  kind,
  id,
  name,
  className,
  title,
  children,
}: {
  kind: EntityTarget["kind"];
  id: number;
  name?: string | null;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const host = useEmbedHost();
  if (host) {
    return (
      <button
        type="button"
        title={title}
        onClick={() => host.openEntity({ kind, id, name } as EntityTarget)}
        className={`cursor-pointer text-left ${className ?? ""}`}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={entityPath(PLURAL[kind], id, name)} title={title} className={className}>
      {children}
    </Link>
  );
}

/**
 * An external link (a screenshot, the wiki, a Discord invite). A normal
 * new-tab anchor on the site; under an embed host it hands the URL to the
 * host, since `target="_blank"` does nothing inside the Activity iframe.
 */
export function ExternalLink({
  href,
  className,
  title,
  children,
  ...aria
}: {
  href: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const host = useEmbedHost();
  if (host) {
    return (
      <button
        type="button"
        title={title}
        aria-label={aria["aria-label"]}
        onClick={() => host.openExternal(href)}
        className={`cursor-pointer ${className ?? ""}`}
      >
        {children}
      </button>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={aria["aria-label"]}
      className={className}
    >
      {children}
    </a>
  );
}

/**
 * An `<img>` whose address the embed host maps (the Activity's CSP only
 * allows same-origin images). A plain `<img>` on the site. Lets server
 * components keep their absolute icon URLs and still work in the iframe.
 */
export function EmbedImg({
  src,
  alt = "",
  ...rest
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string }) {
  const host = useEmbedHost();
  return <img src={(host ? host.img(src) : src) ?? src} alt={alt} {...rest} />;
}
