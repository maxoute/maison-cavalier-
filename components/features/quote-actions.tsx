"use client";

import { useTransition } from "react";
import { updateQuoteStatus } from "@/app/actions/quotes";
import { Button } from "@/components/ui/button";

/** Validation / refus en un clic (PRD §6.1.6). */
export function QuoteActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-1.5 shrink-0">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => updateQuoteStatus(id, "accepte"))}
      >
        Valider
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => updateQuoteStatus(id, "refuse"))}
      >
        Refuser
      </Button>
    </div>
  );
}
