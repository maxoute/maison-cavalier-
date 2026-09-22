import { UserCreateForm } from '@/components/features/user-create-form';
import { UserStatusButton } from '@/components/features/user-status-button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { IconKey, IconSearch, IconUsers } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui/page-header';
import { StatCard, StatGrid } from '@/components/ui/stat';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { managerContext } from '@/lib/admin/server';
import { count, formatDateTime } from '@/lib/format';
import { checkRead } from '@/lib/operations/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Role } from '@/types';

/**
 * Comptes d'accès web (PRD §6.3.3). Les profils sont lus sous RLS — le
 * super-admin voit tout le parc, l'admin son seul immeuble — tandis que
 * l'annuaire auth (e-mails, dernière connexion, comptes bannis) demande la
 * clé service-role, qui ne quitte jamais le serveur.
 */

const roleLabels: Record<Role, string> = {
  concierge: 'Concierge',
  admin: 'Administrateur',
  super_admin: 'Super-admin',
  syndic: 'Syndic',
  resident: 'Résident',
  chauffeur: 'Chauffeur',
};
const roleTones = {
  concierge: 'blue',
  admin: 'violet',
  super_admin: 'gold',
  syndic: 'green',
  resident: 'grey',
  chauffeur: 'grey',
} as const;

/** Rôles gérés par un admin d'immeuble (le reste est réservé au super-admin). */
const adminManagedRoles: Role[] = ['concierge', 'syndic'];

const roleOptions = [
  { value: 'concierge', label: 'Concierge' },
  { value: 'syndic', label: 'Syndic de copropriété' },
  { value: 'admin', label: 'Administrateur d’immeuble' },
  { value: 'super_admin', label: 'Super-administrateur' },
];

interface AuthEntry {
  email: string;
  lastSignInAt: string | null;
  disabled: boolean;
}

