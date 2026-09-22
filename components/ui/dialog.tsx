"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-full max-w-lg rounded-[8px] bg-surface border border-line text-ink p-0 shadow-xl",
        "backdrop:bg-ink/40 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="text-muted hover:text-ink transition-colors cursor-pointer text-xl leading-none"
        >
          ×
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}
