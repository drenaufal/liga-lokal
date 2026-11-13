"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OperatorForm, type CompetitionChoice, type OperatorData } from "./operator-form";
import { useT } from "@/lib/i18n/client";

export function OperatorEdit({ operator, competitions }: { operator: OperatorData; competitions: CompetitionChoice[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("Kelola akun")}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title={t("Kelola akun operator")} description={t("Ubah nama, email, kata sandi, status akun, atau turnamen yang ditugaskan.")}>
      <div className="p-6"><OperatorForm operator={operator} competitions={competitions} onDone={() => setOpen(false)} /></div>
    </DialogContent></Dialog>
  </>;
}
