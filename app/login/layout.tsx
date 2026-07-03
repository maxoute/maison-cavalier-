import { Seal } from "@/components/ui/seal";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex-1 flex items-center justify-center p-6 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--gold) 22%, transparent), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-[420px] fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <Seal size={38} glow />
            <span className="font-serif text-cream text-[22px] tracking-[1px]">
              Maison Cavalier
            </span>
          </div>
          <p className="text-gold text-[9px] tracking-[3px] uppercase">
            L&apos;Immeuble Haute Couture — Plateforme
          </p>
        </div>
        <div className="rounded-[8px] bg-[linear-gradient(160deg,var(--navy-2),var(--navy))] border border-gold/15 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          {children}
        </div>
      </div>
    </main>
  );
}
