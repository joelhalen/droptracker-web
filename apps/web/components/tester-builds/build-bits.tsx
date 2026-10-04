/**
 * Small pieces shared by the test-build surfaces (the tester page and the
 * staff view): a timestamp that never renders a blank, and a commit hash that
 * links to GitHub when the repository is one we can link to.
 */
import { LocalTime } from "@/components/local-time";
import { commitUrl } from "@/lib/tester-builds";

/** A timestamp in the viewer's timezone, or a word when there is none. */
export function When({
  unix,
  mode = "datetime",
  empty = "Unknown",
}: {
  unix: number | null | undefined;
  mode?: "date" | "datetime";
  empty?: string;
}) {
  if (unix == null) return <span>{empty}</span>;
  return <LocalTime unix={unix} mode={mode} />;
}

/** Short commit hash, linked to the commit on GitHub when possible. Renders
 *  nothing for a commit the API could not read (it sends "" for those). */
export function CommitLink({
  repoUrl,
  commit,
  short,
}: {
  repoUrl: string | null | undefined;
  commit: string;
  short?: string | null;
}) {
  const text = short || commit.slice(0, 7);
  if (!text) return null;
  const href = commitUrl(repoUrl, commit);
  const label = <code className="font-mono text-[0.85em]">{text}</code>;
  if (!href) return label;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-osrs-gold-bright hover:underline"
    >
      {label}
    </a>
  );
}
