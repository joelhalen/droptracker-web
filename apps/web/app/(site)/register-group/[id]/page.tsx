import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { buttonVariants } from "@/components/ui";

/**
 * The end of registering a group from the RuneLite plugin.
 *
 * The plugin opened the Discord sign-in with the bot added; Discord sends the
 * leader back here, signed in, with the server the bot was added to in
 * `?guild=`. This page asks the Web API to create the group there (it checks
 * the leader manages that server) and tells them to head back to the game,
 * where the plugin has been waiting and opens the group manager.
 *
 * Outside (dashboard) for the same reason /bug-testing is: a signed-out
 * visitor must come back from sign-in here, not on the dashboard.
 */
export const metadata: Metadata = {
  title: "Register your group",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ guild?: string }> };

export default async function RegisterGroupPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { guild } = await searchParams;
  const here = `/register-group/${encodeURIComponent(id)}`;
  const retry = `/api/auth/login?bot=1&redirect=${encodeURIComponent(here)}`;

  if (!(await getUser())) redirect(retry as Route);

  let preview;
  try {
    preview = await api.pluginRegistration(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return (
        <AccessDenied
          icon="⌛"
          title="This link has expired"
          message="Registration links last 30 minutes. Start again from the DropTracker panel in RuneLite."
          back={{ href: "/", label: "Back to the homepage" }}
        />
      );
    }
    throw err;
  }

  if (preview.status === "done" && preview.group_id != null) {
    return <Registered groupId={preview.group_id} name={preview.name} code={null} />;
  }
  if (!guild) {
    return (
      <AccessDenied
        icon="🤖"
        title="Pick your clan's server"
        message={`To register ${preview.name}, add the DropTracker bot to your clan's Discord server.`}
        back={{ href: "/", label: "Back to the homepage" }}
      >
        <div className="mt-5">
          <a href={retry} className={buttonVariants({ variant: "primary", className: "rounded-lg" })}>
            Add the bot
          </a>
        </div>
      </AccessDenied>
    );
  }

  try {
    const done = await api.completePluginRegistration(id, guild);
    return <Registered groupId={done.group_id} name={done.group_name} code={done.verification_code} />;
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) {
      return (
        <AccessDenied
          icon="⚠️"
          title={`${preview.name} wasn't registered`}
          message={err.message}
          back={{ href: "/", label: "Back to the homepage" }}
        >
          <div className="mt-5">
            <a href={retry} className={buttonVariants({ variant: "secondary", className: "rounded-lg" })}>
              Pick another server
            </a>
          </div>
        </AccessDenied>
      );
    }
    throw err;
  }
}

function Registered({ groupId, name, code }: { groupId: number; name: string; code: string | null }) {
  return (
    <AccessDenied
      icon="🎉"
      title={`${name} is on the DropTracker`}
      message="Head back to RuneLite. The group manager opens there, ready for you to set up your channels."
      back={{ href: `/groups/${groupId}`, label: "Open your group page" }}
    >
      {code && (
        <div className="border-osrs-bronze/40 bg-osrs-brown-dark/60 mt-6 rounded-lg border p-4 text-left">
          <p className="text-osrs-parchment-dark/80 text-sm">Your group&apos;s verification code:</p>
          <p className="text-osrs-gold-bright mt-1 font-mono text-2xl tracking-widest">{code}</p>
          <p className="text-osrs-parchment-dark/70 mt-2 text-xs leading-relaxed">
            Your admins enter it in RuneLite to manage the group from the game. Keep it within your
            leadership team. You can see it again under Roles &amp; access.
          </p>
        </div>
      )}
      <div className="mt-5">
        <Link
          href={`/groups/${groupId}/settings` as Route}
          className={buttonVariants({ variant: "secondary", className: "rounded-lg" })}
        >
          Settings on the website
        </Link>
      </div>
    </AccessDenied>
  );
}
