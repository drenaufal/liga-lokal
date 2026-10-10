"use client";

import * as React from "react";
import { Upload, Loader2, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { uploadCsv } from "./actions";
import { rethrowControlFlow } from "@/lib/action-helpers";
import { cn } from "@/lib/utils";

const SAMPLE: Record<string, string> = {
  players: `full_name,nickname,nisn,dob,position,club_short,age_category,jersey_number,height_cm,weight_kg,foot,birth_place,guardian_name,guardian_phone
Rangga Aditya,Angga,0131234567,2013-04-12,ST,GMF,KU-14,9,158,46,right,Depok,Bapak Slamet,081234567890
Bima Sakti,,0129876543,2012-11-03,CMF,GMF,KU-14,8,161,49,left,Bogor,Ibu Rini,081298765432
Rangga Aditya,,0131234568,2013-04-12,ST,GMF,KU-14,19,157,45,right,Depok,Bapak Slamet,081234567890
Reza Fahlevi,Levi,0147654321,2014-02-20,CB,XYZ,KU-16,4,,,kanan,,,
Nabil Ananta,,12345,not-a-date,GK,DBJ,KU-12,1,150,42,right,Jakarta,,`,
  clubs: `name,short_name,city,province,address,askot,asprov,type,founded_year,contact_email
SSB Bekasi Raya,BRU,Bekasi,Jawa Barat,Jl. Raya Bekasi No. 8,Askot PSSI Bekasi,Asprov PSSI Jawa Barat,club,2018,sekretariat@bru.or.id
Akademi Sriwijaya Muda,ASM,Palembang,Sumatera Selatan,Jl. Sudirman No. 21,Askot PSSI Palembang,Asprov PSSI Sumatera Selatan,academy,2015,info@asm.id`,
  referees: `full_name,license_level,license_number,license_expiry,city,askot,phone,email
Hendra Kusuma,C-2,WST-2026-2001,2027-06-30,Depok,Askot PSSI Depok,081200001111,hendra@pssi.or.id
Yanto Prawira,C-3,WST-2026-2002,2025-01-15,Bogor,Askot PSSI Bogor,081200002222,`,
  venues: `name,city,province,capacity,field_count,surface
Lapangan Merdeka Depok,Depok,Jawa Barat,1500,2,natural
GOR Futsal Cibubur,Jakarta Timur,DKI Jakarta,400,3,futsal`,
};

export function UploadPanel() {
  const [entity, setEntity] = React.useState("players");
  const [file, setFile] = React.useState<File | null>(null);
  const [pending, start] = React.useTransition();
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!file) {
      toast.error("Pilih berkas CSV terlebih dahulu");
      return;
    }
    const fd = new FormData();
    fd.set("entity", entity);
    fd.set("file", file);
    start(async () => {
      try {
        await uploadCsv(fd);
      } catch (e) {
        rethrowControlFlow(e);
        toast.error("Unggah gagal", e instanceof Error ? e.message : undefined);
      }
    });
  };

  const useSample = () => {
    const blob = new File([SAMPLE[entity]], `contoh-${entity}.csv`, { type: "text/csv" });
    setFile(blob);
    toast.success("Contoh data dimuat", "Klik 'Mulai Pipeline' untuk memproses");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="size-4" /> Unggah CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-secondary">Jenis entitas</span>
          <Select value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="players">Pemain</option>
            <option value="clubs">Klub & Akademi</option>
            <option value="referees">Wasit</option>
            <option value="venues">Venue</option>
          </Select>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) setFile(f);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
            drag ? "border-brand/60 bg-brand/5" : "border-line hover:border-ink/25",
          )}
        >
          <FileText className="size-6 text-ink-muted" />
          {file ? (
            <span className="text-xs font-medium text-ink">{file.name}</span>
          ) : (
            <>
              <span className="text-xs text-ink-secondary">Seret berkas CSV ke sini</span>
              <span className="text-[10px] text-ink-muted">atau klik untuk memilih</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={submit} className="flex-1">
            {pending ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
            Mulai Pipeline
          </Button>
          <Button size="sm" variant="outline" onClick={useSample}>
            Muat contoh
          </Button>
        </div>
        <p className="text-[10px] text-ink-muted">
          Contoh data pemain sengaja memuat duplikat, tanggal salah, dan klub tak dikenal
          untuk mendemonstrasikan pipeline QA.
        </p>
      </CardContent>
    </Card>
  );
}
