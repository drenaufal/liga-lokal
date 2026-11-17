import { NextResponse } from "next/server";
import { z } from "zod";
import { cloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { getCurrentUser } from "@/lib/auth/session";
import { FILE_UPLOAD_CAPS, canAny } from "@/lib/auth/rbac";
import { isSameOrigin } from "@/lib/security/same-origin";
import { getT } from "@/lib/i18n/server";

/**
 * Signs a Cloudinary upload request for the browser. The signature is what authorises the upload,
 * so the server must never sign whatever it is handed: a signed "destroy", "overwrite" or an
 * upload into somebody else's folder would be a standing capability for any signed-in uploader.
 * Only the parameters of a plain, fresh, in-folder upload are accepted.
 */
const UPLOAD_FOLDER = (process.env.CLOUDINARY_UPLOAD_FOLDER ?? "ligalokal").replace(/^\/+|\/+$/g, "");
const MAX_BODY_BYTES = 8 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 10 * 60;

const scalar = z.union([z.string().max(512), z.number(), z.boolean()]);
const bodySchema = z.object({ paramsToSign: z.record(z.string().max(64), scalar) });

/** The only parameters the upload widget needs signed. Anything else (eager, overwrite, callback, notification_url…) is refused. */
const ALLOWED_PARAMS = new Set(["timestamp", "folder", "source", "public_id", "tags", "context", "upload_preset"]);

function problemWith(params: Record<string, string | number | boolean>): string | null {
  for (const key of Object.keys(params)) if (!ALLOWED_PARAMS.has(key)) return `parameter "${key}" is not allowed`;

  const timestamp = Number(params.timestamp);
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > MAX_CLOCK_SKEW_SECONDS) return "stale or missing timestamp";

  const folder = typeof params.folder === "string" ? params.folder.replace(/^\/+|\/+$/g, "") : "";
  if (folder !== UPLOAD_FOLDER && !folder.startsWith(`${UPLOAD_FOLDER}/`)) return "folder is outside the allowed upload folder";
  if (/(^|\/)\.\.?(\/|$)/.test(folder)) return "invalid folder";

  if (params.public_id !== undefined && (typeof params.public_id !== "string" || /\.\.|^\//.test(params.public_id))) return "invalid public_id";

  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (params.upload_preset !== undefined && (!preset || params.upload_preset !== preset)) return "upload_preset is not allowed";
  return null;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAny(user, FILE_UPLOAD_CAPS)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!cloudinaryConfigured) {
    return NextResponse.json(
      { error: (await getT())("Cloudinary belum dikonfigurasi di server.") },
      { status: 503 },
    );
  }

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "payload too large" }, { status: 413 });

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  const problem = problemWith(body.data.paramsToSign);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const signature = cloudinary.utils.api_sign_request(
    body.data.paramsToSign as Record<string, string>,
    process.env.CLOUDINARY_API_SECRET!,
  );
  return NextResponse.json({ signature });
}
