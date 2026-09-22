import { cn } from "@/lib/cn";

const fieldStyles =
  "w-full rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-ink " +
  "placeholder:text-muted/60 " +
  "focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 " +
  "transition-shadow duration-300";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldStyles, className)} {...props} />;
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-[11px] uppercase tracking-[1px] text-muted mb-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldStyles, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldStyles, "cursor-pointer", className)} {...props} />
  );
}
