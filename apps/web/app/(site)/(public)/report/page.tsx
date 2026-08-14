"use client";

/**
 * Anonymous abuse-report form for tenant mini-sites (sites-v1). Lives on the
 * MAIN domain on purpose: the reported site's own CSS/HTML can never touch
 * this page. Reports land in the admin audit log (site.report_received).
 */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Button, Card, Input, Textarea } from "@/components/ui";

export default function ReportSiteForm() {
  const params = useSearchParams();
  const [site, setSite] = useState(params.get("site") ?? "");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    setState("busy");
    setError("");
    try {
      const res = await fetch("/api/report-site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site, reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Request failed (${res.status})`);
      }
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <Card className="mx-auto max-w-lg">
        <h1 className="text-osrs-gold mb-2 text-xl font-bold">Report received</h1>
        <p className="text-osrs-parchment-dark/80">
          Thanks — the DropTracker team reviews every report. Sites that violate the
          hosted-content terms are suspended.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <h1 className="text-osrs-gold mb-2 text-xl font-bold">Report a clan site</h1>
      <p className="text-osrs-parchment-dark/80 mb-4 text-sm">
        Use this form to report a site hosted on our clan-sites domain for impersonation,
        scams, credential harvesting or other rule-breaking content.
      </p>
      {state === "error" && <Alert variant="error">{error}</Alert>}
      <label className="mb-3 block text-sm">
        <span className="text-osrs-parchment-dark/80 mb-1 block">Site address (subdomain)</span>
        <Input
          value={site}
          onChange={(e) => setSite(e.target.value)}
          placeholder="the-clan-site"
        />
      </label>
      <label className="mb-4 block text-sm">
        <span className="text-osrs-parchment-dark/80 mb-1 block">What&apos;s wrong?</span>
        <Textarea
          className="min-h-28"
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <Button
        variant="secondary"
        disabled={state === "busy" || !reason.trim()}
        onClick={submit}
      >
        {state === "busy" ? "Sending…" : "Send report"}
      </Button>
    </Card>
  );
}
