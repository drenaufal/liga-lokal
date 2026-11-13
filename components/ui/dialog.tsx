"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

type DialogCtx = { open: boolean; setOpen: (v: boolean) => void };
const Ctx = React.createContext<DialogCtx | null>(null);

export function Dialog({
  open: controlled,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const open = controlled ?? uncontrolled;
  const setOpen = React.useCallback(
    (v: boolean) => {
      setUncontrolled(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function DialogTrigger({
  children,
  asChild,
}: {
  children: React.ReactElement<Record<string, unknown>>;
  asChild?: boolean;
}) {
  const ctx = React.useContext(Ctx)!;
  const child = children;
  if (asChild) {
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        (child.props.onClick as ((e: React.MouseEvent) => void) | undefined)?.(e);
        ctx.setOpen(true);
      },
    });
  }
  return <button onClick={() => ctx.setOpen(true)}>{children}</button>;
}

export function DialogContent({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  const t = useT();
  const ctx = React.useContext(Ctx)!;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!ctx.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && ctx.setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [ctx.open, ctx]);

  if (!mounted || !ctx.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-night/50 backdrop-blur-[2px] animate-fade-in"
        onClick={() => ctx.setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 my-8 w-full max-w-lg rounded-3xl bg-surface shadow-[0_30px_80px_-20px_rgba(20,20,20,0.45)] animate-pop-in",
          className,
        )}
      >
        <button
          onClick={() => ctx.setOpen(false)}
          aria-label={t("Tutup")}
          className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full bg-surface-2 text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X className="size-4" />
        </button>
        {(title || description) && (
          <div className="px-6 pb-1 pr-14 pt-6">
            {title && <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>}
            {description && (
              <p className="mt-1 text-xs text-ink-muted">{description}</p>
            )}
          </div>
        )}
        <div className="px-6 pb-6 pt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function useDialog() {
  return React.useContext(Ctx)!;
}

export function DialogClose({ children }: { children: React.ReactElement<Record<string, unknown>> }) {
  const ctx = React.useContext(Ctx)!;
  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      (children.props.onClick as ((e: React.MouseEvent) => void) | undefined)?.(e);
      ctx.setOpen(false);
    },
  });
}
