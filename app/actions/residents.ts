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
 * Découpe un CSV en lignes/colonnes (RFC 4180) : guillemets, séparateurs et
 * retours à la ligne échappés à l'intérieur d'un champ sont respectés.
 */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"' && field.trim() === "") {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  row.push(field.trim());
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

/**
 * Import en masse (PRD §6.3.3) — CSV avec en-têtes :
 * full_name,email,phone,floor,unit,owner_status
 * Accepte le séparateur `;` (export Excel FR), le BOM UTF-8 et les champs
 * entre guillemets contenant des virgules.
 */
export async function importResidentsCsv(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Fichier manquant.");
  // Excel préfixe ses exports UTF-8 d'un BOM : sans ce retrait, la première
  // en-tête devient "\ufefffull_name" et la colonne est jugée manquante.
  const text = (await file.text()).replace(/^\ufeff/, "");

  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";")
    ? ";"
    : firstLine.includes("\t")
      ? "\t"
      : ",";

  const table = parseCsv(text, delimiter);
  if (table.length < 2) throw new Error("CSV vide.");

  const headers = table[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  if (idx("full_name") === -1)
    throw new Error("Colonne obligatoire manquante : full_name");

  const rows = table
    .slice(1)
    .map((cols) => {
      const get = (name: string) => {
        const i = idx(name);
        const v = i >= 0 ? cols[i] : undefined;
        return v != null && v !== "" ? v : null;
      };
      return {
        building_id: session.buildingId,
        full_name: get("full_name"),
        email: get("email"),
        phone: get("phone"),
        floor: get("floor"),
        unit: get("unit"),
        owner_status:
          get("owner_status")?.toLowerCase() === "locataire"
            ? "locataire"
            : "proprietaire",
      };
    })
    // Une ligne sans nom créerait une fiche vide et non identifiable
    .filter((r): r is typeof r & { full_name: string } => r.full_name !== null);

  if (rows.length === 0)
    throw new Error("Aucune ligne exploitable : la colonne full_name est vide.");

  const supabase = await createClient();
  const { error } = await supabase.from("residents").insert(rows);
  if (error) throw new Error(`Import impossible : ${error.message}`);

  revalidatePath("/concierge/residents");
  redirect("/concierge/residents");
}
