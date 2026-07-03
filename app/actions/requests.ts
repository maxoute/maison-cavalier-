"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/types";

export async function updateRequestStatus(id: string, status: RequestStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_requests")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`Mise à jour impossible : ${error.message}`);
  revalidatePath("/concierge");
  revalidatePath("/concierge/interventions");
}
