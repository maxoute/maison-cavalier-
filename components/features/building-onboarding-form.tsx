'use client';

import { useActionState } from 'react';
import { onboardBuilding } from '@/app/actions/buildings';
import { FormField, FormGroup, FormResult, FormSelect } from '@/components/features/account-fields';
import { Button } from '@/components/ui/button';
import { IconPlus } from '@/components/ui/icons';
import type { ActionResult } from '@/lib/operations/shared';

/**
 * Onboarding d'un immeuble en moins de 5 minutes (PRD §6.3.2) : immeuble,
 * concierge titulaire et, en option, l'accès syndic. Les identifiants
 * créés sont rappelés à l'écran pour une première connexion immédiate.
 */
export function BuildingOnboardingForm({ defaultPassword }: { defaultPassword: string }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(onboardBuilding, {});

  return (
    <form action={formAction} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
        <FormGroup title="Immeuble">
          <FormField label="Nom de l’immeuble" name="name" required maxLength={120} placeholder="Résidence Beaumarchais" />
          <FormField label="Adresse" name="address" required maxLength={240} placeholder="18 rue du Faubourg, 75011 Paris" />
          <FormSelect label="Formule B2B" name="b2b_plan" defaultValue="premium">
            <option value="essentiel">Essentiel</option>
            <option value="premium">Premium</option>
            <option value="signature">Signature</option>
          </FormSelect>
        </FormGroup>

        <FormGroup title="Concierge titulaire">
          <FormField label="Nom complet" name="concierge_name" required maxLength={120} placeholder="Camille Rivière" />
          <FormField label="E-mail" name="concierge_email" type="email" required maxLength={160} placeholder="camille@maison-cavalier.com" />
          <FormField
            label="Mot de passe temporaire"
            name="concierge_password"
            required
            minLength={8}
            maxLength={72}
            defaultValue={defaultPassword}
            hint="8 caractères minimum · à changer à la première connexion"
            className="sm:col-span-2"
          />
        </FormGroup>

        <FormGroup title="Accès syndic (optionnel)">
          <FormField label="Cabinet / nom" name="syndic_name" maxLength={120} placeholder="Cabinet Perrin" />
          <FormField label="E-mail" name="syndic_email" type="email" maxLength={160} placeholder="contact@cabinet-perrin.fr" />
          <FormField
            label="Mot de passe temporaire"
            name="syndic_password"
            minLength={8}
            maxLength={72}
            defaultValue={defaultPassword}
            hint="Lecture et messagerie uniquement — jamais les fiches résidents."
            className="sm:col-span-2"
          />
        </FormGroup>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="gold" disabled={pending}>
          <IconPlus size={13} />
          {pending ? 'Création en cours…' : 'Créer l’immeuble'}
        </Button>
        <p className="text-[11px] text-muted">
          Catalogue de services et grille tarifaire provisionnés automatiquement.
        </p>
      </div>

      <FormResult state={state} />
    </form>
  );
}
