import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterChipItem = {
  key: string;
  label: React.ReactNode;
  href: string;
  active: boolean;
  /** How many results the chip leads to — shown so a hidden group is never a surprise. */
  count?: number;
  /** Pulses a red dot: something in this group is happening right now. */
  live?: boolean;
};

/**
 * `path` with the current query string, `updates` applied on top; a null (or
 * empty) value drops the parameter. Pages build their chip links with it so one
 * filter keeps the others.
 */
export function hrefWith(
  path: string,
  current: Record<string, string | undefined>,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...updates })) {
    if (v) next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * A row of filter pills that are plain links: the filter lives in the URL, so it
 * survives reloads and can be shared, and the page stays a server component.
 */
export function FilterChips({
  items,
  label,
  className,
}: {
  items: FilterChipItem[];
  /** Names the group for screen readers. */
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex items-center gap-1.5 overflow-x-auto pb-0.5", className)}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "true" : undefined}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors",
            item.active ? "bg-night text-white" : "bg-surface-2 text-ink-secondary hover:bg-elevated hover:text-ink",
          )}
        >
          {item.live && <span aria-hidden className="size-1.5 animate-live rounded-full bg-danger" />}
          {item.label}
          {item.count !== undefined && (
            <span className={cn("tabular-nums", item.active ? "text-white/70" : "text-ink-muted")}>{item.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
