import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Seal } from '@/components/ui/seal';

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center bg-page p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="flex justify-center"><Seal size={44} /></div>
        <p className="text-gold-deep text-[10px] tracking-[3px] uppercase">Maison Cavalier</p>
        <h1 className="text-[24px] text-ink">Page introuvable</h1>
        <p className="text-[12.5px] text-muted leading-relaxed">Cette page n&apos;existe pas ou n&apos;est plus disponible.</p>
        <Link href="/"><Button variant="outline" size="sm">Retour à mon espace</Button></Link>
      </div>
    </main>
  );
}
