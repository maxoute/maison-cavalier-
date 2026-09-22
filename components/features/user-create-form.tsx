'use client';

import { useActionState } from 'react';
import { createUser } from '@/app/actions/users';
import { FormField, FormGroup, FormResult, FormSelect } from '@/components/features/account-fields';
import { Button } from '@/components/ui/button';
import { IconPlus } from '@/components/ui/icons';
import type { ActionResult } from '@/lib/operations/shared';

/**
 * Création d'un compte d'accès web (PRD §6.3.3). Les options de rôle et
 * d'immeuble sont déjà restreintes au périmètre du demandeur côté serveur :
 * ce formulaire n'en est que le reflet.
 */
export function UserCreateForm({
  roles,
  buildings,
  defaultBuildingId,
  buildingName,
  defaultPassword,
}: {
  roles: { value: string; label: string }[];
  /** Renseigné pour le super-admin uniquement ; l'admin est figé à son immeuble. */
  buildings?: { id: string; name: string }[];
  defaultBuildingId: string;
  buildingName: string;
  defaultPassword: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(createUser, {});

  return (
    <form action={formAction} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
        <FormGroup title="Identité">
          <FormField label="Nom complet" name="full_name" required maxLength={120} placeholder="Camille Rivière" />
          <FormField label="E-mail" name="email" type="email" required maxLength={160} placeholder="camille@maison-cavalier.com" />
          <FormField label="Téléphone (optionnel)" name="phone" type="tel" maxLength={30} placeholder="+33 6 12 34 56 78" />
          <FormField
            label="Mot de passe temporaire"
            name="password"
            required
            minLength={8}
            maxLength={72}
            defaultValue={defaultPassword}
            hint="8 caractères minimum · à changer à la première connexion"
          />
        </FormGroup>

        <FormGroup title="Accès">
          <FormSelect label="Rôle" name="role" defaultValue={roles[0]?.value}>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </FormSelect>
          {buildings ? (
            <FormSelect label="Immeuble" name="building_id" defaultValue={defaultBuildingId}>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </FormSelect>
          ) : (
            <div className="min-w-0">
              <input type="hidden" name="building_id" value={defaultBuildingId} />
              <p className="mb-1.5 block text-[11px] uppercase tracking-[1px] text-muted">Immeuble</p>
              <p className="rounded-[8px] border border-line bg-surface-2/60 px-3.5 py-2.5 text-[12.5px] text-ink">
                {buildingName}
              </p>
              <p className="mt-1 text-[11px] text-muted">Périmètre fixé à votre immeuble.</p>
            </div>
          )}
        </FormGroup>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="gold" disabled={pending}>
          <IconPlus size={13} />
          {pending ? 'Création en cours…' : 'Créer le compte'}
        </Button>
        <p className="text-[11px] text-muted">
          Résidents et chauffeurs n’ont pas d’accès web : ils passent par les apps mobiles.
        </p>
      </div>

      <FormResult state={state} />
    </form>
  );
}
