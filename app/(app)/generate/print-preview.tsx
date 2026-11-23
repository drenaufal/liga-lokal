"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PrintLayout, PrintRecord } from "@/lib/print/layout";
import { drawFields, drawPhoto, ensureFonts, loadImage } from "@/lib/print/render";

/** Decoded photos, shared by every preview on the page. */
const photoCache = new Map<string, Promise<ImageBitmap | null>>();
function photoBitmap(url: string) {
  let hit = photoCache.get(url);
  if (!hit) {
    hit = loadImage(url).then((img) => img.bitmap).catch(() => null);
    photoCache.set(url, hit);
  }
  return hit;
}

/**
 * The template with one person's values drawn over it by the same code that writes the PDF.
 * `children` are laid over it (the editor's drag handles), positioned in % of the template.
 */
export function PrintPreview({
  imageUrl,
  width,
  height,
  layout,
  record,
  className,
  children,
}: {
  imageUrl: string;
  width: number;
  height: number;
  layout: PrintLayout;
  record: Pick<PrintRecord, "values" | "photoUrl">;
  className?: string;
  children?: React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const cv = React.useRef<HTMLCanvasElement>(null);
  const [px, setPx] = React.useState({ w: 0, h: 0 });

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPx({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const c = cv.current;
    if (!c || !px.w) return;
    let cancelled = false;
    (async () => {
      await ensureFonts(layout);
      const photo = layout.photo?.visible && record.photoUrl ? await photoBitmap(record.photoUrl) : null;
      if (cancelled) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(px.w * dpr);
      c.height = Math.round(px.h * dpr);
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      if (photo && layout.photo) drawPhoto(ctx, photo, layout.photo, c.width, c.height);
      drawFields(ctx, layout, record, c.width, c.height);
    })();
    return () => {
      cancelled = true;
    };
  }, [layout, record, px]);

  return (
    <div
      ref={box}
      data-print-preview=""
      className={cn("relative w-full select-none overflow-hidden rounded-lg bg-surface-2 shadow-sm ring-1 ring-line", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded media image, sized by the box */}
      <img src={imageUrl} alt="" draggable={false} className="absolute inset-0 size-full object-fill" />
      <canvas ref={cv} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />
      {children}
    </div>
  );
}
