/**
 * E-mails d'accès (invitation, réinitialisation) : texte brut + HTML sobre
 * aux couleurs de la maison. Module pur, testé sans serveur.
 */

export interface AccessEmail {
  subject: string;
  body: string;
  html: string;
}

const roleNames: Record<string, string> = {
  concierge: 'concierge',
  admin: 'administrateur d’immeuble',
  super_admin: 'super-administrateur',
  syndic: 'syndic de copropriété',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, paragraphs: string[], action: { label: string; url: string }, note: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#0A1628">${escapeHtml(p)}</p>`).join('');
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F5F3EE;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EE;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E4DFD4;border-radius:8px">
<tr><td style="padding:28px 32px 8px;font-family:Georgia,serif;font-size:20px;color:#0A1628">Maison Cavalier</td></tr>
<tr><td style="padding:0 32px"><p style="margin:0 0 18px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8A6B1B">${escapeHtml(title)}</p>${body}
<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#B8922A;color:#0A1628;text-decoration:none;font-weight:600;font-size:14px;padding:12px 26px;border-radius:24px">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 28px;font-size:12px;line-height:1.6;color:#6B7384">${escapeHtml(note)}</p></td></tr>
</table></td></tr></table></body></html>`;
}

export function invitationEmail(input: { fullName: string; role: string; buildingName: string; link: string }): AccessEmail {
  const role = roleNames[input.role] ?? input.role;
  const paragraphs = [
    `Bonjour ${input.fullName},`,
    `Vous êtes invité(e) à rejoindre la plateforme Maison Cavalier en tant que ${role} pour ${input.buildingName}.`,
    'Activez votre compte et choisissez votre mot de passe en suivant le lien ci-dessous.',
  ];
  const note = 'Ce lien est personnel et ne sert qu’une fois. S’il a expiré, demandez-en un nouveau à votre administrateur. Si vous n’attendiez pas cette invitation, ignorez simplement ce message.';
  return {
    subject: 'Votre accès à Maison Cavalier',
    body: `${paragraphs.join('\n\n')}\n\n${input.link}\n\n${note}`,
    html: layout('Invitation', paragraphs, { label: 'Activer mon compte', url: input.link }, note),
  };
}

export function resetEmail(input: { fullName: string; link: string }): AccessEmail {
  const paragraphs = [
    `Bonjour ${input.fullName},`,
    'Une demande de réinitialisation de mot de passe a été faite pour votre compte Maison Cavalier.',
    'Pour choisir un nouveau mot de passe, suivez le lien ci-dessous.',
  ];
  const note = 'Ce lien est personnel et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.';
  return {
    subject: 'Réinitialisation de votre mot de passe Maison Cavalier',
    body: `${paragraphs.join('\n\n')}\n\n${input.link}\n\n${note}`,
    html: layout('Mot de passe', paragraphs, { label: 'Choisir un nouveau mot de passe', url: input.link }, note),
  };
}
