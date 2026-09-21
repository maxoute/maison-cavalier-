/**
 * Configuration Meta Cloud API. Tant que les quatre valeurs ne sont pas
 * présentes, l'application reste explicitement en simulation : une
 * configuration à moitié renseignée perdrait des messages sans le dire.
 */
export interface MetaConfig {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  apiVersion: string;
}

export function readMetaConfig(env: NodeJS.ProcessEnv = process.env): MetaConfig | null {
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim();
  const appSecret = env.WHATSAPP_APP_SECRET?.trim();
  const verifyToken = env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!phoneNumberId || !accessToken || !appSecret || !verifyToken) return null;
  return {
    phoneNumberId, accessToken, appSecret, verifyToken,
    apiVersion: env.WHATSAPP_API_VERSION?.trim() || 'v21.0',
  };
}
