"use client";

/**
 * "Members' death messages" — the bottom of the Deaths section of group
 * settings. Leaders see every member's own death messages exactly as written
 * and can block a member, which keeps that member's lines out of this group's
 * channels (the member's other clans are unaffected, and the group's own death
 * messages go out for them instead).
 *
 * Moderation, not editing: a leader cannot change what a member wrote. Blocks
 * work whether or not the group has the feature switched on, so a leader can
 * deal with someone before opening it up.
 */
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import type { GroupMemberDeathMessage, GroupMemberDeathMessages } from "@droptracker/api-types";
import { setMemberDeathMessageBlock } from "@/app/(site)/(admin)/groups/[id]/settings/actions";
import { formatInline } from "@/components/components-v2-preview";
import { SettingsSubheading } from "@/components/settings-section";
import { Alert, Badge, Button } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";

export function MemberDeathMessagesReview({
  groupId,
  initial,
}: {
  groupId: number;
  initial: GroupMemberDeathMessages;
}) {
  const [data, setData] = useState(initial);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setBlocked = async (member: GroupMemberDeathMessage, blocked: boolean) => {
    setError(null);
    setPendingId(member.id);
    try {
      setData(await setMemberDeathMessageBlock(groupId, member.id, blocked));
    } catch (err) {
      setError(
        getErrorMessage(err, `Couldn't ${blocked ? "block" : "unblock"} ${member.name}. Please try again.`),
      );
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div>
      <SettingsSubheading hint="What each member wrote, exactly as they wrote it. Blocking a member keeps their own messages out of this group's channels; your death messages are used for them instead.">
        Members&apos; death messages
      </SettingsSubheading>

      {!data.enabled && (
        <p className="text-osrs-parchment-dark/70 mb-3 text-xs">
          Not posted right now: turn on <em>Let members write their own death message</em> above
          and save to start using them. You can review and block members either way.
        </p>
      )}

      {data.members.length === 0 ? (
        <p className="text-osrs-parchment-dark/60 text-xs italic">
          None of your members has written a death message yet.
        </p>
      ) : (
        <ul className="border-osrs-bronze/20 divide-osrs-bronze/15 max-h-[28rem] divide-y overflow-y-auto rounded border">
          {data.members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/players/${member.id}` as Route}
                    className="text-osrs-parchment text-sm font-medium hover:underline"
                  >
                    {member.name}
                  </Link>
                  {member.blocked && (
                    <Badge variant="red" size="sm">
                      Blocked{member.blocked_at ? ` ${member.blocked_at.slice(0, 10)}` : ""}
                    </Badge>
                  )}
                  {member.updated_at && (
                    <span className="text-osrs-parchment-dark/50 text-[11px]">
                      edited {member.updated_at.slice(0, 10)}
                    </span>
                  )}
                </div>
                {member.messages.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {member.messages.map((message, i) => (
                      <li key={i} className="text-osrs-parchment-dark/90 text-sm break-words">
                        {formatInline(message, `mdr-${member.id}-${i}`)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-osrs-parchment-dark/60 mt-1 text-xs italic">
                    No messages written at the moment.
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="xs"
                variant={member.blocked ? "secondary" : "danger"}
                disabled={pendingId !== null}
                onClick={() => setBlocked(member, !member.blocked)}
              >
                {pendingId === member.id ? "Saving…" : member.blocked ? "Unblock" : "Block"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}
    </div>
  );
}
