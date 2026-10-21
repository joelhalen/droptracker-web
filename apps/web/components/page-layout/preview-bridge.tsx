"use client";

/**
 * Runs inside the page builder's preview iframe (web137a). The preview is
 * the REAL page, server-rendered from the saved draft, so what the editor
 * sees is what visitors get. This bridge makes it interactive:
 *
 *   builder → frame  {type: "dt-pl-select", id}   highlight + scroll to a block
 *                    {type: "dt-pl-reload"}       re-render in place (unused by the
 *                                                 builder, which double-buffers frames)
 *   frame → builder  {type: "dt-pl-click", id}    a block was clicked
 *                    {type: "dt-pl-ready"}        hydrated: safe to swap this frame in
 *
 * Links inside the frame never navigate (a stray click would leave the
 * preview), and messages are only accepted from our own origin.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function PreviewBridge() {
  const router = useRouter();
  const selected = useRef<string | null>(null);

  useEffect(() => {
    const parentWin = window.parent;
    if (!parentWin || parentWin === window) return;
    const post = (msg: Record<string, unknown>) => parentWin.postMessage(msg, window.location.origin);

    const mark = (id: string | null, scroll: boolean) => {
      document.querySelectorAll("[data-block-id][data-selected]").forEach((el) => el.removeAttribute("data-selected"));
      selected.current = id;
      if (!id) return;
      const el = document.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
      if (!el) return;
      el.setAttribute("data-selected", "");
      if (scroll) {
        const r = el.getBoundingClientRect();
        if (r.top < 60 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== parentWin) return;
      const data = e.data as { type?: string; id?: string | null };
      if (data?.type === "dt-pl-select") mark(data.id ?? null, true);
      if (data?.type === "dt-pl-reload") router.refresh();
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest("a")) e.preventDefault();
      const block = target?.closest("[data-block-id]");
      if (block) {
        e.preventDefault();
        e.stopPropagation();
        const id = block.getAttribute("data-block-id");
        mark(id, false);
        post({ type: "dt-pl-click", id });
      } else if (target?.closest("[data-pl-preview]")) {
        mark(null, false);
        post({ type: "dt-pl-click", id: null });
      }
    };

    // Keep the highlight across server re-renders.
    const observer = new MutationObserver(() => {
      if (selected.current && !document.querySelector("[data-block-id][data-selected]")) {
        mark(selected.current, false);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    post({ type: "dt-pl-ready" });
    return () => {
      observer.disconnect();
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);

  return null;
}
