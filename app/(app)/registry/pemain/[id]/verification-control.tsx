"use client";

import * as React from "react";
import { CheckCircle2, Flag, XCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { setVerification } from "../actions";
import { useT } from "@/lib/i18n/client";
import { msg } from "@/lib/i18n/translate";

const OPTIONS = [
  { value: "verified", label: msg("Verifikasi::tombol"), icon: CheckCircle2, tone: "text-success" },
  { value: "flagged", label: msg("Tandai"), icon: Flag, tone: "text-warn" },
  { value: "pending", label: msg("Menunggu"), icon: Clock, tone: "text-info" },
  { value: "rejected", label: msg("Tolak"), icon: XCircle, tone: "text-danger" },
] as const;

export function VerificationControl({
  playerId,
  current,
  notes,
}: {
  playerId: string;
  current: string;
  notes: string | null;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const [noteText, setNoteText] = React.useState(notes ?? "");

  const submit = (status: string) => {
    const fd = new FormData();
    fd.set("id", playerId);
    fd.set("status", status);
    fd.set("notes", noteText);
    start(async () => {
      try {
        await setVerification(fd);
        toast.success(t("Status verifikasi diperbarui"));
      } catch (e) {
        toast.error(t("Gagal"), e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => (
          <Button
            key={o.value}
            type="button"
            variant={current === o.value ? "secondary" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => submit(o.value)}
            className="justify-start"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <o.icon className={`size-3.5 ${o.tone}`} />
            )}
            {t(o.label)}
          </Button>
        ))}
      </div>
      <Textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder={t("Catatan verifikasi (mis. selisih data akta / KK)…")}
        className="text-xs"
      />
      <p className="text-[11px] text-ink-muted">
        {t("Perubahan status tercatat pada jejak audit.")}
      </p>
    </div>
  );
}
