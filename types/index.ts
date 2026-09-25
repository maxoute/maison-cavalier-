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

export type ConversationChannel = "whatsapp" | "app" | "sms";
export type ConversationStatus = "ouverte" | "en_attente" | "resolue";
export type MessageDirection = "entrant" | "sortant";
export type MessageDeliveryStatus =
  | "en_attente"
  | "envoye"
  | "livre"
  | "lu"
  | "echec";

export type ParcelStatus = "recu" | "stocke" | "notifie" | "remis" | "retourne";

export type PressingStatus = "collecte" | "chez_le_pressing" | "pret" | "livre";

export type RecommendationCategory =
  | "restaurant"
  | "artisan"
  | "bien_etre"
  | "culture"
  | "transport"
  | "shopping"
  | "autre";
export type RecommendationShareStatus =
  | "proposee"
  | "consultee"
  | "reservee"
  | "refusee";

/** Origine d'un devis : saisi en loge, ou reçu par e-mail (PRD §6.1.6). */
export type QuoteSource = "manuel" | "email";

export type NotificationChannelType = "push" | "whatsapp" | "email" | "sms";

export type NotificationEvent =
  | "colis_recu"
  | "chauffeur_en_route"
  | "chauffeur_arrive"
  | "pressing_pret"
  | "rappel_colis_non_retire"
  | "offre_billetterie"
  | "annonce_urgente"
  | "annonce_immeuble"
  | "confirmation_paiement"
  // Hors matrice PRD Annexe A : ajoutés avec les modules recommandations
  // et devis par e-mail.
  | "recommandation_partagee"
  | "devis_recu";

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
  completed_at: string | null;
  assigned_provider: string | null;
  estimated_completion_at: string | null;
  started_at: string | null;
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
  /** Null tant qu'un devis reçu par e-mail n'est pas rattaché à un résident. */
  resident_id: string | null;
  request_id: string | null;
  provider: string;
  label: string;
  /** Null quand le montant n'a pas encore été relevé sur la pièce jointe. */
  amount_cents: number | null;
  status: QuoteStatus;
  pdf_path: string | null;
  source: QuoteSource;
  email_from: string | null;
  email_subject: string | null;
  email_received_at: string | null;
  /** Message-Id RFC 5322 — clé d'idempotence de l'ingestion. */
  email_message_id: string | null;
  attachment_path: string | null;
  sent_at: string | null;
  decided_at: string | null;
  updated_at: string;
  document_snapshot: {
    building_name: string; building_address: string; resident_name: string;
    provider: string; label: string; amount_cents: number; currency: string; service: ServiceType | null;
  } | null;
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

/**
 * Fil de chat opérationnel résident ↔ conciergerie. Le canal de production
 * est WhatsApp Business (PRD §7.3, §11) ; distinct de `SyndicMessage`.
 */
export interface Conversation {
  id: string;
  building_id: string;
  resident_id: string;
  channel: ConversationChannel;
  /** Identifiant du fil chez le provider (wa_id). */
  external_thread_id: string | null;
  status: ConversationStatus;
  assigned_profile_id: string | null;
  last_message_at: string | null;
  last_read_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  building_id: string;
  conversation_id: string;
  direction: MessageDirection;
  /** Non nul si et seulement si `direction` vaut "sortant". */
  sender_profile_id: string | null;
  body: string;
  attachments: string[];
  external_message_id: string | null;
  delivery_status: MessageDeliveryStatus;
  /** Demande créée depuis ce message : traçabilité chat → opération. */
  request_id: string | null;
  /** Décision du triage LLM sur un message entrant (nulle tant que non analysé). */
  ai_analysis: MessageAnalysis | null;
  created_at: string;
}

export interface MessageAnalysis {
  action: 'creer_demande' | 'a_traiter' | 'aucune' | 'erreur';
  service: ServiceType | null;
  priority: RequestPriority;
  summary: string;
  analyzed_at: string;
}

export interface Parcel {
  id: string;
  building_id: string;
  resident_id: string;
  request_id: string | null;
  carrier: string | null;
  tracking_code: string | null;
  status: ParcelStatus;
  storage_location: string | null;
  photo_path: string | null;
  received_at: string;
  scheduled_delivery_at: string | null;
  delivered_at: string | null;
  /** Non nul = rappel « colis non retiré » déjà envoyé (PRD Annexe A). */
  reminder_sent_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PressingItem {
  label: string;
  quantity: number;
}

export interface PressingOrder {
  id: string;
  building_id: string;
  resident_id: string;
  request_id: string | null;
  provider: string | null;
  status: PressingStatus;
  items: PressingItem[];
  item_count: number;
  amount_cents: number | null;
  collected_at: string;
  expected_return_at: string | null;
  returned_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  id: string;
  building_id: string;
  category: RecommendationCategory;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  url: string | null;
  is_partner: boolean;
  commission_rate: number | null;
  rating: number | null;
  is_active: boolean;
  created_at: string;
}

/** Une recommandation envoyée à un résident, et ce qu'elle est devenue. */
export interface RecommendationShare {
  id: string;
  building_id: string;
  recommendation_id: string;
  resident_id: string;
  shared_by_profile_id: string | null;
  conversation_id: string | null;
  channel: NotificationChannelType;
  status: RecommendationShareStatus;
  feedback: string | null;
  /** Montant de la réservation, renseigné au passage en « réservée ». */
  booking_amount_cents: number | null;
  /** Commission figée à la réservation, d'après le taux du partenaire. */
  commission_cents: number | null;
  status_changed_at: string | null;
  created_at: string;
}

/** Unité de facturation d'un service (PRD §6.3.4). */
export type PricingUnit = "fixe" | "km" | "heure";

/** Ligne du catalogue : un service tel qu'il est vendu dans un immeuble. */
export interface BuildingService {
  id: string;
  building_id: string;
  service: ServiceType;
  enabled: boolean;
  pricing_unit: PricingUnit;
  base_price_cents: number;
  /** Commission Maison Cavalier, en pourcentage du montant facturé. */
  commission_rate: number;
  partner_name: string | null;
  /** Délai d'engagement utilisé pour proposer l'échéance SLA d'une demande. */
  sla_minutes: number | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  id: string;
  building_id: string;
  slug: string;
  label: string;
  title: string;
  body: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
