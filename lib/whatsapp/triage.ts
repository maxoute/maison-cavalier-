import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { generateJson, isGeminiConfigured } from '@/lib/ai/gemini';
import { slaDeadline } from '@/lib/catalog';
import { isServiceType, serviceLabels } from '@/lib/requests';
import type { MessageAnalysis, RequestPriority, ServiceType } from '@/types';

interface ModelDecision {
  action: 'creer_demande' | 'a_traiter' | 'aucune';
  service: ServiceType | 'aucun';
  priority: RequestPriority;
  summary: string;
  description: string;
}

const schema = {
  type: 'OBJECT',
  properties: {
    action: { type: 'STRING', enum: ['creer_demande', 'a_traiter', 'aucune'] },
    service: { type: 'STRING', enum: [...Object.keys(serviceLabels), 'aucun'] },
    priority: { type: 'STRING', enum: ['normale', 'urgente'] },
    summary: { type: 'STRING' },
    description: { type: 'STRING' },
  },
  required: ['action', 'service', 'priority', 'summary', 'description'],
};

/**
 * Analyse un message WhatsApp entrant et ouvre une demande si le résident
 * sollicite un service du catalogue de son immeuble. Écrit avec la clé
 * service-role — appelé depuis le webhook (sans session) ou depuis une action
 * serveur qui a déjà vérifié l'appartenance du fil à l'immeuble. Idempotent :
 * un message déjà analysé n'est jamais retraité.
 */
export async function triageInboundMessage(messageId: string): Promise<MessageAnalysis | null> {
  if (!isGeminiConfigured()) return null;
  const db = createAdminClient();
  const { data: message } = await db.from('messages')
    .select('id, building_id, conversation_id, body, direction, ai_analysis')
    .eq('id', messageId).maybeSingle();
  if (!message || message.direction !== 'entrant' || message.ai_analysis) return null;

  const [conversation, history, catalog] = await Promise.all([
    db.from('conversations').select('resident_id').eq('id', message.conversation_id).eq('building_id', message.building_id).single(),
    db.from('messages').select('direction, body').eq('conversation_id', message.conversation_id)
      .neq('id', message.id).order('created_at', { ascending: false }).limit(8),
    db.from('building_services').select('service, enabled, sla_minutes').eq('building_id', message.building_id),
  ]);
  if (!conversation.data) return null;
  const residentId = conversation.data.resident_id as string;
  const { data: openRequests } = await db.from('service_requests')
    .select('service, payload, status').eq('building_id', message.building_id).eq('resident_id', residentId)
    .neq('status', 'termine').order('created_at', { ascending: false }).limit(5);

  const enabled = (catalog.data ?? []).filter(s => s.enabled) as { service: ServiceType; sla_minutes: number | null }[];
  const prompt = [
    'Tu es l’assistant de la loge d’une conciergerie d’immeuble haut de gamme (Maison Cavalier).',
    'Analyse le DERNIER message WhatsApp d’un résident et décide :',
    '- "creer_demande" si le résident demande un service parmi ceux ouverts : ' + enabled.map(s => `${s.service} (${serviceLabels[s.service]})`).join(', ') + '.',
    '  chauffeur = trajet, VTC, aéroport ; pressing = nettoyage de vêtements ; colis = livraison ou récupération de colis ;',
    '  billetterie = places de spectacle, match, restaurant réservé ; personal_shopper = achats, courses, cadeaux.',
    '- "a_traiter" si le message demande une action de la loge hors catalogue (fuite, panne, bruit, clés, plainte, question urgente).',
    '- "aucune" pour un remerciement, une confirmation, une salutation, ou si une demande ouverte décrit EXPLICITEMENT le même besoin (même date, même objet). Dans le doute, crée la demande : la loge fusionnera.',
    'priority = "urgente" seulement si c’est pressant (aujourd’hui dans l’heure, sécurité, dégât).',
    'summary : 8 mots max, en français. description : la demande reformulée pour la loge, avec date, heure, lieu, quantités si mentionnés.',
    'Si action ≠ creer_demande, service = "aucun".',
    '',
    `Demandes déjà ouvertes pour ce résident : ${JSON.stringify((openRequests ?? []).map(r => ({ service: r.service, statut: r.status, description: (r.payload as { description?: string })?.description ?? 'non précisée' })))}`,
    'Historique récent (du plus ancien au plus récent) :',
    ...((history.data ?? []).reverse().map(m => `${m.direction === 'entrant' ? 'Résident' : 'Loge'} : ${m.body}`)),
    '',
    `DERNIER message du résident : ${message.body}`,
  ].join('\n');

  let analysis: MessageAnalysis;
  let requestId: string | null = null;
  try {
    const decision = await generateJson<ModelDecision>(prompt, schema);
    const service = decision.service !== 'aucun' && isServiceType(decision.service)
      ? enabled.find(s => s.service === decision.service) : undefined;
    if (decision.action === 'creer_demande' && service) {
      const { data: request, error } = await db.from('service_requests').insert({
        building_id: message.building_id, resident_id: residentId, service: service.service,
        priority: decision.priority === 'urgente' ? 'urgente' : 'normale',
        payload: { description: decision.description, source: 'whatsapp', message_id: message.id },
        sla_deadline: slaDeadline(service.sla_minutes, Date.now()),
      }).select('id').single();
      if (error || !request) throw new Error('Demande non créée.');
      requestId = request.id;
    }
    analysis = {
      action: decision.action === 'creer_demande' && !service ? 'a_traiter' : decision.action,
      service: requestId ? service!.service : null,
      priority: decision.priority === 'urgente' ? 'urgente' : 'normale',
      summary: decision.summary.slice(0, 200),
      analyzed_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[whatsapp:triage]', error instanceof Error ? error.message : error);
    analysis = { action: 'erreur', service: null, priority: 'normale', summary: 'Analyse indisponible', analyzed_at: new Date().toISOString() };
  }

  await db.from('messages').update({ ai_analysis: analysis, ...(requestId ? { request_id: requestId } : {}) })
    .eq('id', message.id).eq('building_id', message.building_id);
  return analysis;
}
