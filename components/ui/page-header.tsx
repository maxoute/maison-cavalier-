import { cn } from "@/lib/cn";

/**
 * En-tête de page commun aux trois portails : titre Lora, sous-titre
 * discret et zone d'actions alignée à droite (un seul bouton or par écran).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[30px] sm:text-[34px] leading-tight tracking-[-0.025em] text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted leading-relaxed max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** Titre de section à l'intérieur d'une page. */
export function SectionTitle({
  children,
  hint,
  className,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-2", className)}>
      <h2 className="text-[21px] text-ink">{children}</h2>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** État vide illustré par un simple message, sans bloc massif. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[8px] border border-dashed border-line bg-surface/60 px-5 py-8 text-center",
        className,
      )}
    >
      <p className="text-base text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
