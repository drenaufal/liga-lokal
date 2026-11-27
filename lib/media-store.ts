import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { mediaIdFromUrl, type MediaKind } from "@/lib/media";

export async function saveMedia(input: {
  kind: MediaKind;
  fileName: string | null;
  mimeType: string;
  bytes: ArrayBuffer;
  uploadedBy: string | null;
}) {
  const id = crypto.randomUUID();
  await db
    .insert(media)
    .values({
      id,
      kind: input.kind,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.bytes.byteLength,
      data: Buffer.from(input.bytes).toString("base64"),
      uploadedBy: input.uploadedBy,
    });
  return id;
}

export async function getMedia(id: string) {
  return db.query.media.findFirst({ where: eq(media.id, id) });
}

export type MediaMeta = {
  id: string;
  kind: MediaKind;
  fileName: string | null;
  mimeType: string;
  size: number;
  createdAt: Date;
};

/** Metadata only (no payload) for a media URL — used to render document cards. */
export async function getMediaMeta(url: string | null | undefined): Promise<MediaMeta | null> {
  const id = mediaIdFromUrl(url);
  if (!id) return null;
  try {
    const row = await db.query.media.findFirst({
      where: eq(media.id, id),
      columns: { id: true, kind: true, fileName: true, mimeType: true, size: true, createdAt: true },
    });
    return row ?? null;
  } catch (e) {
    console.error("media meta lookup failed", e);
    return null;
  }
}

/**
 * Batch metadata lookup for multiple document URLs in one query (0 queries when
 * no uploaded media URL is present). Never throws on transient DB errors so
 * profile pages keep rendering with a fallback label.
 */
export async function getMediaMetas(urls: (string | null | undefined)[]): Promise<(MediaMeta | null)[]> {
  const ids = urls.map(mediaIdFromUrl);
  const uniqueIds = [...new Set(ids.filter((id): id is string => !!id))];
  if (!uniqueIds.length) return urls.map(() => null);
  try {
    const rows = await db
      .select({
        id: media.id,
        kind: media.kind,
        fileName: media.fileName,
        mimeType: media.mimeType,
        size: media.size,
        createdAt: media.createdAt,
      })
      .from(media)
      .where(inArray(media.id, uniqueIds));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => (id ? (byId.get(id) ?? null) : null));
  } catch (e) {
    console.error("batch media meta lookup failed", e);
    return urls.map(() => null);
  }
}

/**
 * Deletes media rows that a record no longer references (e.g. a replaced
 * photo). External URLs are ignored.
 */
export async function releaseMedia(...urls: (string | null | undefined)[]) {
  const ids = urls.map(mediaIdFromUrl).filter((id): id is string => !!id);
  if (!ids.length) return;
  try {
    await db.delete(media).where(inArray(media.id, ids));
  } catch (e) {
    console.error("media cleanup failed", e);
  }
}

/** Release `prev` only when it was replaced by something else. */
export async function releaseReplaced(prev: string | null | undefined, next: string | null | undefined) {
  if (prev && prev !== next) await releaseMedia(prev);
}
