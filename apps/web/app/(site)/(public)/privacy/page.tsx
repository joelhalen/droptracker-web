import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { ScrollPanel } from "@/components/scroll-panel";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How DropTracker collects, uses, and protects your data — Discord account details, gameplay submissions, and message content.",
};

// Legal text lives in the repo (not the docs CMS) so changes are code-reviewed
// and the URL is stable for Discord's developer-application requirements.
const POLICY = `
# Privacy Policy

**Effective date: 11 August 2026**

DropTracker ("we", "us") is a loot- and achievement-tracking service for Old
School RuneScape, consisting of a RuneLite plugin, a Discord bot and
application, and the website at [droptracker.io](https://www.droptracker.io).
This policy explains what data we collect, why we collect it, and the choices
you have. It applies to all DropTracker surfaces: the website, the Discord
bot, the Discord Activity, and the RuneLite plugin.

DropTracker is a third-party tool and is not affiliated with Jagex Ltd or
Discord Inc.

## Data we collect

### Discord account data

When you sign in on the website or use the Discord Activity, we receive your
Discord user ID, username, and avatar through Discord's OAuth flow. We use
this to create and identify your DropTracker account. We never see your
Discord password.

For Discord servers that install the DropTracker bot, we store the server
(guild) ID, and the channel, role, and webhook configuration that server
admins set up for DropTracker features (for example, which channel receives
drop notifications).

### Gameplay data from the RuneLite plugin

If you install the DropTracker RuneLite plugin, it submits gameplay events
from your Old School RuneScape account to our servers: your character name
(RSN), an account identifier provided by the game client, and events such as
drops received, personal best boss times, collection log entries, combat
achievements, level-ups, quest completions, pets, and deaths, together with
timestamps and estimated item values.

The plugin can also submit screenshots of these moments when you enable that
option; screenshots are stored on our content delivery infrastructure so they
can be shown alongside your submissions.

You control what the plugin sends through its configuration panel, and you
can stop all collection at any time by disabling or uninstalling the plugin.

### Message content on Discord

The DropTracker bot requests Discord's **message content** privileged intent
solely to power features that need to read messages in specific, admin-configured
channels:

- **Clan chat bridge** — group admins can enable a two-way sync between their
  in-game clan chat and one designated Discord channel. In-game chat lines
  are mirrored into that channel, and messages members post in that channel
  are relayed to clan members' game clients. Relayed chat is held only
  transiently in a delivery queue and is not kept as a long-term record.
- **Clan broadcasts** — in-game system broadcasts (drops, pets, level-ups)
  mirrored through the bridge may be parsed so achievements by clanmates who
  don't run the plugin can still be credited to your group.
- **Support tickets** — messages written inside DropTracker ticket channels
  are stored as transcripts so you and group staff can review past support
  conversations.

Outside of these admin-configured channels, we do not read, store, or process
the content of Discord messages. We do not use message content for
advertising, profiling, or training machine-learning models, and we do not
sell it to anyone.

### Payments

Group upgrades and supporter subscriptions are processed by Stripe or PayPal.
Card and bank details go directly to the payment processor — we never receive
or store them. We keep records of your subscription status, tier, and payment
history (amounts and dates) to operate billing.

### Technical data

Like most websites, we use a session cookie (\`dt_session\`) to keep you
signed in — we do not use advertising or cross-site tracking cookies. Our
servers and our CDN provider keep standard request logs (IP address, user
agent, pages requested) for security and abuse prevention, and we collect
error reports so we can fix crashes and bugs.

## How we use your data

- Operate the service: leaderboards, loot boards, player and group profiles,
  events and competitions, personal-best records, and Discord notifications.
- Deliver features your group enables, such as the clan chat bridge, drop
  notification channels, and event boards.
- Provide support through the ticket system.
- Prevent abuse: detecting spoofed or fraudulent submissions, rate limiting,
  and moderation.
- Process payments for optional paid features.

We do not sell your data, and we do not use it for third-party advertising.

## What is public

DropTracker is a leaderboard service, so gameplay data tied to your RSN —
drops, personal bests, achievements, group membership, and submitted
screenshots — is displayed publicly on the website, in Discord embeds posted
by the bot, and in group loot boards. Your player settings include visibility
controls for parts of your profile. Your Discord account details are not
displayed publicly beyond your username where you have linked it to a claimed
RSN or interacted with public features (for example, suggestions).

## Third-party services

We share data with service providers only as needed to run DropTracker:

- **Discord** — bot, OAuth sign-in, and the embedded Activity.
- **Cloudflare** — CDN, caching, and DDoS protection in front of the website.
- **Backblaze B2** — storage for screenshots and generated images.
- **Stripe and PayPal** — payment processing.
- **Wise Old Man ([wiseoldman.net](https://wiseoldman.net))** — we exchange
  RSNs with this public OSRS progress-tracking service to enrich experience
  and boss-kill data for events and recaps.
- **Sentry** — error reporting.

Each provider processes data under its own privacy policy.

## Data retention

Gameplay records power historical leaderboards and are retained while the
service operates. Relayed clan chat is transient and not retained as a
long-term record. Server logs and error reports are kept for short operational
windows. If a Discord server removes the bot, its configuration becomes
inactive; ticket transcripts are retained so past support history stays
available to the people involved.

## Your choices and rights

- **Plugin** — configure or disable data collection at any time from the
  plugin's settings; uninstalling stops all submissions.
- **Account** — you can unlink claimed RSNs from your Discord account in your
  settings.
- **Group features** — the clan chat bridge and notification features are
  opt-in per group and can be disabled by group admins at any time.
- **Access, correction, and deletion** — you can ask us for a copy of the
  data we hold about you, ask us to correct it, or ask us to delete your
  account data (including gameplay submissions and screenshots). We will
  action deletion requests within 30 days.

To exercise any of these rights, open a ticket or contact the team in our
Discord server: [droptracker.io/discord](https://www.droptracker.io/discord).

## Security

Data is transmitted over HTTPS and stored on access-controlled servers.
Payment credentials never touch our infrastructure. No online service can
guarantee perfect security, but we take reasonable technical measures to
protect the data we hold and we limit staff access to what operating the
service requires.

## Children

DropTracker is not directed at children under 13 (or the minimum age of
digital consent in your country), consistent with Discord's own Terms of
Service. We do not knowingly collect data from children below that age; if
you believe we have, contact us and we will delete it.

## Changes to this policy

We may update this policy as the service evolves. Material changes will be
announced on the website or in our Discord server, and the effective date at
the top will always reflect the latest revision.

## Contact

Questions about this policy or your data: join our Discord server at
[droptracker.io/discord](https://www.droptracker.io/discord) and open a
ticket, or use the support ticket system on the website.
`;

export default function PrivacyPage() {
  return (
    <ScrollPanel>
      <Markdown tone="ink">{POLICY}</Markdown>
    </ScrollPanel>
  );
}
