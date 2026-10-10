"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { createCompetition, updateCompetition } from "./actions";
import type { FormState } from "@/lib/form";
import type { Competition } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

/**
 * A Turnamen is only four things — name, season, description, organizer.
 * Everything else (age group, format, dates, SSBs) belongs to its KUs.
 */
export function CompetitionForm({ competition }: { competition?: Competition }) {
  const action = competition ? updateCompetition.bind(null, competition.id) : createCompetition;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const fe = state?.fieldErrors ?? {};
  const sv = state?.values ?? {};
  const val = (key: keyof Competition & string, fallback = "") => {
    if (key in sv) return sv[key];
    const v = competition?.[key];
    return v == null ? fallback : String(v);
  };

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Nama turnamen" error={fe.name}>
        <Input
          name="name"
          required
          defaultValue={val("name")}
          placeholder="mis. Liga Pelajar Jabodetabek"
          autoFocus={!competition}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Musim" error={fe.season} hint="Tahun atau musim, mis. 2026 atau 2026/2027">
          <Input name="season" required defaultValue={val("season", String(new Date().getFullYear()))} maxLength={16} />
        </Field>
        <Field label="Penyelenggara" error={fe.organizer}>
          <Input name="organizer" defaultValue={val("organizer")} placeholder="mis. Asprov PSSI DKI Jakarta" />
        </Field>
      </div>

      <Field label="Deskripsi" error={fe.description} hint="Opsional — ringkasan turnamen untuk operator dan peserta">
        <Textarea name="description" rows={4} defaultValue={val("description")} placeholder="Ringkasan turnamen" />
      </Field>

      {state?.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : competition ? <Save /> : <Plus />}
          {competition ? "Simpan perubahan" : "Buat turnamen"}
        </Button>
        {competition && (
          <Button variant="ghost" href={`/kompetisi/${competition.id}`}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}
