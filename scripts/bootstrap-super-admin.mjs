// Ouverture d'une plateforme vide : crée le premier immeuble et invite le
// premier super-administrateur, puis affiche son lien d'activation. Tout le
// reste (immeubles suivants, admins, concierges, syndics) se fait ensuite
// depuis l'interface, sur invitation.
//
// Usage :
//   npm run bootstrap:super-admin -- --env .env.prod \
//     --email prenom@maison-cavalier.com --nom "Prénom Nom" \
//     --immeuble "Le Marly" --adresse "12 avenue Montaigne, 75008 Paris"
//
// Le fichier d'environnement fournit NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY et APP_URL. Le script refuse de tourner si un
// super-administrateur existe déjà.
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { accessLink } from '../lib/auth/links.ts';

const { values } = parseArgs({
  options: {
    env: { type: 'string', default: '.env.local' },
    email: { type: 'string' },
    nom: { type: 'string' },
    immeuble: { type: 'string' },
    adresse: { type: 'string' },
    formule: { type: 'string', default: 'signature' },
  },
});

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

for (const required of ['email', 'nom', 'immeuble', 'adresse']) {
  if (!values[required]?.trim()) fail(`--${required} est obligatoire (voir l’en-tête du script).`);
}
const email = values.email.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) fail(`Adresse e-mail invalide : ${email}`);
if (!['essentiel', 'premium', 'signature'].includes(values.formule)) fail('Formule inconnue (essentiel, premium, signature).');

try {
  process.loadEnvFile(values.env);
} catch {
  fail(`Fichier d’environnement illisible : ${values.env}`);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL?.trim() || 'http://localhost:3000';
if (!url || !key) fail('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans le fichier d’environnement.');

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'super_admin');
if (countError) fail(`Base illisible (migrations appliquées ?) : ${countError.message}`);
if (count > 0) fail('Un super-administrateur existe déjà : invitez les comptes suivants depuis l’interface.');

const { data: building, error: buildingError } = await admin.from('buildings')
  .insert({ name: values.immeuble.trim(), address: values.adresse.trim(), b2b_plan: values.formule })
  .select('id, name').single();
if (buildingError || !building) fail(`Immeuble non créé : ${buildingError?.message}`);

async function rollback(userId) {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => null);
  await admin.from('notification_templates').delete().eq('building_id', building.id);
  await admin.from('building_services').delete().eq('building_id', building.id);
  await admin.from('buildings').delete().eq('id', building.id);
}

const { data: invite, error: inviteError } = await admin.auth.admin.generateLink({
  type: 'invite', email, options: { data: { full_name: values.nom.trim() } },
});
if (inviteError || !invite?.user || !invite.properties?.hashed_token) {
  await rollback(null);
  fail(`Invitation impossible : ${inviteError?.message ?? 'réponse vide'}`);
}
const userId = invite.user.id;
const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
  app_metadata: { role: 'super_admin', building_id: building.id },
});
const { error: profileError } = metadataError
  ? { error: metadataError }
  : await admin.from('profiles').insert({ id: userId, building_id: building.id, role: 'super_admin', full_name: values.nom.trim() });
if (profileError) {
  await rollback(userId);
  fail(`Compte non enregistré : ${profileError.message}`);
}
await admin.from('audit_logs').insert({
  building_id: building.id, actor_id: userId, action: 'bootstrap_super_admin', entity: 'profiles', entity_id: userId,
  details: { email, building: building.name },
});

console.log(`✓ Immeuble « ${building.name} » créé, catalogue de services provisionné.`);
console.log(`✓ Super-administrateur invité : ${values.nom.trim()} <${email}>`);
console.log('\nLien d’activation (usage unique, à ouvrir par la personne invitée) :');
console.log(accessLink(appUrl, invite.properties.hashed_token, 'invite'));
