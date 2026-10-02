/**
 * Modèles WhatsApp validés par Meta, un par événement envoyé aux résidents.
 *
 * Hors de la fenêtre de 24 h ouverte par le dernier message du résident,
 * Meta n'accepte que ces modèles : toute notification automatique passe
 * donc par eux. Les noms et le texte doivent rester identiques à ceux
 * soumis dans WhatsApp Manager (compte Maison Cavalier, langue `fr`) —
 * `templateDefinitions` en est la copie de référence.
 */

export interface TemplateDefinition {
  name: string;
  category: 'UTILITY' | 'MARKETING';
  /** Corps tel que soumis à Meta, variables positionnelles {{1}}, {{2}}… */
  body: string;
  example: string[];
}

export const templateDefinitions = {
  colis_recu: {
    name: 'mc_colis_disponible',
    category: 'UTILITY',
    body: 'Bonjour {{1}}, un colis vous attend à la conciergerie de votre résidence {{2}}. Vous pouvez le retirer à la loge ou répondre à ce message pour convenir d’une remise à votre porte.',
    example: ['Isabelle', 'Le Marly'],
  },
  rappel_colis_non_retire: {
    name: 'mc_rappel_colis',
    category: 'UTILITY',
    body: 'Bonjour {{1}}, votre colis est toujours disponible à la conciergerie de votre résidence {{2}}. Répondez à ce message pour convenir d’une remise à votre porte.',
    example: ['Isabelle', 'Le Marly'],
  },
  pressing_pret: {
    name: 'mc_pressing_pret',
    category: 'UTILITY',
    body: 'Bonjour {{1}}, votre pressing est prêt à la conciergerie de votre résidence {{2}}. Vous pouvez le retirer à la loge ou répondre à ce message pour une livraison.',
    example: ['Isabelle', 'Le Marly'],
  },
  annonce_urgente: {
    name: 'mc_annonce_urgente',
    category: 'UTILITY',
    body: 'La conciergerie de votre résidence {{1}} vous informe : {{2}} Pour toute question, répondez simplement à ce message.',
    example: ['Le Marly', 'Coupure d’eau demain de 9 h à 12 h pour intervention sur la colonne B.'],
  },
  // Recommandation de partenaires (affiliations) : contenu promotionnel,
  // donc catégorie MARKETING au sens des règles Meta.
  recommandation_partagee: {
    name: 'mc_recommandation',
    category: 'MARKETING',
    body: 'Bonjour {{1}}, votre conciergerie vous recommande : {{2}}. Répondez à ce message pour réserver ou en savoir plus.',
    example: ['Isabelle', 'Le Clarence — table gastronomique, 31 avenue Franklin D. Roosevelt'],
  },
} satisfies Record<string, TemplateDefinition>;

export type TemplateEvent = keyof typeof templateDefinitions;

export interface TemplateContext {
  event: string;
  payload: Record<string, unknown>;
  residentName: string;
  buildingName: string;
}

/**
 * Meta refuse une variable vide, multiligne ou chargée d'espaces : on
 * l'aplatit, on la borne, et on ne laisse jamais partir une valeur vide.
 */
export function templateVariable(value: unknown, fallback: string, max = 300): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  const safe = text || fallback;
  return safe.length > max ? `${safe.slice(0, max - 1).trimEnd()}…` : safe;
}

/** Prénom d'usage : « Isabelle Morel » → « Isabelle ». */
export function firstName(fullName: string): string {
  return templateVariable(fullName.split(/\s+/)[0], 'Madame, Monsieur', 60);
}

/**
 * Modèle et variables d'une notification, ou `null` si l'événement n'a pas
 * de modèle WhatsApp (il reste alors une simple trace).
 */
export function buildTemplateMessage(context: TemplateContext): { name: string; variables: string[]; preview: string } | null {
  if (!Object.prototype.hasOwnProperty.call(templateDefinitions, context.event)) return null;
  const definition: TemplateDefinition = templateDefinitions[context.event as TemplateEvent];
  const building = templateVariable(context.buildingName, 'votre immeuble', 80);
  const name = firstName(context.residentName);

  let variables: string[];
  switch (context.event) {
    case 'annonce_urgente': {
      const title = templateVariable(context.payload.title, '', 120);
      const body = templateVariable(context.payload.body, 'Une information importante vous attend à la loge.', 600);
      const message = title ? `${title} — ${body}` : body;
      variables = [building, /[.!?…]$/.test(message) ? message : `${message}.`];
      break;
    }
    case 'recommandation_partagee':
      variables = [name, templateVariable(context.payload.body, 'une adresse sélectionnée pour vous', 400)];
      break;
    default:
      variables = [name, building];
  }

  const preview = variables.reduce((text, value, index) => text.replace(`{{${index + 1}}}`, value), definition.body);
  return { name: definition.name, variables, preview };
}
