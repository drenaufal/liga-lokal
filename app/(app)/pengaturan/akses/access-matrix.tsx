"use client";

import { Fragment, useMemo, useRef, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Lock, Search, ShieldCheck } from "lucide-react";
import { saveAccessMatrix } from "./actions";
import {
  ALL_CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_INFO,
  EDITABLE_ROLES,
  REQUIRES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  isHoldable,
  normalizeGrants,
  type Capability,
  type EditableRole,
  type GrantMatrix,
} from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/client";

const RICH = { b: (children: ReactNode) => <strong className="text-ink">{children}</strong> };

const sameSet = (a: readonly Capability[], b: readonly Capability[]) =>
  a.length === b.length && a.every((c) => b.includes(c));

/** A checkbox that can show "some of the group" (used on the group header rows). */
function GroupBox({
  state,
  disabled,
  label,
  onChange,
}: {
  state: "all" | "some" | "none";
  disabled?: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 cursor-pointer accent-[var(--color-brand)] disabled:cursor-not-allowed"
      checked={state === "all"}
      disabled={disabled}
      aria-label={label}
      // none / some → switch the whole group on; all → switch it off
      onChange={() => onChange(state !== "all")}
    />
  );
}

export function AccessMatrix({ saved: initial, defaults }: { saved: GrantMatrix; defaults: GrantMatrix }) {
  const t = useT();
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const dirtyRoles = useMemo(
    () => EDITABLE_ROLES.filter((r) => !sameSet(draft[r], saved[r])),
    [draft, saved],
  );
  const dirty = dirtyRoles.length > 0;
  const anyCustom = EDITABLE_ROLES.some((r) => !sameSet(draft[r], defaults[r]));

  const q = query.trim().toLowerCase();
  const matches = (cap: Capability) =>
    !q ||
    `${CAPABILITY_INFO[cap].label} ${CAPABILITY_INFO[cap].description} ${t.dyn(CAPABILITY_INFO[cap].label)} ${t.dyn(CAPABILITY_INFO[cap].description)} ${cap}`.toLowerCase().includes(q);

  /** Turning something on also turns on what it needs; turning it off drops what depended on it. */
  function setMany(role: EditableRole, caps: readonly Capability[], on: boolean) {
    setDraft((cur) => {
      const next = new Set(cur[role]);
      for (const cap of caps) {
        if (!isHoldable(role, cap)) continue;
        if (on) for (let c: Capability | undefined = cap; c; c = REQUIRES[c]) next.add(c);
        else next.delete(cap);
      }
      return { ...cur, [role]: normalizeGrants(role, next) };
    });
  }

  function submit() {
    setError("");
    start(async () => {
      try {
        await saveAccessMatrix(draft);
        setSaved(draft);
        toast.success(t("Hak akses peran disimpan"), t("Perubahan langsung berlaku untuk seluruh akun."));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Gagal menyimpan hak akses."));
      }
    });
  }

  const differsFromDefault = (role: EditableRole, cap: Capability) =>
    draft[role].includes(cap) !== defaults[role].includes(cap);

  const toggleGroup = (id: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allCollapsed = collapsed.size === CAPABILITY_GROUPS.length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-start gap-3 text-xs text-ink-secondary">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
          <div className="min-w-0 flex-1 space-y-1">
            <p>{rich(t("Setiap <b>menu</b> dan <b>fitur di dalamnya</b> (tambah, ubah, hapus, verifikasi, konfirmasi, dll.) dapat diizinkan atau ditutup per peran. Menu yang tidak diizinkan tidak muncul di sidebar, tab, maupun pencarian, dan aksinya juga ditolak oleh server."), RICH)}</p>
            <p>
              {rich(t("<b>Super Admin</b> (peran tersembunyi, hanya terlihat oleh Anda) selalu memiliki seluruh izin dan tidak dapat diubah, sehingga akses tidak mungkin terkunci. Mengaktifkan suatu fitur otomatis mengaktifkan menu dasarnya; mematikan menu ikut mematikan fitur turunannya. Izin bertanda"), RICH)}{" "}
              <Lock className="inline size-3 align-[-1px]" /> {t("tidak dapat diberikan kepada peran tersebut.")}
            </p>
            <p>
              {t("Kolom yang disorot kuning berbeda dari pengaturan bawaan sistem. Perubahan baru berlaku setelah disimpan dan tercatat di jejak audit.")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Cari menu atau fitur…")}
            aria-label={t("Cari menu atau fitur")}
            className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-brand/50"
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(CAPABILITY_GROUPS.map((g) => g.id)))}
        >
          {allCollapsed ? t("Buka semua grup") : t("Ciutkan semua grup")}
        </Button>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-ink-muted">
          <Badge tone="info" className="px-1.5 py-0.5 text-[9px]">{t("Menu")}</Badge> {t("membuka halaman / tab")}
          <Badge tone="neutral" className="px-1.5 py-0.5 text-[9px]">{t("Fitur")}</Badge> {t("tindakan di dalamnya")}
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="max-h-[calc(100dvh-15rem)] min-h-[24rem] overflow-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left align-bottom">
                <th className="sticky left-0 top-0 z-30 border-b border-line bg-surface px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  {t("Menu & fitur")}
                </th>
                <th className="sticky top-0 z-20 border-b border-line bg-surface px-2 py-3 text-center">
                  <span className="block text-xs font-semibold text-ink">{t(ROLE_LABEL.super_admin)}</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-ink-muted">
                    {t("Tetap · {n}", { n: ALL_CAPABILITIES.length })}
                  </span>
                </th>
                {EDITABLE_ROLES.map((role) => (
                  <th
                    key={role}
                    className="sticky top-0 z-20 border-b border-line bg-surface px-2 py-3 text-center"
                    title={t(ROLE_DESCRIPTION[role])}
                  >
                    <span className="block text-xs font-semibold text-ink">{t(ROLE_LABEL[role])}</span>
                    <span className="mt-0.5 block text-[10px] font-normal text-ink-muted">
                      {draft[role].length}/{ALL_CAPABILITIES.filter((c) => isHoldable(role, c)).length}
                      {dirtyRoles.includes(role) && <span className="text-warn"> · {t("diubah")}</span>}
                    </span>
                    <span className="mt-1 flex items-center justify-center gap-2 text-[10px] font-medium">
                      <button
                        type="button"
                        disabled={pending || sameSet(draft[role], defaults[role])}
                        onClick={() => setDraft((cur) => ({ ...cur, [role]: defaults[role] }))}
                        className="text-brand hover:underline disabled:pointer-events-none disabled:text-ink-muted/60 disabled:no-underline"
                      >
                        {t("Bawaan")}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setMany(role, ALL_CAPABILITIES, true)}
                        className="text-brand hover:underline disabled:pointer-events-none disabled:text-ink-muted/60"
                      >
                        {t("Semua")}
                      </button>
                      <button
                        type="button"
                        disabled={pending || draft[role].length === 0}
                        onClick={() => setDraft((cur) => ({ ...cur, [role]: [] }))}
                        className="text-brand hover:underline disabled:pointer-events-none disabled:text-ink-muted/60 disabled:no-underline"
                      >
                        {t("Kosong")}
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_GROUPS.map((group) => {
                const visible = group.caps.filter(matches);
                if (visible.length === 0) return null;
                const open = !collapsed.has(group.id) || !!q;
                return (
                  <Fragment key={group.id}>
                    <tr className="bg-surface-2">
                      <td className="sticky left-0 z-10 border-b border-line-soft bg-surface-2 px-4 py-2">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.id)}
                          aria-expanded={open}
                          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary hover:text-ink"
                        >
                          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          {t.dyn(group.title)}
                          <span className="font-normal normal-case tracking-normal text-ink-muted">
                            · {t("{n} izin", { n: group.caps.length })}
                          </span>
                        </button>
                      </td>
                      <td className="border-b border-line-soft bg-surface-2 px-2 py-2 text-center">
                        <Check className="mx-auto size-4 text-success" aria-label={t("Seluruh izin")} />
                      </td>
                      {EDITABLE_ROLES.map((role) => {
                        const holdable = group.caps.filter((c) => isHoldable(role, c));
                        const have = holdable.filter((c) => draft[role].includes(c)).length;
                        const state = have === 0 ? "none" : have === holdable.length ? "all" : "some";
                        return (
                          <td key={role} className="border-b border-line-soft bg-surface-2 px-2 py-2 text-center">
                            {holdable.length === 0 ? (
                              <Lock className="mx-auto size-3.5 text-ink-muted/60" aria-hidden />
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <GroupBox
                                  state={state}
                                  disabled={pending}
                                  label={t("Semua izin {group} — {role}", { group: t.dyn(group.title), role: t(ROLE_LABEL[role]) })}
                                  onChange={(on) => setMany(role, holdable, on)}
                                />
                                <span className="text-[10px] tabular-nums text-ink-muted">
                                  {have}/{holdable.length}
                                </span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {open &&
                      visible.map((cap) => {
                        const info = CAPABILITY_INFO[cap];
                        const need = REQUIRES[cap];
                        return (
                          <tr key={cap} className="group/row hover:bg-surface-2/40">
                            <td className="sticky left-0 z-10 max-w-[26rem] border-b border-line-soft bg-surface px-4 py-2.5 align-top group-hover/row:bg-surface-2">
                              <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink">
                                {t.dyn(info.label)}
                                <Badge
                                  tone={info.kind === "menu" ? "info" : "neutral"}
                                  className="px-1.5 py-0.5 text-[9px]"
                                >
                                  {info.kind === "menu" ? t("Menu") : t("Fitur")}
                                </Badge>
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                                {t.dyn(info.description)}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted">{cap}</code>
                                {need && (
                                  <span className="text-[10px] text-ink-muted">
                                    {t("memerlukan: {label}", { label: t.dyn(CAPABILITY_INFO[need].label) })}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="border-b border-line-soft px-2 py-2.5 text-center align-middle">
                              <Check className="mx-auto size-4 text-success" aria-label={t("Diizinkan")} />
                            </td>
                            {EDITABLE_ROLES.map((role) => {
                              const locked = !isHoldable(role, cap);
                              const checked = draft[role].includes(cap);
                              const custom = !locked && differsFromDefault(role, cap);
                              return (
                                <td
                                  key={role}
                                  className={cn(
                                    "border-b border-line-soft px-2 py-2.5 text-center align-middle",
                                    custom && "bg-warn/10",
                                  )}
                                  title={custom ? t("Berbeda dari pengaturan bawaan") : undefined}
                                >
                                  {locked ? (
                                    <Lock
                                      className="mx-auto size-3.5 text-ink-muted/60"
                                      aria-label={t("Tidak dapat diberikan ke peran ini")}
                                    />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      className="size-4 cursor-pointer accent-[var(--color-brand)] disabled:cursor-not-allowed"
                                      checked={checked}
                                      disabled={pending}
                                      aria-label={t("{label} — {role}", { label: t.dyn(info.label), role: t(ROLE_LABEL[role]) })}
                                      onChange={(e) => setMany(role, [cap], e.target.checked)}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {q && CAPABILITY_GROUPS.every((g) => g.caps.filter(matches).length === 0) && (
            <p className="p-8 text-center text-xs text-ink-muted">{t("Tidak ada menu atau fitur yang cocok dengan “{query}”.", { query })}</p>
          )}
        </div>
      </Card>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <div className="sticky bottom-24 z-20 flex flex-wrap items-center gap-2 rounded-3xl bg-night px-4 py-2.5 text-white sm:rounded-full shadow-[0_18px_40px_-12px_rgba(20,20,20,0.65)] lg:bottom-4">
        <span className="mr-auto text-xs text-night-muted">
          {dirty
            ? t("{n} peran belum disimpan: {roles}", { n: dirtyRoles.length, roles: dirtyRoles.map((r) => t(ROLE_LABEL[r])).join(", ") })
            : t("Tidak ada perubahan yang belum disimpan.")}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="text-night-muted hover:bg-night-2 hover:text-white"
          disabled={pending || !anyCustom}
          onClick={() => setConfirmReset(true)}
        >
          {t("Kembalikan semua ke bawaan")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-night-muted hover:bg-night-2 hover:text-white"
          disabled={pending || !dirty}
          onClick={() => setDraft(saved)}
        >
          {t("Batalkan")}
        </Button>
        <Button size="sm" disabled={pending || !dirty} onClick={submit}>
          {pending ? t("Menyimpan…") : t("Simpan perubahan")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t("Kembalikan semua ke bawaan?")}
        description={t("Seluruh peran akan dikembalikan ke pengaturan bawaan sistem. Perubahan baru berlaku setelah Anda menekan Simpan.")}
        confirmLabel={t("Kembalikan")}
        onConfirm={() => setDraft(defaults)}
      />
    </div>
  );
}
