import base from "@droptracker/config/eslint/base.mjs";

export default [
  // Next.js generates these; not ours to lint.
  { ignores: ["next-env.d.ts", ".next/**"] },
  ...base,
  {
    rules: {
      // Next.js handles React import; relax a few rules for app code.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
