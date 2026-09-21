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
