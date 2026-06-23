import base from "@droptracker/config/eslint/base.mjs";

export default [
  ...base,
  {
    rules: {
      // Next.js handles React import; relax a few rules for app code.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
