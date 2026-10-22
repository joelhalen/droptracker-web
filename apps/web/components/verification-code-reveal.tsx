"use client";

/**
 * One-time display of a group's plugin verification code (web141a). Used by the
 * Roles & access panel and by the group setup wizard (site and Activity), so it
 * holds no server actions: the caller already has the code.
 *
 * Nothing can show the code again, so it stays on screen until the owner says
 * they saved it, and the browser asks before the tab is closed.
 */
import { useEffect, useState } from "react";
import { Alert, Button } from "@/components/ui";

export function VerificationCodeReveal({
  code,
  onDone,
}: {
  code: string;
  onDone?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Closing the tab now loses the code for good; make the browser ask.
  useEffect(() => {
    if (saved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, permissions): the code is on
      // screen to copy by hand.
    }
  };

  return (
    <div className="border-osrs-gold/50 bg-osrs-gold/5 space-y-3 rounded border p-4">
      <div className="text-sm font-semibold">Your plugin verification code</div>
      <div className="flex flex-wrap items-center gap-3">
        <code
          className="bg-osrs-surface-2 border-osrs-bronze/40 rounded border px-4 py-2 font-mono text-2xl tracking-widest select-all"
          aria-label="Verification code"
        >
          {code}
        </code>
        <Button variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Alert variant="info">
        This is the only time you will see this code. Save it somewhere safe, like a password
        manager. Share it only with admins you trust to manage the group from the plugin.
      </Alert>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I&apos;ve saved this code
      </label>
      {onDone && (
        <Button variant="primary" onClick={onDone} disabled={!saved}>
          Done
        </Button>
      )}
    </div>
  );
}

