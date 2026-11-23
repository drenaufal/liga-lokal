import { fieldText, pageSizePt, type PrintFont, type PrintLayout, type PrintPhotoBox, type PrintRecord } from "./layout";

/**
 * Browser-side rendering of name tags and certificates. The same drawing code feeds the editor
 * preview (a canvas over the template) and the PDF, so what the editor shows is what prints.
 *
 * In the PDF the template is embedded once and every page reuses it; each page adds the person's
 * photo (a JPEG, clipped to the rounded frame) and one transparent image with the text, drawn in
 * the app's own fonts at print resolution. Images the browser can decode — WebP included — work
 * as templates and photos.
 */

const FONT_VAR: Record<PrintFont, string> = { display: "--font-anton", sans: "--font-poppins", headline: "--font-bebas" };
const FONT_FALLBACK: Record<PrintFont, string> = {
  display: '"Arial Narrow", Impact, sans-serif',
  sans: "Arial, sans-serif",
  headline: '"Arial Narrow", Impact, sans-serif',
};

/** The CSS font family next/font registered for one of the app's typefaces. */
export function fontFamily(font: PrintFont) {
  const value = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(FONT_VAR[font]).trim();
  return value ? `${value}, ${FONT_FALLBACK[font]}` : FONT_FALLBACK[font];
}

const weightOf = (font: PrintFont, bold: boolean) => (font === "sans" ? (bold ? 700 : 400) : 400);

/** Waits until every typeface the layout uses is loaded, so the first page is not drawn in a fallback. */
export async function ensureFonts(layout: PrintLayout) {
  const used = new Set(layout.fields.filter((f) => f.visible).map((f) => `${weightOf(f.font, f.bold)} 48px ${fontFamily(f.font)}`));
  await Promise.all([...used].map((spec) => document.fonts.load(spec).catch(() => [])));
}

export type LoadedImage = { blob: Blob; bitmap: ImageBitmap; width: number; height: number };

export async function loadImage(url: string): Promise<LoadedImage> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  return { blob, bitmap, width: bitmap.width, height: bitmap.height };
}

/** Text of every visible field, sized and placed on a canvas of `W` × `H` pixels. */
export function drawFields(ctx: CanvasRenderingContext2D, layout: PrintLayout, record: Pick<PrintRecord, "values">, W: number, H: number) {
  for (const f of layout.fields) {
    if (!f.visible) continue;
    const text = fieldText(f, record);
    const family = fontFamily(f.font);
    const weight = weightOf(f.font, f.bold);
    const max = f.w * W;
    let px = f.size * H;
    ctx.font = `${weight} ${px}px ${family}`;
    const measured = ctx.measureText(text).width;
    // a long name shrinks to fit its box (down to 45 %), then is condensed by fillText's maxWidth
    if (measured > max) {
      px = Math.max(px * (max / measured), f.size * H * 0.45);
      ctx.font = `${weight} ${px}px ${family}`;
    }
    // centre the capitals on the line, whatever the font's own ascent and descent
    const cap = ctx.measureText("H").actualBoundingBoxAscent || px * 0.7;
    ctx.fillStyle = f.color;
    ctx.textAlign = f.align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, f.x * W, f.y * H + cap / 2, max);
  }
}

