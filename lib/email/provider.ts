import 'server-only';
export interface EmailMessage { to: string; subject: string; body: string }
export interface EmailProvider { readonly name: string; send(message: EmailMessage): Promise<{ id: string; simulated: boolean }> }
class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  async send(message: EmailMessage) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to)) throw new Error('Adresse email invalide.');
    return { id: `email.mock-${crypto.randomUUID()}`, simulated: true };
  }
}
export const emailProvider: EmailProvider = new MockEmailProvider();
