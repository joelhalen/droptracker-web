/**
 * How to start the test build. Kept short on purpose: the README inside the
 * zip is the full version and ships with the build it describes, so it cannot
 * go stale the way a copy here would.
 */
const LAUNCHERS = [
  { system: "Windows", file: "run-droptracker-dev.bat" },
  { system: "macOS", file: "run-droptracker-dev.command" },
  { system: "Linux", file: "run-droptracker-dev.sh" },
] as const;

const JAGEX_ACCOUNTS_URL = "https://github.com/runelite/runelite/wiki/Using-Jagex-Accounts";

export function HowToRun() {
  return (
    <ol className="text-osrs-parchment-dark/90 list-decimal space-y-2 pl-5 text-sm">
      <li>Unzip the download.</li>
      <li>
        Run the launcher for your system.
        <ul className="mt-1 space-y-0.5">
          {LAUNCHERS.map((launcher) => (
            <li key={launcher.system}>
              <span className="text-osrs-parchment-dark/60">{launcher.system}:</span>{" "}
              <code className="font-mono text-[0.85em]">{launcher.file}</code>
            </li>
          ))}
        </ul>
      </li>
      <li>
        On a Jagex account? Do RuneLite&apos;s one-time setup first:{" "}
        <a
          href={JAGEX_ACCOUNTS_URL}
          target="_blank"
          rel="noreferrer"
          className="text-osrs-gold-bright hover:underline"
        >
          Using Jagex Accounts
        </a>
        . The launcher also asks about this the first time you run it.
      </li>
      <li>
        It uses your normal RuneLite profile and Plugin Hub plugins. The README in the zip has the
        details.
      </li>
    </ol>
  );
}