/** Annuaire auth, paginé : e-mail, dernière connexion et état du bannissement. */
async function authDirectory(): Promise<Map<string, AuthEntry>> {
  const admin = createAdminClient();
  const directory = new Map<string, AuthEntry>();
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error('Annuaire des comptes indisponible. Réessayez dans un instant.');
    for (const user of data.users) {
      directory.set(user.id, {
        email: user.email ?? '—',
        lastSignInAt: user.last_sign_in_at ?? null,
        disabled: Boolean(user.banned_until && Date.parse(user.banned_until) > Date.now()),
      });
    }
    if (data.users.length < perPage) break;
  }
  return directory;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { db, session, buildingId } = await managerContext();

  const [profiles, buildings, directory] = await Promise.all([
    db.from('profiles').select('id, building_id, role, full_name, phone, created_at').order('full_name'),
    db.from('buildings').select('id, name').order('name'),
    authDirectory(),
  ]);
  checkRead(profiles.error);
  checkRead(buildings.error);

  const buildingNames = new Map((buildings.data ?? []).map((building) => [building.id, building.name]));
  const isSuperAdmin = session.role === 'super_admin';

  const accounts = (profiles.data ?? []).map((profile) => {
    const auth = directory.get(profile.id);
    return {
      ...profile,
      role: profile.role as Role,
      email: auth?.email ?? '—',
      lastSignInAt: auth?.lastSignInAt ?? null,
      disabled: auth?.disabled ?? false,
      buildingName: buildingNames.get(profile.building_id) ?? '—',
      // Un admin ne gère que concierges et syndics de son immeuble ; personne
      // ne se désactive soi-même. Revérifié dans l'action serveur.
      manageable:
        profile.id !== session.userId &&
        (isSuperAdmin || (profile.building_id === session.homeBuildingId && adminManagedRoles.includes(profile.role as Role))),
    };
  });

  const needle = q?.trim().toLowerCase() ?? '';
  const visible = needle
    ? accounts.filter(
        (account) =>
          account.full_name.toLowerCase().includes(needle) || account.email.toLowerCase().includes(needle),
      )
    : accounts;

  const active = accounts.filter((account) => !account.disabled).length;
  const concierges = accounts.filter((account) => account.role === 'concierge').length;
  const admins = accounts.filter((account) => account.role === 'admin' || account.role === 'super_admin').length;
  const syndics = accounts.filter((account) => account.role === 'syndic').length;

  const scope = isSuperAdmin
    ? `${count(buildingNames.size, 'immeuble')} du parc`
    : (buildingNames.get(session.homeBuildingId) ?? 'votre immeuble');

  return (
    <div className="space-y-7 fade-up">
      <PageHeader
        title="Utilisateurs"
        subtitle={`${count(accounts.length, 'compte')} d’accès web sur ${scope} · résidents et chauffeurs passent par les apps mobiles.`}
      />

      <StatGrid>
        <StatCard
          value={active}
          label="comptes actifs"
          hint={
            accounts.length - active === 0
              ? 'aucun compte désactivé'
              : count(accounts.length - active, 'compte désactivé', 'comptes désactivés')
          }
          icon={IconKey}
          accent="green"
        />
        <StatCard value={concierges} label="concierges" icon={IconUsers} accent="blue" />
        <StatCard value={admins} label="administrateurs" icon={IconUsers} accent="violet" />
        <StatCard value={syndics} label="syndics" icon={IconUsers} accent="orange" />
      </StatGrid>

      <section className="space-y-2.5">
        <SectionTitle hint={needle ? `${count(visible.length, 'résultat')}` : undefined}>Comptes</SectionTitle>

        <form method="get" className="flex flex-wrap gap-2">
          <div className="relative w-full max-w-xs">
            <IconSearch size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Rechercher un nom ou un e-mail…"
              aria-label="Rechercher un compte"
              className="pl-8 text-[12.5px]"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Filtrer
          </Button>
        </form>

        {visible.length === 0 ? (
          <EmptyState
            title="Aucun compte"
            description={needle ? 'Aucun nom ni e-mail ne correspond à cette recherche.' : undefined}
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Utilisateur</TH>
                <TH>Rôle</TH>
                <TH>Immeuble</TH>
                <TH>Téléphone</TH>
                <TH>Dernière connexion</TH>
                <TH>Statut</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {visible.map((account) => (
                <TR key={account.id} className={account.disabled ? 'opacity-70' : undefined}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={account.full_name} size={28} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                          {account.full_name}
                          {account.id === session.userId && (
                            <span className="text-[9px] uppercase tracking-[1.2px] text-gold-deep">vous</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">{account.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={roleTones[account.role] ?? 'grey'}>{roleLabels[account.role] ?? account.role}</Badge>
                  </TD>
                  <TD className="text-[11.5px] text-muted">{account.buildingName}</TD>
                  <TD className="text-[11.5px] text-muted">{account.phone ?? '—'}</TD>
                  <TD className="text-[11.5px] text-muted">
                    {account.lastSignInAt ? formatDateTime(account.lastSignInAt) : 'Jamais'}
                  </TD>
                  <TD>
                    <Badge tone={account.disabled ? 'red' : 'green'}>{account.disabled ? 'Désactivé' : 'Actif'}</Badge>
                  </TD>
                  <TD className="text-right">
                    {account.manageable ? (
                      <div className="flex justify-end">
                        <UserStatusButton id={account.id} name={account.full_name} active={!account.disabled} />
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <section className="space-y-2.5">
        <SectionTitle hint="Mot de passe temporaire communiqué à l’intéressé">Nouveau compte</SectionTitle>
        <Disclosure summary="Créer un compte" hint="concierge, syndic ou gestionnaire" bodyClassName="bg-surface-2/40">
          <UserCreateForm
            roles={isSuperAdmin ? roleOptions : roleOptions.filter((role) => adminManagedRoles.includes(role.value as Role))}
            buildings={isSuperAdmin ? ((buildings.data ?? []) as { id: string; name: string }[]) : undefined}
            defaultBuildingId={buildingId}
            buildingName={buildingNames.get(buildingId) ?? '—'}
            defaultPassword="Cavalier-2026!"
          />
        </Disclosure>
        <p className="text-[10px] text-muted">
          Un compte désactivé ne peut plus se connecter : le profil, l’historique et le journal d’audit restent
          intacts, et la réactivation rend l’accès immédiatement.
        </p>
      </section>
    </div>
  );
}
