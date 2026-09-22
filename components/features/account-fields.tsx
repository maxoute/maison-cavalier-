'use client';

import { Input, Label, Select } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { ActionResult } from '@/lib/operations/shared';

/**
 * Briques de formulaire partagées par l'onboarding d'immeuble et la
 * création de compte (PRD §6.3.2 / §6.3.3) : densité 12,5 px, libellés en
 * capitales espacées, et restitution des résultats sur plusieurs lignes
 * (le message de succès liste les identifiants créés).
 */

export function FormField({
  label,
  hint,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> & { label: string; hint?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} className="text-[12.5px]" {...props} />
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function FormSelect({
  label,
  hint,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <Label htmlFor={props.name}>{label}</Label>
      <Select id={props.name} className="text-[12.5px]" {...props}>
        {children}
      </Select>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function FormGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[1.5px] text-muted before:h-px before:w-3 before:bg-gold/50 before:content-['']">
        {title}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Erreur en rouge, succès en vert avec retours à la ligne préservés. */
export function FormResult({ state }: { state: ActionResult }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-[8px] border border-red/30 bg-red/[0.06] px-3.5 py-2.5 text-[12px] text-red">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <div
        role="status"
        className="whitespace-pre-line rounded-[8px] border border-green/30 bg-green/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-ink"
      >
        {state.success}
      </div>
    );
  }
  return null;
}
