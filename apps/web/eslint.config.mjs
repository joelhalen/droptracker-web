import base from "@droptracker/config/eslint/base.mjs";

export default [
  // Next.js generates these; not ours to lint. .next-blue/.next-green are the
  // blue-green deploy output dirs (scripts/deploy.sh).
  { ignores: ["next-env.d.ts", ".next/**", ".next-blue/**", ".next-green/**"] },
  ...base,
  {
    rules: {
      // Next.js handles React import; relax a few rules for app code.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
