"use client";
/**
 * The page builder's preview frames carry this window name (web137a), so
 * site-wide chrome that has nothing to do with the page being designed (the
 * pop-up notices, the support chat) can stay out of the preview. Those
 * widgets also run Server Actions, which Next executes one at a time per
 * page; keeping them out of the frame keeps the preview light.
 */
import { useSyncExternalStore } from "react";

export const PREVIEW_FRAME_NAME = "dt-page-preview";

export function inBuilderPreview(): boolean {
  return typeof window !== "undefined" && window.name === PREVIEW_FRAME_NAME;
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration, then the real answer. */
export function useInBuilderPreview(): boolean {
  return useSyncExternalStore(noopSubscribe, inBuilderPreview, () => false);
}
