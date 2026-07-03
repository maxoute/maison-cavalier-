"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";

function residentFromForm(formData: FormData) {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };
  return {
    full_name: str("full_name") ?? "",
    email: str("email"),
    phone: str("phone"),
    floor: str("floor"),
    unit: str("unit"),
    owner_status: (str("owner_status") ?? "proprietaire") as
      | "proprietaire"
      | "locataire",
    preferences: str("preferences"),
    special_access: str("special_access"),
    internal_notes: str("internal_notes"),
  };
}

export async function createResident(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  // La RLS revérifie côté base que le staff écrit bien dans son immeuble
  const { data, error } = await supabase
    .from("residents")
    .insert({ ...residentFromForm(formData), building_id: session.buildingId })
    .select("id")
    .single();

  if (error) throw new Error(`Création impossible : ${error.message}`);
  revalidatePath("/concierge/residents");
  redirect(`/concierge/residents/${data.id}`);
}

export async function updateResident(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("residents")
    .update(residentFromForm(formData))
    .eq("id", id);

  if (error) throw new Error(`Mise à jour impossible : ${error.message}`);
  revalidatePath(`/concierge/residents/${id}`);
  revalidatePath("/concierge/residents");
  redirect(`/concierge/residents/${id}`);
}

export async function deleteResident(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("residents").delete().eq("id", id);
  if (error) throw new Error(`Suppression impossible : ${error.message}`);
  revalidatePath("/concierge/residents");
  redirect("/concierge/residents");
}

/**
 * Import en masse (PRD §6.3.3) — CSV avec en-têtes :
 * full_name,email,phone,floor,unit,owner_status
 */
export async function importResidentsCsv(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Fichier manquant.");
  const text = await file.text();

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("CSV vide.");

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  if (idx("full_name") === -1)
    throw new Error("Colonne obligatoire manquante : full_name");

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 && cols[i] !== "" ? cols[i] : null;
    };
    return {
      building_id: session.buildingId,
      full_name: get("full_name") ?? "",
      email: get("email"),
      phone: get("phone"),
      floor: get("floor"),
      unit: get("unit"),
      owner_status:
        get("owner_status") === "locataire" ? "locataire" : "proprietaire",
    };
  });

  const supabase = await createClient();
  const { error } = await supabase.from("residents").insert(rows);
  if (error) throw new Error(`Import impossible : ${error.message}`);

  revalidatePath("/concierge/residents");
  redirect("/concierge/residents");
}
