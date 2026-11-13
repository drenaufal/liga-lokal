"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, X, ArrowUp, ArrowDown, SlidersHorizontal } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useI18n, useT } from "@/lib/i18n/client";

function useUpdateParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return React.useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (resetPage) next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, params],
  );
}

export function SearchBox({ placeholder }: { placeholder?: string }) {
  const t = useT();
  const params = useSearchParams();
  const update = useUpdateParams();
  const [value, setValue] = React.useState(params.get("q") ?? "");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if ((params.get("q") ?? "") !== value) update({ q: value || null });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? t("Cari…")}
        className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition-colors focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
      />
      {value && (
        <button
          onClick={() => setValue("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({
  param,
  options,
  groups,
  placeholder,
  resets,
  defaultValue,
  className,
  "aria-label": ariaLabel,
}: {
  param: string;
  options?: { value: string; label: string }[];
  /** Grouped options, rendered as <optgroup>s. */
  groups?: { label: string; options: { value: string; label: string }[] }[];
  placeholder: string;
  /** Other filters that depend on this one and are cleared when it changes. */
  resets?: string[];
  /**
   * The option that applies while the param is absent. The "all" placeholder is then an
   * explicit `all` value rather than an empty one, so it can be told apart from the default.
   */
  defaultValue?: string;
  /** Replaces the pill sizing, for a select that fills a grid cell. */
  className?: string;
  "aria-label"?: string;
}) {
  const params = useSearchParams();
  const update = useUpdateParams();
  const emptyValue = defaultValue === undefined ? "" : "all";
  return (
    <Select
      value={params.get(param) ?? defaultValue ?? ""}
      onChange={(e) =>
        update({
          [param]: e.target.value === (defaultValue ?? "") ? null : e.target.value,
          ...Object.fromEntries((resets ?? []).map((k) => [k, null])),
        })
      }
      aria-label={ariaLabel}
      className={cn("h-10 w-[calc(50%-0.25rem)] min-w-0 rounded-full text-xs sm:w-auto sm:min-w-[150px]", className)}
    >
      <option value={emptyValue}>{placeholder}</option>
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {groups?.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

/** A date picker bound to one query param (YYYY-MM-DD); clearing it drops the param. */
export function FilterDate({
  param,
  className,
  "aria-label": ariaLabel,
}: {
  param: string;
  className?: string;
  "aria-label"?: string;
}) {
  const params = useSearchParams();
  const update = useUpdateParams();
  return (
    <Input
      type="date"
      value={params.get(param) ?? ""}
      onChange={(e) => update({ [param]: e.target.value || null })}
      aria-label={ariaLabel}
      className={cn("h-10 min-w-0 rounded-full text-xs", className)}
    />
  );
}

/**
 * "Sort by" select plus a button that reverses the direction. `defaults` is the direction
 * each sort opens in; the URL only carries `dir` when it differs from it. Choosing the empty
 * option (the page's own order) clears both.
 */
export function SortControl({
  options,
  defaults,
  placeholder,
  className,
}: {
  options: { value: string; label: string }[];
  defaults: Record<string, "asc" | "desc">;
  /** Label of the empty option — the order the page opens in. */
  placeholder: string;
  className?: string;
}) {
  const t = useT();
  const params = useSearchParams();
  const update = useUpdateParams();
  const sort = params.get("sort") ?? "";
  const open = defaults[sort] ?? "asc";
  const dir = params.get("dir") === "asc" || params.get("dir") === "desc" ? params.get("dir") : open;
  const flipped = dir === "asc" ? "desc" : "asc";
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={sort}
        onChange={(e) => update({ sort: e.target.value || null, dir: null })}
        aria-label={t("Urutkan")}
        className="h-10 min-w-0 flex-1 rounded-full text-xs"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <button
        type="button"
        disabled={!sort}
        onClick={() => update({ dir: flipped === open ? null : flipped })}
        title={t("Ubah arah urutan")}
        aria-label={`${t("Ubah arah urutan")} (${dir === "asc" ? t("Urutan naik") : t("Urutan turun")})`}
        className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-secondary transition-colors hover:border-ink/25 hover:text-ink disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-secondary"
      >
        <Arrow className="size-4" />
      </button>
    </div>
  );
}

/**
 * Wraps a block of filters. On a wide screen they are always shown; on a phone they sit
 * behind a "Filter & sort" button, which opens by itself when something is already applied
 * so a filtered list never looks unexplained.
 */
export function FilterPanel({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(activeCount > 0);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-semibold text-ink-secondary transition-colors hover:border-ink/25 hover:text-ink lg:hidden"
      >
        <SlidersHorizontal className="size-3.5" />
        {t("Filter & urutkan")}
        {activeCount > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[10px] text-white">{activeCount}</span>
        )}
      </button>
      <div className={cn("mt-3 lg:mt-0", open ? "block" : "hidden lg:block")}>{children}</div>
    </div>
  );
}

export function SortHeader({
  field,
  children,
  className,
  align = "left",
}: {
  field: string;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const params = useSearchParams();
  const update = useUpdateParams();
  const activeField = params.get("sort");
  const dir = params.get("dir") ?? "asc";
  const active = activeField === field;
  return (
    <button
      onClick={() =>
        update(
          {
            sort: field,
            dir: active && dir === "asc" ? "desc" : "asc",
          },
          false,
        )
      }
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-ink",
        align === "right" && "flex-row-reverse",
        active ? "text-ink" : "",
        className,
      )}
    >
      {children}
      <span className="text-[9px] text-ink-muted">
        {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const { t, fmt } = useI18n();
  const update = useUpdateParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between border-t border-line px-1 py-3 text-xs text-ink-muted">
      <span>
        {t("{from}–{to} dari {total}", { from, to, total: fmt.number(total) })}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => update({ page: String(page - 1) }, false)}
          className="grid size-7 place-items-center rounded-md border border-line transition-colors hover:bg-surface-2 disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <button
          disabled={page >= pages}
          onClick={() => update({ page: String(page + 1) }, false)}
          className="grid size-7 place-items-center rounded-md border border-line transition-colors hover:bg-surface-2 disabled:opacity-40"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
