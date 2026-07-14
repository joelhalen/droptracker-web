import { ActivityApp } from "@/components/activity/activity-app";

/*
 * The whole surface is client-rendered: event context (guild, channel) only
 * exists once the Embedded App SDK handshake completes inside Discord's
 * iframe, and Discord's proxy strips cache headers on HTML anyway — there is
 * nothing useful to render ahead of time.
 */
export default function ActivityPage() {
  return <ActivityApp />;
}
