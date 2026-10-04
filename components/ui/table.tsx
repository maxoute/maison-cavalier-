import { cn } from "@/lib/cn";

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-[8px] border border-line bg-surface">
      <table className={cn("w-full text-left text-sm text-ink", className)} {...props} />
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-surface-2/60 text-muted text-xs border-b border-line",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-line/60", className)} {...props} />;
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("hover:bg-surface-2/70 transition-colors duration-300", className)} {...props} />
  );
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-4 py-3.5 font-medium", className)} {...props} />;
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3.5", className)} {...props} />;
}
