import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { parseWebhook, verifySignature } from '../lib/whatsapp/webhook.ts';
import { readMetaConfig } from '../lib/whatsapp/config.ts';
import { toE164, toWaId } from '../lib/whatsapp/phone.ts';

const secret = 'secret-application';
const sign = (body, key = secret) => `sha256=${createHmac('sha256', key).update(body, 'utf8').digest('hex')}`;

test('la signature Meta est vérifiée sur le corps brut', () => {
  const body = '{"entry":[]}';
  assert.equal(verifySignature(body, sign(body), secret), true);
  assert.equal(verifySignature(body, sign(body, 'autre-secret'), secret), false);
  assert.equal(verifySignature('{"entry":[{}]}', sign(body), secret), false);
  assert.equal(verifySignature(body, sign(body), undefined), false, 'sans secret configuré, rien ne passe');
  assert.equal(verifySignature(body, null, secret), false);
  assert.equal(verifySignature(body, 'sha1=abc', secret), false);
  assert.equal(verifySignature(body, 'sha256=trop-court', secret), false);
});

const event = {
  entry: [{
    changes: [{
      value: {
        messages: [
          { from: '+33 6 12 34 56 78', id: 'wamid.AAA', timestamp: '1790000000', type: 'text', text: { body: 'Bonjour, un colis est-il arrivé ?' } },
          { from: '33612345678', id: 'wamid.BBB', timestamp: '1790000100', type: 'image', image: { id: 'media-1' } },
          { from: '33612345678', id: 'wamid.CCC', timestamp: '1790000200', type: 'text', text: { body: '   ' } },
          { id: 'wamid.DDD', text: { body: 'Sans expéditeur' } },
        ],
        statuses: [
          { id: 'wamid.SENT', status: 'delivered' },
          { id: 'wamid.SENT2', status: 'read' },
          { id: 'wamid.SENT3', status: 'inconnu' },
          { status: 'delivered' },
        ],
      },
    }],
  }],
};

test('le webhook ne retient que les messages exploitables', () => {
  const { messages, statuses } = parseWebhook(event);
  assert.deepEqual(messages.map(m => m.externalMessageId), ['wamid.AAA']);
  assert.equal(messages[0].waId, '33612345678', 'le numéro est réduit à ses chiffres');
  assert.equal(messages[0].body, 'Bonjour, un colis est-il arrivé ?');
  assert.equal(messages[0].receivedAt, '2026-09-21T14:13:20.000Z');
  assert.deepEqual(statuses, [
    { externalMessageId: 'wamid.SENT', status: 'livre' },
    { externalMessageId: 'wamid.SENT2', status: 'lu' },
  ]);
});

test('une charge utile inattendue ne fait pas échouer la réception', () => {
  for (const payload of [null, {}, { entry: 'x' }, { entry: [{ changes: {} }] }, { entry: [{ changes: [{ value: null }] }] }]) {
    assert.deepEqual(parseWebhook(payload), { messages: [], statuses: [] });
  }
  const long = { entry: [{ changes: [{ value: { messages: [{ from: '33612345678', id: 'wamid.LONG', timestamp: '1790000000', text: { body: 'a'.repeat(5000) } }] } }] }] };
  assert.equal(parseWebhook(long).messages[0].body.length, 4000);
});

test('le provider réel n’est retenu que si la configuration est complète', () => {
  const complete = {
    WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_ACCESS_TOKEN: 'token',
    WHATSAPP_APP_SECRET: secret, WHATSAPP_VERIFY_TOKEN: 'verif',
  };
  assert.equal(readMetaConfig(complete).apiVersion, 'v21.0');
  assert.equal(readMetaConfig({ ...complete, WHATSAPP_API_VERSION: 'v22.0' }).apiVersion, 'v22.0');
  for (const missing of Object.keys(complete)) {
    assert.equal(readMetaConfig({ ...complete, [missing]: '  ' }), null, `${missing} manquant`);
  }
  assert.equal(readMetaConfig({}), null);
});

test('un même numéro est reconnu quelle que soit sa saisie', () => {
  for (const value of ['+33 6 12 34 56 78', '06 12 34 56 78', '0033612345678']) {
    assert.equal(toE164(value), '+33612345678');
    assert.equal(toWaId(value), '33612345678');
  }
  assert.equal(toE164('numéro inconnu'), null);
});

// ---------- Modèles et fenêtre de service ----------
import { buildTemplateMessage, firstName, templateDefinitions, templateVariable } from '../lib/whatsapp/templates.ts';
import { SERVICE_WINDOW_MS, serviceWindowClosesAt, serviceWindowOpen } from '../lib/whatsapp/window.ts';

test('chaque événement résident a un modèle conforme aux règles de format de Meta', () => {
  for (const [event, definition] of Object.entries(templateDefinitions)) {
    assert.match(definition.name, /^[a-z0-9_]{1,512}$/, event);
    assert.doesNotMatch(definition.body, /^\{\{\d+\}\}/, `${event} : ne doit pas commencer par une variable`);
    assert.doesNotMatch(definition.body, /\{\{\d+\}\}\s*$/, `${event} : ne doit pas finir par une variable`);
    assert.doesNotMatch(definition.body, /\}\}[\s.,:;!?-]*\{\{/, `${event} : variables collées`);
    const placeholders = definition.body.match(/\{\{\d+\}\}/g) ?? [];
    assert.equal(placeholders.length, definition.example.length, `${event} : un exemple par variable`);
    placeholders.forEach((placeholder, index) => assert.equal(placeholder, `{{${index + 1}}}`, `${event} : variables dans l’ordre`));
  }
});

