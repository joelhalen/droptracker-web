/**
 * Shared access-denied surface (web57a). One presentational card for every
 * "you can't see this" state — replacing the old behavior of silent
 * redirect-home (role failures) or a bare 404 (restricted resources).
 *
 * Server- and client-safe: pure markup, no hooks. Pages render it inline for
 * resource-level denials (private events, tickets); the (site)
 * unauthorized.tsx / forbidden.tsx interrupt boundaries wrap it for
 * role-gated subtrees.
 */
import Link from "next/link";
import type { Route } from "next";
import { FaDiscord } from "react-icons/fa6";

/** Sign-in button that returns to `returnTo` after the Discord OAuth dance.
 *  `prefetch={false}`: /api/auth/login is a mutating GET (it issues the OAuth
 *  state cookie), so it must not be fired by Link prefetch. */
export function SignInButton({
  returnTo,
  label = "Sign in with Discord",
  className = "",
}: {
  returnTo: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={`/api/auth/login?redirect=${encodeURIComponent(returnTo)}` as Route}
      prefetch={false}
      className={`bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${className}`}
    >
      <FaDiscord className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

export function AccessDenied({
  icon = "🔒",
  title,
  message,
  /** When set, renders a Discord sign-in button that round-trips back here. */
  signInReturnTo,
  /** Secondary link under the message (e.g. back to the public group page). */
  back,
  children,
}: {
  icon?: string;
  title: string;
  message: string;
  signInReturnTo?: string;
  back?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="text-4xl" aria-hidden>
        {icon}
      </div>
      <h1 className="text-osrs-gold mt-4 text-2xl font-bold">{title}</h1>
      <p className="text-osrs-parchment-dark/80 mt-3 text-sm leading-relaxed">{message}</p>
      {children}
      <div className="mt-6 flex flex-col items-center gap-3">
        {signInReturnTo && <SignInButton returnTo={signInReturnTo} />}
        <Link
          href={(back?.href ?? "/") as Route}
          className="text-osrs-gold-bright text-sm hover:underline"
        >
          ← {back?.label ?? "Back to leaderboards"}
        </Link>
      </div>
    </div>
  );
}
