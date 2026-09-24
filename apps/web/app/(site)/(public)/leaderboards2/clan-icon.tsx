"use client";

import { useEffect, useRef, useState } from "react";
import type { TierFlairStyle } from "@droptracker/api-types";
import { NameTile } from "@/components/ui";

/**
 * A clan's icon, falling back to its name tile. Icons are free-text URLs set
 * by clan admins, and some point at pages rather than images (imgur album
 * links, expired Discord attachments), so a failed load swaps in the tile.
 */
export function ClanIcon({
  src,
  name,
  flair,
}: {
  src?: string;
  name: string;
  flair?: TierFlairStyle;
}) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // An image that failed before hydration never reports it to onError.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setBroken(true);
  }, []);
  if (!src || broken) {
    return <NameTile name={name} size="lg" className="lb2-icon" flair={flair} />;
  }
  return (
    // Plain <img>: clan icons are often animated GIFs on other hosts.
    <img
      ref={ref}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="lb2-icon"
      onError={() => setBroken(true)}
    />
  );
}