test('les variables partent sur une seule ligne, bornées et jamais vides', () => {
  assert.equal(templateVariable('  Coupure\n\nd’eau   demain ', 'x'), 'Coupure d’eau demain');
  assert.equal(templateVariable('', 'votre immeuble'), 'votre immeuble');
  assert.equal(templateVariable(undefined, 'repli'), 'repli');
  assert.equal(templateVariable('a'.repeat(400), 'x', 50).length, 50);
  assert.equal(firstName('Isabelle Morel'), 'Isabelle');
  assert.equal(firstName('   '), 'Madame, Monsieur');
});

test('colis, pressing et rappel portent le prénom et l’immeuble', () => {
  for (const event of ['colis_recu', 'pressing_pret', 'rappel_colis_non_retire']) {
    const message = buildTemplateMessage({ event, payload: { body: 'ignoré' }, residentName: 'Isabelle Morel', buildingName: 'Le Marly' });
    assert.equal(message.name, templateDefinitions[event].name);
    assert.deepEqual(message.variables, ['Isabelle', 'Le Marly']);
    assert.match(message.preview, /^Bonjour Isabelle, .*Le Marly/);
    assert.doesNotMatch(message.preview, /\{\{/);
  }
});

test('l’annonce urgente fusionne titre et texte, ponctuation comprise', () => {
  const message = buildTemplateMessage({
    event: 'annonce_urgente', payload: { title: 'Coupure d’eau', body: 'Demain de 9 h à 12 h' },
    residentName: 'Isabelle Morel', buildingName: 'Le Marly',
  });
  assert.deepEqual(message.variables, ['Le Marly', 'Coupure d’eau — Demain de 9 h à 12 h.']);
});

test('un événement sans modèle WhatsApp reste une simple trace', () => {
  assert.equal(buildTemplateMessage({ event: 'devis_envoye', payload: {}, residentName: 'A B', buildingName: 'X' }), null);
  assert.equal(buildTemplateMessage({ event: 'toString', payload: {}, residentName: 'A B', buildingName: 'X' }), null);
});

test('la réponse libre n’est possible que 24 h après le dernier message du résident', () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  assert.equal(serviceWindowOpen(null, now), false);
  assert.equal(serviceWindowOpen('pas une date', now), false);
  assert.equal(serviceWindowOpen('2026-10-02T11:00:00Z', now), true);
  assert.equal(serviceWindowOpen(new Date(now - SERVICE_WINDOW_MS).toISOString(), now), false);
  assert.equal(serviceWindowClosesAt('2026-10-02T11:00:00Z', now).toISOString(), '2026-10-03T11:00:00.000Z');
  assert.equal(serviceWindowClosesAt('2026-09-30T11:00:00Z', now), null);
});

// ---------- Garde-fou des destinataires (environnements de test) ----------
import { parseAllowedRecipients, recipientAllowed } from '../lib/whatsapp/allowlist.ts';

test('sans WHATSAPP_ALLOWED_RECIPIENTS, aucun destinataire n’est filtré', () => {
  assert.equal(parseAllowedRecipients(undefined), null);
  assert.equal(recipientAllowed('+33698765401', null), true);
});

test('la liste de test n’autorise que ses numéros, quel que soit leur format', () => {
  const allowed = parseAllowedRecipients('06 12 34 56 78, +1 555 753 7208');
  assert.equal(recipientAllowed('+33612345678', allowed), true);
  assert.equal(recipientAllowed('0033612345678', allowed), true);
  assert.equal(recipientAllowed('+15557537208', allowed), true);
  assert.equal(recipientAllowed('+33698765401', allowed), false, 'résident de démo bloqué');
});

test('une liste sans numéro valide bloque tout envoi réel', () => {
  for (const value of ['', 'a_remplir', ' , ']) {
    const allowed = parseAllowedRecipients(value);
    assert.equal(allowed.size, 0);
    assert.equal(recipientAllowed('+33612345678', allowed), false, JSON.stringify(value));
  }
});

// ---------- Défi de vérification du webhook ----------
import { verifyChallenge } from '../lib/whatsapp/webhook.ts';

test('le défi Meta n’exige que le jeton de vérification', () => {
  const params = (token, mode = 'subscribe') => new URLSearchParams({ 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': '1158201444' });
  assert.equal(verifyChallenge(params('jeton-ok'), 'jeton-ok'), '1158201444');
  assert.equal(verifyChallenge(params('jeton-ok'), ' jeton-ok '), '1158201444');
  assert.equal(verifyChallenge(params('mauvais'), 'jeton-ok'), null);
  assert.equal(verifyChallenge(params('jeton-ok', 'unsubscribe'), 'jeton-ok'), null);
  assert.equal(verifyChallenge(params(''), undefined), null, 'sans jeton configuré, tout est refusé');
  assert.equal(verifyChallenge(params(''), ''), null);
});
