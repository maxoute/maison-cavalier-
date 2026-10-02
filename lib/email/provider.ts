import 'server-only';

export interface EmailMessage { to: string; subject: string; body: string; html?: string }
export interface EmailProvider { readonly name: string; send(message: EmailMessage): Promise<{ id: string; simulated: boolean }> }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  async send(message: EmailMessage) {
    if (!emailPattern.test(message.to)) throw new Error('Adresse email invalide.');
    return { id: `email.mock-${crypto.randomUUID()}`, simulated: true };
  }
}

/**
 * Envoi réel via l'API Resend dès que `RESEND_API_KEY` et `EMAIL_FROM`
 * sont renseignés (domaine vérifié chez Resend). Sans eux, l'application
 * reste explicitement en simulation : les invitations affichent alors leur
 * lien à l'écran au lieu de partir par e-mail.
 */
class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(message: EmailMessage) {
    if (!emailPattern.test(message.to)) throw new Error('Adresse email invalide.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.body, html: message.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Envoi de l’e-mail refusé (HTTP ${response.status}).`);
    const result = (await response.json()) as { id?: string };
    return { id: result.id ?? `email.resend-${crypto.randomUUID()}`, simulated: false };
  }
}

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.EMAIL_FROM?.trim();

export const emailProvider: EmailProvider = apiKey && from ? new ResendEmailProvider(apiKey, from) : new MockEmailProvider();

/** Vrai quand les e-mails partent réellement. */
export function isEmailLive(): boolean {
  return emailProvider.name !== 'mock';
}
