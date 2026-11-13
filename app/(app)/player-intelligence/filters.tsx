"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { paramValue, queryHref, type FilterField, type IntelligenceParams } from "@/lib/intelligence-filters";

export function IntelligenceFilters({ params, fields, title, preserve = ["player", "players"], compact = false }: {
  params: IntelligenceParams; fields: FilterField[]; title?: string; preserve?: string[]; compact?: boolean;
}) {
  const t = useT();
  const heading = title ?? t("Filter & pengurutan");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const retained = Object.fromEntries(preserve.map((key) => [key, paramValue(params, key)]));
  const active = fields.filter((f) => {
    const value = paramValue(params, f.key);
    return value && value !== (f.defaultValue ?? "");
  });
  const fieldValue = (field: FilterField) => {
    const value = paramValue(params, field.key) || field.defaultValue || "";
    return [...(field.options ?? []), ...(field.groups ?? []).flatMap((g) => g.options)].find((o) => o.value === value)?.label ?? value;
  };
  const sortField = fields.find((f) => f.key === "sort" || f.key === "formulaSort");
  const minApps = fields.find((f) => f.key === "minApps");
  return <form key={JSON.stringify(params)} method="get" action={pathname} onSubmit={(event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of values) if (typeof value === "string" && value.trim()) next.set(key, value.trim());
    setExpanded(false);
    start(() => router.push(pathname + "?" + next.toString(), { scroll: false }));
  }} className="rounded-2xl border border-line bg-surface-2/40 p-3 sm:p-4" aria-label={heading}>
    <div className="flex items-start justify-between gap-3">
      <button type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((value) => !value)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-brand">
        <Filter className="size-3.5 shrink-0" /><span>{heading}</span>
        {!!active.length && <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">{t("{n} aktif", { n: active.length })}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-medium text-ink-muted">{expanded ? t("Tutup") : t("Buka")}{expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
      </button>
      {!!active.length && !expanded && <Link href={pathname + queryHref(retained, {})} scroll={false} className="pt-1 text-xs font-semibold text-brand hover:underline">{t("Reset")}</Link>}
    </div>
    {!expanded && <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-ink-muted">
      {active.slice(0, 5).map((f) => <span key={f.key} className="max-w-full truncate rounded-full border border-line bg-surface px-2 py-1">{f.label}: {fieldValue(f)}</span>)}
      {active.length > 5 && <span className="self-center">{t("+{n} lainnya", { n: active.length - 5 })}</span>}
      <span className="self-center">{minApps ? t("Min. {n} penampilan · ", { n: fieldValue(minApps) }) : ""}{sortField ? t("Urutan: {sort}", { sort: fieldValue(sortField) }) + (fields.some((f) => f.key === "order") ? ((paramValue(params, "order") || fields.find((f) => f.key === "order")?.defaultValue) === "asc" ? " ↑" : " ↓") : "") : !active.length ? t("Semua data") : ""}</span>
    </div>}
    <div id={contentId} hidden={!expanded} className="mt-3 space-y-3 border-t border-line pt-3">
    {Object.entries(retained).map(([key, value]) => value && <input key={key} type="hidden" name={key} value={value} />)}
    <fieldset disabled={pending} className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
      {fields.map((field) => <label key={field.key} className="min-w-0 space-y-1 text-xs font-medium text-ink-secondary">
        <span className="block">{field.label}</span>
        {field.options || field.groups ? <Select name={field.key} defaultValue={paramValue(params, field.key) || field.defaultValue || ""} className="text-xs">
          {field.placeholder && <option value="">{field.placeholder}</option>}
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {field.groups?.map((g) => <optgroup key={g.label} label={g.label}>{g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}
        </Select> : <Input name={field.key} type={field.type ?? "text"} placeholder={field.placeholder} min={field.min} max={field.max} step={field.step} maxLength={field.type ? undefined : 200} defaultValue={paramValue(params, field.key) || field.defaultValue || ""} className="text-xs" />}
      </label>)}
    </fieldset>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="size-3.5 animate-spin" />}{t("Terapkan")}</Button>
      <Link href={pathname + queryHref(retained, {})} scroll={false} className="text-xs font-semibold text-brand hover:underline">{t("Reset filter")}</Link>
    </div>
    </div>
  </form>;
}

export function IntelligencePagination({ params, total, page, pageSize, label }: {
  params: IntelligenceParams; total: number; page: number; pageSize: number; label?: string;
}) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav aria-label={t("Halaman hasil")} className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-3 text-[11px] text-ink-muted">
    <span>{t("{from}–{to} dari {total} {label}", { from: total ? (page - 1) * pageSize + 1 : 0, to: Math.min(page * pageSize, total), total, label: label ?? t("hasil") })}</span>
    <div className="flex items-center gap-3">
      {page > 1 && <Link href={queryHref(params, { page: String(page - 1) })} scroll={false} className="font-semibold text-brand">{t("← Sebelumnya")}</Link>}
      <span>{page} / {pages}</span>
      {page < pages && <Link href={queryHref(params, { page: String(page + 1) })} scroll={false} className="font-semibold text-brand">{t("Berikutnya →")}</Link>}
    </div>
  </nav>;
}
