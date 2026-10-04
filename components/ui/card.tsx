import { cn } from "@/lib/cn";

/** Surface commune : hiérarchie par le contenu, sans bandeau décoratif. */
export function Card({
  className,
  interactive,
  style,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[8px] border border-line overflow-hidden",
        "bg-surface",
        "shadow-[0_1px_3px_rgba(10,22,40,.035)]",
        interactive &&
          "transition-colors duration-200 hover:border-ink/20",
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-5 pt-4 pb-2 flex items-center justify-between gap-3", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-[18px] text-ink", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-4", className)} {...props} />;
}

/** Repère de section lisible, sans ornement. */
export function SectionLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-sm font-medium text-ink",
        className,
      )}
      {...props}
    />
  );
}
