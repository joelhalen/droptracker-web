import type { Metadata } from "next";
import { DiscordSender } from "@/components/discord-sender";

export const metadata: Metadata = { title: "Discord sender" };

export default function AdminDiscordPage() {
  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Send a message to any Discord channel through the bot. Use sparingly.
      </p>
      <DiscordSender />
    </div>
  );
}