/** The part of a photo that fills a box of the given proportions: centred, faces kept near the top. */
export function coverCrop(srcW: number, srcH: number, boxW: number, boxH: number) {
  const target = boxW / boxH;
  if (srcW / srcH > target) {
    const sw = srcH * target;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / target;
  return { sx: 0, sy: (srcH - sh) * 0.3, sw: srcW, sh };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Preview only: the photo drawn into its rounded frame on the overlay canvas. */
export function drawPhoto(ctx: CanvasRenderingContext2D, photo: ImageBitmap, box: PrintPhotoBox, W: number, H: number) {
  const x = box.x * W, y = box.y * H, w = box.w * W, h = box.h * H;
  const c = coverCrop(photo.width, photo.height, w, h);
  ctx.save();
  roundedRect(ctx, x, y, w, h, box.radius * W);
  ctx.clip();
  ctx.drawImage(photo, c.sx, c.sy, c.sw, c.sh, x, y, w, h);
  ctx.restore();
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

async function toBytes(c: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number) {
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, type, quality));
  if (!blob) throw new Error("canvas export failed");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Print resolution: 300 dpi across the page width, kept between 800 and 3508 pixels. */
export function overlaySize(layout: PrintLayout, width: number, height: number) {
  const w = Math.min(3508, Math.max(800, Math.round((layout.widthMm / 25.4) * 300)));
  return { w, h: Math.round(w * (height / width)) };
}

export type BuildPdfInput = {
  template: { imageUrl: string; width: number; height: number };
  layout: PrintLayout;
  records: PrintRecord[];
  onProgress?: (done: number, total: number) => void;
};

/** One page per record. Returns the PDF and the names whose photo could not be loaded. */
export async function buildPdf({ template, layout, records, onProgress }: BuildPdfInput) {
  const pdf = await import("pdf-lib");
  const doc = await pdf.PDFDocument.create();
  doc.setCreator("LigaLokal");
  doc.setProducer("LigaLokal");
  await ensureFonts(layout);

  // The template once, as JPEG / PNG (other formats go through a canvas first).
  const tpl = await loadImage(template.imageUrl);
  let tplImage;
  if (tpl.blob.type === "image/jpeg") tplImage = await doc.embedJpg(new Uint8Array(await tpl.blob.arrayBuffer()));
  else if (tpl.blob.type === "image/png") tplImage = await doc.embedPng(new Uint8Array(await tpl.blob.arrayBuffer()));
  else {
    const c = canvas(tpl.width, tpl.height);
    c.getContext("2d")!.drawImage(tpl.bitmap, 0, 0);
    tplImage = await doc.embedJpg(await toBytes(c, "image/jpeg", 0.92));
  }
  tpl.bitmap.close();

  const page = pageSizePt(layout, template.width, template.height);
  const size = overlaySize(layout, template.width, template.height);
  const overlay = canvas(size.w, size.h);
  const ctx = overlay.getContext("2d")!;
  const box = layout.photo?.visible ? layout.photo : null;
  const missingPhotos: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const p = doc.addPage([page.width, page.height]);
    p.drawImage(tplImage, { x: 0, y: 0, width: page.width, height: page.height });

    if (box && r.photoUrl) {
      try {
        const photo = await loadImage(r.photoUrl);
        const bw = box.w * size.w, bh = box.h * size.h;
        const scale = Math.min(1, 900 / Math.max(bw, bh));
        const c = canvas(bw * scale, bh * scale);
        const crop = coverCrop(photo.width, photo.height, bw, bh);
        c.getContext("2d")!.drawImage(photo.bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, c.width, c.height);
        photo.bitmap.close();
        const img = await doc.embedJpg(await toBytes(c, "image/jpeg", 0.88));
        // PDF y runs upwards: the frame's bottom-left corner, then a rounded clip around it
        const x = box.x * page.width, w = box.w * page.width, h = box.h * page.height;
        const y = page.height - (box.y + box.h) * page.height;
        const rad = Math.min(box.radius * page.width, w / 2, h / 2);
        const k = rad * 0.5523; // bezier handle for a quarter circle
        p.pushOperators(
          pdf.pushGraphicsState(),
          pdf.moveTo(x + rad, y),
          pdf.lineTo(x + w - rad, y),
          pdf.appendBezierCurve(x + w - rad + k, y, x + w, y + rad - k, x + w, y + rad),
          pdf.lineTo(x + w, y + h - rad),
          pdf.appendBezierCurve(x + w, y + h - rad + k, x + w - rad + k, y + h, x + w - rad, y + h),
          pdf.lineTo(x + rad, y + h),
          pdf.appendBezierCurve(x + rad - k, y + h, x, y + h - rad + k, x, y + h - rad),
          pdf.lineTo(x, y + rad),
          pdf.appendBezierCurve(x, y + rad - k, x + rad - k, y, x + rad, y),
          pdf.closePath(),
          pdf.clip(),
          pdf.endPath(),
        );
        p.drawImage(img, { x, y, width: w, height: h });
        p.pushOperators(pdf.popGraphicsState());
      } catch {
        missingPhotos.push(r.label);
      }
    }

    ctx.clearRect(0, 0, size.w, size.h);
    drawFields(ctx, layout, r, size.w, size.h);
    const text = await doc.embedPng(await toBytes(overlay, "image/png"));
    p.drawImage(text, { x: 0, y: 0, width: page.width, height: page.height });

    onProgress?.(i + 1, records.length);
    if (i % 5 === 4) await new Promise((res) => setTimeout(res)); // let the progress label repaint
  }

  return { bytes: await doc.save(), missingPhotos };
}

/** Hands a finished PDF to the browser as a download. */
export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Makes an image fit the 5 MB upload limit: re-encoded as JPEG at up to 3508 px on its long side
 * (A4 at 300 dpi), lowering the quality until it fits. Small PNG / JPEG / WebP files pass as they are.
 */
export async function prepareTemplateFile(file: File, maxBytes: number): Promise<{ file: File; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  if (file.size <= maxBytes && /^image\/(png|jpeg|webp)$/.test(file.type)) {
    bitmap.close();
    return { file, width, height };
  }
  const scale = Math.min(1, 3508 / Math.max(width, height));
  const c = canvas(width * scale, height * scale);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  for (const q of [0.92, 0.85, 0.75, 0.6]) {
    const bytes = await toBytes(c, "image/jpeg", q);
    if (bytes.byteLength <= maxBytes) {
      const name = (file.name.replace(/\.[^.]+$/, "") || "template") + ".jpg";
      return { file: new File([bytes as BlobPart], name, { type: "image/jpeg" }), width: c.width, height: c.height };
    }
  }
  throw new Error("too large");
}
