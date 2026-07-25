import base from "@droptracker/config/eslint/base.mjs";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  // Next.js generates these; not ours to lint. .next-blue/.next-green are the
  // blue-green deploy output dirs (scripts/deploy.sh); .next-verify is the
  // throwaway dir for verification builds (NEXT_DIST_DIR=.next-verify) that must
  // not clobber .next or a live colour. Any new NEXT_DIST_DIR value needs an
  // entry here, or ~2.4k errors from generated types turn `pnpm lint` red.
  {
    ignores: [
      "next-env.d.ts",
      ".next/**",
      ".next-blue/**",
      ".next-green/**",
      ".next-verify/**",
    ],
  },
  ...base,
  {
    // React Hooks rules — the plugin the config previously OMITTED. Because the
    // rule was undefined, `eslint .` silently ignored every
    // `// eslint-disable react-hooks/exhaustive-deps` while `next build`'s
    // ESLint hard-errored on the same directive ("Definition for rule ... not
    // found") — the recurring green-lint / red-build split. Registering it
    // makes those directives valid AND actually enforces the rules in the one
    // lint gate. exhaustive-deps stays a WARN (Next's default) so existing,
    // intentional dep omissions don't turn into hard lint failures.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Next.js handles React import; relax a few rules for app code.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
