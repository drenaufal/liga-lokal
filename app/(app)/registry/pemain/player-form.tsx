"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  BookOpen,
  GraduationCap,
  IdCard,
  Loader2,
  Save,
  ScrollText,
  UserPlus,
  Users,
} from "lucide-react";
import { checkNisn, createPlayer, updatePlayer, type PlayerFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { ImageUpload } from "@/components/app/image-upload";
import { DocumentUpload, type DocumentMeta } from "@/components/app/document-upload";
import { FootPicker, type Foot } from "@/components/app/foot-icon";
import { POSITION_LINES, POSITION_NAME } from "@/lib/positions";
import { PLAYER_DOCUMENTS, type PlayerDocumentKey } from "@/lib/player-documents";
import type { Player } from "@/lib/db/schema";

type AgeOption = {
  id: string;
  code: string;
  /** Oldest eligible birth year: a player born in or after it may play in the category. */
  birthYearFrom: number | null;
};

const DOC_ICON: Record<PlayerDocumentKey, React.ComponentType<{ className?: string }>> = {
  kiaUrl: IdCard,
  kkUrl: Users,
  aktaUrl: ScrollText,
  ijazahUrl: GraduationCap,
  raporUrl: BookOpen,
};

export function PlayerForm({
  clubs,
  ageCategories,
  player,
  docMeta,
}: {
  clubs: { id: string; name: string }[];
  ageCategories: AgeOption[];
  /** When present the form edits this player instead of registering a new one. */
  player?: Player;
  /** File name / size of already-uploaded documents (only loaded for people who may open them). */
  docMeta?: Partial<Record<PlayerDocumentKey, DocumentMeta | null>>;
}) {
  const action = player ? updatePlayer.bind(null, player.id) : createPlayer;
  const [state, formAction, pending] = useActionState<PlayerFormState, FormData>(
    action,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  const sv = state?.values ?? {};
  const val = (key: keyof Player & string) => {
    if (key in sv) return sv[key];
    const v = player?.[key];
    return v == null ? "" : String(v);
  };

  const [dob, setDob] = React.useState(val("dob"));
  const ageRef = React.useRef<HTMLSelectElement>(null);
  const birthYear = dob ? Number(dob.slice(0, 4)) : null;
  // A category only has an upper age limit, so a young player fits several; the
  // suggestion is the tightest one (the youngest category he still qualifies for).
  const bestFit = (year: number) =>
    ageCategories
      .filter((a) => a.birthYearFrom != null && year >= a.birthYearFrom)
      .sort((a, b) => (b.birthYearFrom ?? 0) - (a.birthYearFrom ?? 0))[0];
  const suggested = birthYear ? bestFit(birthYear) : undefined;

  const onDob = (value: string) => {
    setDob(value);
    // Fill the category automatically only while it is still unset.
    const match = bestFit(Number(value.slice(0, 4)));
    if (match && ageRef.current && !ageRef.current.value) ageRef.current.value = match.id;
  };

  /* NISN — required and unique; checked against the registry while typing. */
  const [nisn, setNisn] = React.useState(val("nisn"));
  const [nisnCheck, setNisnCheck] = React.useState<{ value: string; ok: boolean; message?: string } | null>(null);
  React.useEffect(() => {
    if (!/^\d{10}$/.test(nisn)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await checkNisn(nisn, player?.id);
        if (!cancelled) setNisnCheck({ value: nisn, ...(r.ok ? { ok: true } : { ok: false, message: r.message }) });
      } catch {
        if (!cancelled) setNisnCheck(null);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [nisn, player?.id]);
  // a result only counts for the exact NISN it was computed for
  const nisnState = nisnCheck && nisnCheck.value === nisn ? nisnCheck : null;
  const nisnError = fe.nisn ?? (nisnState && !nisnState.ok ? nisnState.message : undefined);

  /* A player can be registered with at most two clubs. */
  const [clubId, setClubId] = React.useState(val("clubId"));
  const [secondClubId, setSecondClubId] = React.useState(val("secondClubId"));
  const onPrimaryClub = (id: string) => {
    setClubId(id);
    if (id && id === secondClubId) setSecondClubId("");
  };

  return (
    <form action={formAction} className="space-y-6">
      <Section title="Identitas pemain">
        <div className="sm:col-span-2">
          <ImageUpload
            name="photoUrl"
            label="Foto pemain"
            displayName={player?.fullName ?? "Pemain Baru"}
            shape="square"
            defaultValue={player?.photoUrl}
          />
          {fe.photoUrl && <p className="mt-1 text-[11px] text-danger">{fe.photoUrl}</p>}
        </div>
        <Field label="Nama lengkap" error={fe.fullName} className="sm:col-span-2">
          <Input name="fullName" required defaultValue={val("fullName")} placeholder="mis. Arya Pratama" />
        </Field>
        <Field label="Nama panggilan" error={fe.nickname}>
          <Input name="nickname" defaultValue={val("nickname")} placeholder="Opsional" />
        </Field>
        <Field
          label="NISN (wajib)"
          error={nisnError}
          hint="Nomor Induk Siswa Nasional · 10 digit · tidak boleh sama dengan pemain lain"
        >
          <Input
            name="nisn"
            required
            value={nisn}
            onChange={(e) => setNisn(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            minLength={10}
            maxLength={10}
            pattern="\d{10}"
            title="10 digit angka"
            placeholder="0123456789"
            aria-invalid={!!nisnError}
            className="font-mono tracking-wider"
          />
          {nisnState?.ok && <p className="mt-1 text-[11px] text-success">✓ NISN tersedia</p>}
        </Field>
        <Field label="Tanggal lahir" error={fe.dob}>
          <Input name="dob" type="date" required defaultValue={val("dob")} onChange={(e) => onDob(e.target.value)} />
        </Field>
        <Field label="Tempat lahir" error={fe.birthPlace}>
          <Input name="birthPlace" defaultValue={val("birthPlace")} placeholder="Kota kelahiran" />
        </Field>
      </Section>

      <Section title="Profil bermain">
        <Field label="Posisi" error={fe.position} hint="13 peran: kiper, bek, gelandang, dan penyerang">
          <Select name="position" required defaultValue={val("position")}>
            <option value="" disabled>
              Pilih posisi…
            </option>
            {POSITION_LINES.map((l) => (
              <optgroup key={l.line} label={l.label}>
                {l.roles.map((r) => (
                  <option key={r} value={r}>
                    {r} — {POSITION_NAME[r]}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Nomor punggung" error={fe.jerseyNumber}>
          <Input name="jerseyNumber" type="number" min={1} max={99} defaultValue={val("jerseyNumber")} />
        </Field>
        <Field label="Kaki dominan" error={fe.foot} className="sm:col-span-2">
          <FootPicker name="foot" defaultValue={(val("foot") || "right") as Foot} />
        </Field>
        <Field label="Tinggi (cm)" error={fe.heightCm}>
          <Input name="heightCm" type="number" min={90} max={220} defaultValue={val("heightCm")} />
        </Field>
        <Field label="Berat (kg)" error={fe.weightKg}>
          <Input name="weightKg" type="number" min={20} max={150} defaultValue={val("weightKg")} />
        </Field>
      </Section>

      <Section title="Klub & kategori">
        <Field label="Klub utama" error={fe.clubId}>
          <Select name="clubId" value={clubId} onChange={(e) => onPrimaryClub(e.target.value)}>
            <option value="">Tanpa klub</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Klub kedua (opsional)"
          error={fe.secondClubId}
          hint={
            clubId
              ? "Maksimal 2 klub. Statistik pemain dapat difilter per klub."
              : "Pilih klub utama dahulu untuk menambah klub kedua."
          }
        >
          <Select
            name="secondClubId"
            value={secondClubId}
            onChange={(e) => setSecondClubId(e.target.value)}
            disabled={!clubId}
          >
            <option value="">Tidak ada</option>
            {clubs
              .filter((c) => c.id !== clubId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field
          label="Kategori usia"
          error={fe.ageCategoryId}
          className="sm:col-span-2"
          hint={
            suggested
              ? `Sesuai tahun lahir ${birthYear}: ${suggested.code}`
              : birthYear
                ? `Belum ada kategori untuk kelahiran ${birthYear}`
                : undefined
          }
        >
          <Select ref={ageRef} name="ageCategoryId" defaultValue={val("ageCategoryId")}>
            <option value="">Belum ditentukan</option>
            {ageCategories.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Orang tua / wali">
        <Field label="Nama wali" error={fe.guardianName}>
          <Input name="guardianName" defaultValue={val("guardianName")} placeholder="Orang tua / wali" />
        </Field>
        <Field label="Kontak wali" error={fe.guardianPhone}>
          <Input name="guardianPhone" defaultValue={val("guardianPhone")} placeholder="08xx" />
        </Field>
      </Section>

      <Section title="Dokumen pemain">
        <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-[11px] leading-relaxed text-ink-muted sm:col-span-2">
          Dokumen bersifat <strong className="text-ink-secondary">privat</strong> — hanya admin & operator yang dapat
          membukanya. Boleh diunggah bertahap; kelengkapannya tampil di profil dan daftar pemain.
        </p>
        {PLAYER_DOCUMENTS.map((d) => (
          <div key={d.key} className="sm:col-span-2">
            <DocumentUpload
              name={d.key}
              label={d.label}
              hint={d.hint}
              icon={DOC_ICON[d.key]}
              defaultValue={player?.[d.key]}
              defaultMeta={docMeta?.[d.key]}
              error={fe[d.key]}
            />
          </div>
        ))}
      </Section>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || nisnState?.ok === false}>
          {pending ? <Loader2 className="animate-spin" /> : player ? <Save /> : <UserPlus />}
          {player ? "Simpan perubahan" : "Daftarkan pemain"}
        </Button>
        {player && (
          <Button variant="ghost" href={`/registry/pemain/${player.id}`}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
