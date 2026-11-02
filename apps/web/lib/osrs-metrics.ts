/**
 * Wise Old Man metric slugs -> what a reader expects to see.
 *
 * The clan stats payload and the recap card carry WOM's slugs
 * ("chambers_of_xeric", "tzkal_zuk"); titles are derived here. Mirrors
 * disc `services/group_stats_discord.metric_label` for the Discord card.
 */

export const SKILLS = [
  "attack", "strength", "defence", "ranged", "prayer", "magic", "runecrafting",
  "construction", "hitpoints", "agility", "herblore", "thieving", "crafting",
  "fletching", "slayer", "hunter", "mining", "smithing", "fishing", "cooking",
  "firemaking", "woodcutting", "farming", "sailing",
] as const;

const SMALL_WORDS = new Set(["of", "the", "and", "a", "in", "on"]);

const NAMES: Record<string, string> = {
  tzkal_zuk: "TzKal-Zuk",
  tztok_jad: "TzTok-Jad",
  kreearra: "Kree'arra",
  kril_tsutsaroth: "K'ril Tsutsaroth",
  chambers_of_xeric_challenge_mode: "CoX: Challenge Mode",
  theatre_of_blood_hard_mode: "ToB: Hard Mode",
  tombs_of_amascut_expert: "ToA: Expert",
  runecrafting: "Runecraft",
  clue_scrolls_all: "Clues",
  ehp: "EHP",
  ehb: "EHB",
  dagannoth_prime: "Dagannoth Prime",
  calvarion: "Calvar'ion",
  vetion: "Vet'ion",
  thermonuclear_smoke_devil: "Thermy",
  the_corrupted_gauntlet: "Corrupted Gauntlet",
  the_gauntlet: "The Gauntlet",
  lunar_chests: "Lunar Chests",
  sol_heredit: "Sol Heredit",
};

export function metricLabel(metric: string): string {
  if (NAMES[metric]) return NAMES[metric];
  return metric
    .split("_")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function isSkill(metric: string): boolean {
  return (SKILLS as readonly string[]).includes(metric);
}

/**
 * Icons we serve at /img/metrics/{slug}.png (disc static/assets/img/metrics).
 * Listed rather than probed: the recap card is a screenshot, and a 404 there
 * is a broken-image box baked into a PNG. Bosses newer than the set simply
 * get no icon.
 */
const METRIC_ICONS = new Set<string>([
  "abyssal_sire", "agility", "alchemical_hydra", "amoxliatl", "araxxor", "artio", "attack",
  "barrows_chests", "bryophyta", "callisto", "calvarion", "cerberus", "chambers_of_xeric",
  "chambers_of_xeric_challenge_mode", "chaos_elemental", "chaos_fanatic", "clue_scroll_all",
  "clue_scroll_beginner", "clue_scroll_easy", "clue_scroll_elite", "clue_scroll_hard",
  "clue_scroll_master", "clue_scroll_medium", "commander_zilyana", "construction", "cooking",
  "corporeal_beast", "crafting", "crazy_archaeologist", "dagannoth_prime", "dagannoth_rex",
  "dagannoth_supreme", "defence", "deranged_archaeologist", "duke_sucellus", "ehb", "ehp",
  "farming", "firemaking", "fishing", "fletching", "general_graardor", "giant_mole",
  "grotesque_guardians", "guardians_of_the_rift", "herblore", "hespori", "hitpoints", "hunter",
  "kalphite_queen", "king_black_dragon", "kraken", "kreearra", "kril_tsutsaroth", "lunar_chests",
  "magic", "mimic", "mining", "nex", "nightmare", "obor", "overall", "phantom_muspah",
  "phosanis_nightmare", "prayer", "ranged", "runecraft", "runecrafting", "sailing", "sarachnis",
  "scorpia", "scurrius", "skotizo", "slayer", "smithing", "sol_heredit", "spindel", "strength",
  "tempoross", "the_corrupted_gauntlet", "the_gauntlet", "the_hueycoatl", "the_leviathan",
  "the_royal_titans", "the_whisperer", "theatre_of_blood", "theatre_of_blood_hard_mode",
  "thermonuclear_smoke_devil", "thieving", "tombs_of_amascut", "tombs_of_amascut_expert",
  "tormented_demon", "tzkal_zuk", "tztok_jad", "vardorvis", "venenatis", "vetion", "vorkath",
  "wintertodt", "woodcutting", "zalcano", "zulrah"
]);

export function metricIconUrl(metric: string): string | null {
  return METRIC_ICONS.has(metric) ? `/img/metrics/${metric}.png` : null;
}
