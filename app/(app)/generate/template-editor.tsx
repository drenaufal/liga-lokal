"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlignCenter, AlignLeft, AlignRight, ImageIcon, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import {
  FIELD_LABEL,
  FONT_LABEL,
  PRINT_FONTS,
  defaultLayout,
  type PrintFieldKey,
  type PrintKind,
  type PrintLayout,
  type PrintPhotoBox,
  type PrintRecord,
  type PrintTextField,
} from "@/lib/print/layout";
import { PrintPreview } from "./print-preview";
import { saveTemplateLayout } from "./actions";

type Selected = PrintFieldKey | "photo" | null;
type Drag = { key: Selected; mode: "move" | "resize"; x0: number; y0: number; start: { x: number; y: number; w: number; h: number }; rect: DOMRect };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 10000) / 10000;

/**
 * Where each value goes on the template. Drag a value (or the photo frame) on the preview, or
 * move the selected one with the arrow keys (Shift = bigger steps); the panel sets its font, size,
 * colour and alignment. The preview is drawn by the PDF renderer itself.
 */
export function TemplateEditor({
  kind,
  competitionId,
  template,
  sample,
  onDone,
}: {
  kind: PrintKind;
  competitionId: string;
  template: { imageUrl: string; width: number; height: number; layout: PrintLayout };
  sample: PrintRecord;
  onDone: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [layout, setLayout] = React.useState<PrintLayout>(template.layout);
  const [selected, setSelected] = React.useState<Selected>(layout.fields.find((f) => f.visible)?.key ?? null);
  const [pending, start] = React.useTransition();
  const drag = React.useRef<Drag | null>(null);

  const field = layout.fields.find((f) => f.key === selected) ?? null;
  const setField = (key: PrintFieldKey, patch: Partial<PrintTextField>) =>
    setLayout((l) => ({ ...l, fields: l.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  const setPhoto = (patch: Partial<PrintPhotoBox>) => setLayout((l) => (l.photo ? { ...l, photo: { ...l.photo, ...patch } } : l));
  const heightMm = Math.round(layout.widthMm * (template.height / template.width));

  const begin = (e: React.PointerEvent<HTMLElement>, key: Selected, mode: Drag["mode"]) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget.closest("[data-print-preview]") as HTMLElement).getBoundingClientRect();
    const f = layout.fields.find((x) => x.key === key);
    const p = layout.photo;
    const startBox = key === "photo" && p ? { x: p.x, y: p.y, w: p.w, h: p.h } : { x: f?.x ?? 0, y: f?.y ?? 0, w: f?.w ?? 0, h: 0 };
    drag.current = { key, mode, x0: e.clientX, y0: e.clientY, start: startBox, rect };
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(key);
  };
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x0) / d.rect.width;
    const dy = (e.clientY - d.y0) / d.rect.height;
    if (d.key === "photo") {
      if (d.mode === "resize") setPhoto({ w: round(clamp(d.start.w + dx, 0.02, 1 - d.start.x)), h: round(clamp(d.start.h + dy, 0.02, 1 - d.start.y)) });
      else setPhoto({ x: round(clamp(d.start.x + dx, 0, 1 - d.start.w)), y: round(clamp(d.start.y + dy, 0, 1 - d.start.h)) });
    } else if (d.key) {
      setField(d.key, { x: round(clamp(d.start.x + dx)), y: round(clamp(d.start.y + dy)) });
    }
  };
  const end = () => {
    drag.current = null;
  };
  const nudge = (e: React.KeyboardEvent, key: Selected) => {
    const step = e.shiftKey ? 0.01 : 0.002;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    if (key === "photo" && layout.photo) setPhoto({ x: round(clamp(layout.photo.x + d[0])), y: round(clamp(layout.photo.y + d[1])) });
    else if (key && key !== "photo") {
      const f = layout.fields.find((x) => x.key === key)!;
      setField(key, { x: round(clamp(f.x + d[0])), y: round(clamp(f.y + d[1])) });
    }
  };

  const save = () =>
    start(async () => {
      try {
        await saveTemplateLayout({ competitionId, kind, layout });
        toast.success(t("Tata letak disimpan"));
        router.refresh();
        onDone();
      } catch (e) {
        toast.error(t("Gagal menyimpan"), e instanceof Error ? e.message : undefined);
      }
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="mx-auto w-full" style={{ maxWidth: `min(100%, calc(70dvh * ${template.width / template.height}))` }}>
        <PrintPreview imageUrl={template.imageUrl} width={template.width} height={template.height} layout={layout} record={sample}>
          {layout.photo?.visible && (
            <div
              role="button"
              tabIndex={0}
              aria-label={t("Geser bingkai foto")}
              onPointerDown={(e) => begin(e, "photo", "move")}
              onPointerMove={move}
              onPointerUp={end}
              onKeyDown={(e) => nudge(e, "photo")}
              onFocus={() => setSelected("photo")}
              className={cn(
                "absolute cursor-move touch-none rounded-md border-2 border-dashed outline-none",
                selected === "photo" ? "border-brand bg-brand/10" : "border-white/70 hover:border-brand/70",
              )}
              style={{ left: `${layout.photo.x * 100}%`, top: `${layout.photo.y * 100}%`, width: `${layout.photo.w * 100}%`, height: `${layout.photo.h * 100}%` }}
            >
              <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-night/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <ImageIcon className="size-3" /> {t("Foto")}
              </span>
              <span
                aria-hidden="true"
                onPointerDown={(e) => begin(e, "photo", "resize")}
                onPointerMove={move}
                onPointerUp={end}
                className="absolute -bottom-1.5 -right-1.5 size-4 cursor-nwse-resize touch-none rounded-sm border-2 border-white bg-brand"
              />
            </div>
          )}
          {layout.fields.filter((f) => f.visible).map((f) => (
            <div
              key={f.key}
              role="button"
              tabIndex={0}
              aria-label={t("Geser {label}", { label: t(FIELD_LABEL[f.key]) })}
              onPointerDown={(e) => begin(e, f.key, "move")}
              onPointerMove={move}
              onPointerUp={end}
              onKeyDown={(e) => nudge(e, f.key)}
              onFocus={() => setSelected(f.key)}
              className={cn(
                "absolute cursor-move touch-none rounded-sm border border-dashed outline-none",
                selected === f.key ? "border-brand bg-brand/10" : "border-transparent hover:border-ink/40 hover:bg-white/10",
              )}
              style={{
                left: `${f.x * 100}%`,
                top: `${f.y * 100}%`,
                width: `${f.w * 100}%`,
                height: `${Math.max(f.size * 125, 1.5)}%`,
                transform: `translate(${f.align === "left" ? "0" : f.align === "center" ? "-50%" : "-100%"}, -50%)`,
              }}
            >
              {selected === f.key && (
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {t(FIELD_LABEL[f.key])}
                </span>
              )}
            </div>
          ))}
        </PrintPreview>
        <p className="mt-2 text-center text-[11px] text-ink-muted">
          {t("Geser isian pada pratinjau, atau pilih lalu gunakan tombol panah (Shift = lebih jauh).")}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="print-width">{t("Lebar cetak (mm)")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="print-width"
              type="number"
              min={30}
              max={1000}
              value={layout.widthMm}
              onChange={(e) => setLayout((l) => ({ ...l, widthMm: Math.min(1000, Math.max(30, Number(e.target.value) || 30)) }))}
              className="w-28"
            />
            <span className="text-xs text-ink-muted">× {heightMm} mm</span>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t("Isian")}</legend>
          <ul className="space-y-1">
            {layout.photo && (
              <PartRow
                label={t("Foto")}
                visible={layout.photo.visible}
                active={selected === "photo"}
                onToggle={(v) => setPhoto({ visible: v })}
                onSelect={() => setSelected("photo")}
              />
            )}
            {layout.fields.map((f) => (
              <PartRow
                key={f.key}
                label={t(FIELD_LABEL[f.key])}
                sample={sample.values[f.key]}
                visible={f.visible}
                active={selected === f.key}
                onToggle={(v) => setField(f.key, { visible: v })}
                onSelect={() => setSelected(f.key)}
              />
            ))}
          </ul>
        </fieldset>

        {field && (
          <div className="space-y-3 rounded-2xl bg-surface-2/70 p-3">
            <p className="text-xs font-semibold text-ink">{t(FIELD_LABEL[field.key])}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="print-font">{t("Huruf")}</Label>
                <Select id="print-font" value={field.font} onChange={(e) => setField(field.key, { font: e.target.value as PrintTextField["font"] })}>
                  {PRINT_FONTS.map((f) => (
                    <option key={f} value={f}>{FONT_LABEL[f]}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="print-color">{t("Warna")}</Label>
                <input
                  id="print-color"
                  type="color"
                  value={field.color}
                  onChange={(e) => setField(field.key, { color: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-full border border-line bg-surface px-1"
                />
              </div>
            </div>
            <Slider label={t("Ukuran huruf")} value={field.size * 100} min={0.5} max={15} step={0.1} unit="%" onChange={(v) => setField(field.key, { size: round(v / 100) })} />
            <Slider label={t("Lebar maksimum")} value={field.w * 100} min={5} max={100} step={1} unit="%" onChange={(v) => setField(field.key, { w: round(v / 100) })} />
            <div className="flex flex-wrap items-center gap-3">
              <div role="radiogroup" aria-label={t("Perataan")} className="inline-flex rounded-full bg-surface p-0.5 ring-1 ring-line">
                {([["left", AlignLeft, t("Rata kiri")], ["center", AlignCenter, t("Rata tengah")], ["right", AlignRight, t("Rata kanan")]] as const).map(([a, Icon, label]) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={field.align === a}
                    title={label}
                    aria-label={label}
                    onClick={() => setField(field.key, { align: a })}
                    className={cn("grid size-8 place-items-center rounded-full", field.align === a ? "bg-night text-white" : "text-ink-secondary hover:text-ink")}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-ink-secondary">
                <input type="checkbox" checked={field.upper} onChange={(e) => setField(field.key, { upper: e.target.checked })} /> {t("Huruf kapital")}
              </label>
              {field.font === "sans" && (
                <label className="flex items-center gap-1.5 text-xs text-ink-secondary">
                  <input type="checkbox" checked={field.bold} onChange={(e) => setField(field.key, { bold: e.target.checked })} /> {t("Tebal")}
                </label>
              )}
            </div>
          </div>
        )}

        {selected === "photo" && layout.photo && (
          <div className="space-y-3 rounded-2xl bg-surface-2/70 p-3">
            <p className="text-xs font-semibold text-ink">{t("Bingkai foto")}</p>
            <Slider label={t("Lebar")} value={layout.photo.w * 100} min={2} max={100} step={0.5} unit="%" onChange={(v) => setPhoto({ w: round(v / 100) })} />
            <Slider label={t("Tinggi")} value={layout.photo.h * 100} min={2} max={100} step={0.5} unit="%" onChange={(v) => setPhoto({ h: round(v / 100) })} />
            <Slider label={t("Sudut membulat")} value={layout.photo.radius * 100} min={0} max={10} step={0.1} unit="%" onChange={(v) => setPhoto({ radius: round(v / 100) })} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} {t("Simpan tata letak")}
          </Button>
          <Button variant="ghost" onClick={() => setLayout({ ...defaultLayout(kind), widthMm: layout.widthMm })} disabled={pending}>
            <RotateCcw className="size-3.5" /> {t("Posisi bawaan")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PartRow({
  label,
  sample,
  visible,
  active,
  onToggle,
  onSelect,
}: {
  label: string;
  sample?: string;
  visible: boolean;
  active: boolean;
  onToggle: (v: boolean) => void;
  onSelect: () => void;
}) {
  return (
    <li className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5", active && "bg-brand-soft")}>
      <input type="checkbox" checked={visible} onChange={(e) => onToggle(e.target.checked)} aria-label={label} />
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate text-left text-xs">
        <span className={cn("font-medium", visible ? "text-ink" : "text-ink-muted")}>{label}</span>
        {sample && <span className="ml-1.5 text-ink-muted">{sample}</span>}
      </button>
    </li>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const id = React.useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <label htmlFor={id} className="font-semibold text-ink-secondary">{label}</label>
        <span className="tabular-nums text-ink-muted">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-brand)]" />
    </div>
  );
}
