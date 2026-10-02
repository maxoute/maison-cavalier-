import test from 'node:test';
import assert from 'node:assert/strict';
import { accessLink, isAccessLinkType, MIN_PASSWORD_LENGTH, passwordProblem } from '../lib/auth/links.ts';
import { invitationEmail, resetEmail } from '../lib/auth/emails.ts';

test('le lien d’accès pointe vers la page de confirmation de l’application', () => {
  const link = accessLink('https://app.maison-cavalier.com', 'abc123', 'invite');
  const url = new URL(link);
  assert.equal(url.origin, 'https://app.maison-cavalier.com');
  assert.equal(url.pathname, '/auth/confirm');
  assert.equal(url.searchParams.get('token_hash'), 'abc123');
  assert.equal(url.searchParams.get('type'), 'invite');
  // Une barre finale dans APP_URL ne double pas le chemin.
  assert.equal(new URL(accessLink('http://localhost:3000/', 'x', 'recovery')).pathname, '/auth/confirm');
});

test('seuls les liens d’invitation et de réinitialisation sont acceptés', () => {
  assert.equal(isAccessLinkType('invite'), true);
  assert.equal(isAccessLinkType('recovery'), true);
  for (const value of ['signup', 'magiclink', 'email_change', '', undefined, null]) assert.equal(isAccessLinkType(value), false);
});

test('le mot de passe choisi est long, mélangé et confirmé', () => {
  const good = 'Cavalier-du-Marly-7';
  assert.equal(passwordProblem(good, good), null);
  assert.match(passwordProblem('Court-1', 'Court-1'), new RegExp(`${MIN_PASSWORD_LENGTH} caractères`));
  assert.match(passwordProblem('uniquementdeslettres', 'uniquementdeslettres'), /chiffre ou un symbole/);
  assert.match(passwordProblem('123456789012345', '123456789012345'), /lettres/);
  assert.match(passwordProblem(good, `${good}x`), /correspondent pas/);
  assert.match(passwordProblem('a1'.repeat(40), 'a1'.repeat(40)), /72/);
});

test('l’invitation nomme la personne, son rôle, l’immeuble et porte le lien', () => {
  const link = 'https://app.maison-cavalier.com/auth/confirm?token_hash=t&type=invite';
  const email = invitationEmail({ fullName: 'Camille Rivière', role: 'concierge', buildingName: 'Le Marly', link });
  assert.equal(email.subject, 'Votre accès à Maison Cavalier');
  for (const part of ['Camille Rivière', 'concierge', 'Le Marly', link]) assert.ok(email.body.includes(part), part);
  assert.ok(email.html.includes('Activer mon compte'));
  assert.ok(email.html.includes('token_hash=t&amp;type=invite'), 'le lien est échappé dans le HTML');
});

test('les noms saisis ne peuvent pas injecter de HTML dans les e-mails', () => {
  const email = resetEmail({ fullName: '<img src=x onerror=alert(1)>', link: 'https://app.maison-cavalier.com/auth/confirm?token_hash=t&type=recovery' });
  assert.ok(!email.html.includes('<img'));
  assert.ok(email.html.includes('&lt;img'));
  assert.ok(email.body.includes('ignorez ce message'));
});
