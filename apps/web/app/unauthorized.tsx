"use client";

/**
 * Root 401 boundary. Interrupts thrown from LAYOUTS (e.g. requireSuperadmin
 * in admin/layout.tsx) bubble past nested boundaries to the root — same
 * catching rule as not-found — so the root must render the real component;
 * without this file Next serves its default bare "401" page. The (site) copy
 * still catches page-level throws with the site chrome.
 */
export { default } from "./(site)/unauthorized";
