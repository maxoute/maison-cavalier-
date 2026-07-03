/**
 * Contrat d'interface partagé avec les apps mobiles Résident & Chauffeur (PRD §8, Annexe B).
 * Toute modification ici doit rester compatible avec le schéma SQL (supabase/migrations).
 */

export type Role = "concierge" | "admin" | "super_admin" | "syndic" | "resident" | "chauffeur";

export type ServiceType =
  | "chauffeur"
  | "pressing"
  | "colis"
  | "billetterie"
  | "personal_shopper";

export type RequestStatus = "nouveau" | "en_cours" | "en_attente" | "termine";
export type RequestPriority = "normale" | "urgente";

export type QuoteStatus = "en_attente" | "envoye" | "accepte" | "refuse";

export type TripStatus =
  | "en_attente_chauffeur"
  | "acceptee"
  | "en_route"
  | "arrivee"
  | "terminee"
  | "annulee";

export type NotificationChannelType = "push" | "whatsapp" | "email" | "sms";

export type NotificationEvent =
  | "colis_recu"
  | "chauffeur_en_route"
  | "chauffeur_arrive"
  | "pressing_pret"
  | "rappel_colis_non_retire"
  | "offre_billetterie"
  | "annonce_urgente"
  | "confirmation_paiement";

export interface Building {
  id: string;
  name: string;
  address: string;
  b2b_plan: string | null;
  enabled_services: ServiceType[];
  created_at: string;
}

export interface Profile {
  id: string; // = auth.users.id
  building_id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  preferences: Record<string, unknown>;
  loyalty_points: number;
  created_at: string;
}

export interface Resident {
  id: string;
  building_id: string;
  profile_id: string | null; // lié quand le résident active l'app mobile
  full_name: string;
  email: string | null;
  phone: string | null;
  floor: string | null;
  unit: string | null;
  owner_status: "proprietaire" | "locataire";
  preferences: string | null;
  special_access: string | null;
  internal_notes: string | null;
  satisfaction_score: number | null;
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  building_id: string;
  resident_id: string;
  service: ServiceType;
  status: RequestStatus;
  priority: RequestPriority;
  payload: Record<string, unknown>;
  amount_cents: number | null;
  sla_deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverTrip {
  id: string;
  building_id: string;
  request_id: string;
  driver_profile_id: string | null;
  vehicle: string | null;
  status: TripStatus;
  origin: string | null;
  destination: string | null;
  last_lat: number | null;
  last_lng: number | null;
  eta: string | null;
  commission_cents: number | null;
  created_at: string;
}

export interface Quote {
  id: string;
  building_id: string;
  resident_id: string;
  request_id: string | null;
  provider: string;
  label: string;
  amount_cents: number;
  status: QuoteStatus;
  pdf_path: string | null;
  created_at: string;
}

export interface SyndicMessage {
  id: string;
  building_id: string;
  sender_profile_id: string;
  body: string;
  attachments: string[];
  is_incident: boolean;
  created_at: string;
}
