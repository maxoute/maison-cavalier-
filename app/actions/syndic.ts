"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";

export async function sendSyndicMessage(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const body = formData.get("body");
  if (typeof body !== "string" || body.trim() === "") return;

  const supabase = await createClient();
  // La RLS limite l'insertion au staff et au syndic de l'immeuble
  const { error } = await supabase.from("syndic_messages").insert({
    building_id: session.buildingId,
    sender_profile_id: session.userId,
    body: body.trim(),
    is_incident: formData.get("is_incident") === "on",
  });
  if (error) throw new Error(`Envoi impossible : ${error.message}`);

  revalidatePath("/syndic");
  revalidatePath("/concierge/messagerie");
}
