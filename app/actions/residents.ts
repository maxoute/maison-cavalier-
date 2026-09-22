"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { staffContext, check } from "@/lib/operations/server";
import type { ActionResult } from "@/lib/operations/shared";

function residentFromForm(formData: FormData) {
  const str = (k: string, max = 2000) => {
    const v = formData.get(k);
    const text = typeof v === "string" ? v.trim() : "";
    if (text.length > max) throw new Error(`Le champ ${k} est trop long.`);
    return text !== "" ? text : null;
  };
  const fullName = str("full_name", 200);
  if (!fullName) throw new Error("Le nom complet est obligatoire.");
  const email = str("email", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse email invalide.");
  return {
    full_name: fullName,
    email,
    phone: str("phone", 40),
    floor: str("floor", 20),
    unit: str("unit", 20),
    owner_status: (str("owner_status") === "locataire" ? "locataire" : "proprietaire") as "proprietaire" | "locataire",
    preferences: str("preferences"),
    special_access: str("special_access"),
    internal_notes: str("internal_notes", 4000),
  };
}

function message(error: unknown, fallback: string) {
  return { error: error instanceof Error ? error.message : fallback };
}

function refresh(id?: string) {
  // Les sélecteurs de résident vivent sur tout le portail concierge.
  revalidatePath("/concierge", "layout");
  if (id) revalidatePath(`/concierge/residents/${id}`);
}

export async function createResident(_: ActionResult, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const { db, session } = await staffContext();
    // La RLS revérifie côté base que le staff écrit bien dans son immeuble.
    const { data, error } = await db
      .from("residents")
      .insert({ ...residentFromForm(formData), building_id: session.buildingId })
      .select("id")
      .single();
    check(error);
    if (!data) throw new Error("Création impossible.");
    id = data.id;
    refresh();
  } catch (error) {
    return message(error, "Création impossible.");
  }
  redirect(`/concierge/residents/${id}`);
}

export async function updateResident(id: string, _: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const { data, error } = await db
      .from("residents")
      .update(residentFromForm(formData))
      .eq("id", id)
      .eq("building_id", session.buildingId)
      .select("id");
    check(error);
    if (!data?.length) throw new Error("Fiche introuvable ou modification refusée.");
    refresh(id);
    return { success: "Fiche mise à jour." };
  } catch (error) {
    return message(error, "Mise à jour impossible.");
  }
}

export async function deleteResident(id: string): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const { data, error } = await db
      .from("residents")
      .delete()
      .eq("id", id)
      .eq("building_id", session.buildingId)
      .select("id");
    if (error?.code === "23503") {
      throw new Error("Ce résident possède un historique (demandes, devis, colis…) : la fiche est conservée. Vous pouvez la mettre à jour ou noter son départ dans les notes internes.");
    }
    check(error);
    if (!data?.length) throw new Error("Fiche introuvable ou suppression refusée.");
    refresh(id);
  } catch (error) {
    return message(error, "Suppression impossible.");
  }
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
 * Accepte les séparateurs `,` `;` (export Excel FR) et tabulation, le BOM
 * UTF-8 et les champs entre guillemets contenant des virgules.
 */
export async function importResidentsCsv(_: ActionResult, formData: FormData): Promise<ActionResult> {
  let imported = 0;
  try {
    const { db, session } = await staffContext();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Sélectionnez un fichier CSV.");
    if (file.size > 2_000_000) throw new Error("Fichier trop volumineux (2 Mo maximum).");
    // Excel préfixe ses exports UTF-8 d'un BOM : sans ce retrait, la première
    // en-tête devient "﻿full_name" et la colonne est jugée manquante.
    const text = (await file.text()).replace(/^﻿/, "");

    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";

    const table = parseCsv(text, delimiter);
    if (table.length < 2) throw new Error("Le fichier ne contient aucune ligne de données.");

    const headers = table[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);
    if (idx("full_name") === -1) throw new Error("Colonne obligatoire manquante : full_name.");

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
          owner_status: get("owner_status")?.toLowerCase() === "locataire" ? "locataire" : "proprietaire",
        };
      })
      // Une ligne sans nom créerait une fiche vide et non identifiable
      .filter((r): r is typeof r & { full_name: string } => r.full_name !== null);

    if (rows.length === 0) throw new Error("Aucune ligne exploitable : la colonne full_name est vide.");
    if (rows.length > 2000) throw new Error("Import limité à 2 000 résidents par fichier.");

    const { error } = await db.from("residents").insert(rows);
    check(error);
    imported = rows.length;
    refresh();
  } catch (error) {
    return message(error, "Import impossible.");
  }
  redirect(`/concierge/residents?import=${imported}`);
}
