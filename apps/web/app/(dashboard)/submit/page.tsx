import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { SubmitForm } from "@/components/submit-form";

export const metadata: Metadata = { title: "Submit a drop" };

export default async function SubmitPage() {
  const user = (await getUser())!;

  return (
    <div>
      <h1 className="text-osrs-gold mb-6 text-2xl font-bold">Submit a drop</h1>
      <SubmitForm players={user.players} />
    </div>
  );
}
