"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QuoteStatus } from "@/types";

export async function updateQuoteStatus(id: string, status: QuoteStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
  if (error) throw new Error(`Mise à jour du devis impossible : ${error.message}`);
  revalidatePath("/concierge/devis");
}
