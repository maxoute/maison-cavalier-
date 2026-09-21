import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

// Projet de démonstration dédié, jamais la configuration .env du déploiement.
const directory = join(tmpdir(), 'maison-cavalier-e2e');
const network = 'maison-cavalier-e2e-local';
const cli = resolve('node_modules/.bin/supabase');
async function command(executable, args) {
  return new Promise((resolveResult, reject) => {
    const process = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    process.stdout.on('data', data => { stdout += data; });
    process.stderr.on('data', data => { stderr += data; });
    process.on('error', reject);
    process.on('close', code => resolveResult({ code, stdout, stderr }));
  });
}

await mkdir(join(directory, 'supabase'), { recursive: true });
const config = (await readFile('supabase/config.toml', 'utf8'))
  .replace('project_id = "MAISON-CAVALIER"', 'project_id = "MAISON-CAVALIER-E2E"')
  .replaceAll('5432', '5542').replaceAll('127.0.0.1:3000', '127.0.0.1:3100');
await writeFile(join(directory, 'supabase/config.toml'), config);
await cp('supabase/migrations', join(directory, 'supabase/migrations'), { recursive: true });
await cp('supabase/seed.sql', join(directory, 'supabase/seed.sql'));

if (process.argv[2] === 'stop') {
  const stopped = await command(cli, ['stop', '--workdir', directory]);
  if (stopped.code !== 0) throw new Error('Impossible d’arrêter la stack E2E.');
  console.log('Stack E2E arrêtée, données conservées.');
} else {
  const existing = await command('docker', ['network', 'inspect', network]);
  if (existing.code !== 0) {
    const created = await command('docker', ['network', 'create', '-o', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', network]);
    if (created.code !== 0) throw new Error('Impossible de créer le réseau local E2E.');
  } else if (JSON.parse(existing.stdout)[0]?.Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1') {
    throw new Error('Le réseau E2E doit être limité à 127.0.0.1.');
  }
  console.log('Démarrage de Supabase E2E (Auth, REST, Realtime, Storage), projet et ports dédiés…');
  const start = await command(cli, ['start', '--workdir', directory, '--network-id', network, '--exclude', 'studio,meta,analytics,vector,edge-runtime,imgproxy']);
  await writeFile(join(directory, 'start.log'), start.stdout + start.stderr, { mode: 0o600 });
  if (start.code !== 0) throw new Error(`Démarrage E2E échoué. Journal : ${join(directory, 'start.log')}`);
  const migration = await command(cli, ['migration', 'up', '--local', '--workdir', directory]);
  await writeFile(join(directory, 'migrations.log'), migration.stdout + migration.stderr, { mode: 0o600 });
  if (migration.code !== 0) throw new Error('Migrations E2E échouées. Consultez migrations.log dans le répertoire E2E.');
  const status = await command(cli, ['status', '--workdir', directory, '--output', 'json']);
  if (status.code !== 0) throw new Error('Statut E2E indisponible.');
  const connection = JSON.parse(status.stdout);
  if (connection.API_URL !== 'http://127.0.0.1:55421' || !connection.ANON_KEY || !connection.SERVICE_ROLE_KEY) throw new Error('Configuration E2E inattendue.');
  await writeFile(join(directory, 'connection.json'), JSON.stringify(connection), { mode: 0o600 });
  console.log('Supabase E2E prêt sur http://127.0.0.1:55421. Configuration privée stockée dans le répertoire temporaire E2E.');
}
