/**
 * The /tools directory: third-party tools and communities DropTracker uses or
 * recommends. Repo-versioned (like /privacy) rather than CMS-backed, so an
 * entry is one object below and changes go through review.
 *
 * Visible copy follows the site style: short, plain, no em-dashes.
 */

export type ToolCategory = "tools" | "communities";

export type ToolLink = { label: string; href: string };

export type ToolEntry = {
  name: string;
  category: ToolCategory;
  /** One or two sentences on what it is. */
  description: string;
  /** How DropTracker itself relies on it, when it does. */
  usedFor?: string;
  tags: string[];
  /** First entry is the primary link (the card's title links there too). */
  links: [ToolLink, ...ToolLink[]];
  /** Monogram tile accent (any CSS color). Falls back to a hue from the name. */
  accent?: string;
};

export const TOOL_CATEGORIES: { id: ToolCategory; title: string; blurb: string }[] = [
  {
    id: "tools",
    title: "Tools we use",
    blurb: "Services and projects The DropTracker is built on or works alongside.",
  },
  {
    id: "communities",
    title: "Communities",
    blurb: "Places to find a clan, meet other players, or get involved.",
  },
];

export const TOOLS: ToolEntry[] = [
  {
    name: "Wise Old Man",
    category: "tools",
    description:
      "Open-source progress tracker for Old School RuneScape. Tracks XP, boss kills and activity over time, and runs clan competitions.",
    usedFor:
      "Group rosters sync from Wise Old Man, and Skill and Boss of the Week results use its XP and kill-count gains.",
    tags: ["Progress tracking", "Competitions", "Open source"],
    links: [
      { label: "wiseoldman.net", href: "https://wiseoldman.net" },
      { label: "GitHub", href: "https://github.com/wise-old-man/wise-old-man" },
    ],
    accent: "#3b82f6",
  },
  {
    name: "Old School RuneScape Wiki",
    category: "tools",
    description:
      "The community-run wiki for the game. It also runs a real-time Grand Exchange price API built with RuneLite.",
    usedFor: "Item prices and boss drop tables on The DropTracker come from the wiki.",
    tags: ["Reference", "Prices"],
    links: [
      { label: "oldschool.runescape.wiki", href: "https://oldschool.runescape.wiki" },
      { label: "Real-time prices", href: "https://prices.runescape.wiki" },
    ],
    accent: "#b8860b",
  },
  {
    name: "RuneLite",
    category: "tools",
    description: "The open-source third-party client for Old School RuneScape, with a hub of community plugins.",
    usedFor: "Our plugin runs on RuneLite and is installed from the Plugin Hub.",
    tags: ["Client", "Plugins", "Open source"],
    links: [
      { label: "runelite.net", href: "https://runelite.net" },
      { label: "Plugin Hub", href: "https://runelite.net/plugin-hub" },
    ],
    accent: "#d97706",
  },
  {
    name: "OSRS Clans",
    category: "communities",
    description:
      "A directory for finding and recruiting clans, with a list of community groups and clan utilities.",
    tags: ["Clan directory", "Recruiting"],
    links: [
      { label: "osrsclans.cc", href: "https://osrsclans.cc" },
      { label: "Communities", href: "https://osrsclans.cc/communities" },
    ],
    accent: "#16a34a",
  },
];
