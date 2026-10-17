import { NextResponse } from "next/server";
import { cloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { getCurrentUser } from "@/lib/auth/session";
import { FILE_UPLOAD_CAPS, canAny } from "@/lib/auth/rbac";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canAny(user, FILE_UPLOAD_CAPS)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!cloudinaryConfigured) {
    return NextResponse.json(
      { error: "Cloudinary belum dikonfigurasi di server." },
      { status: 503 },
    );
  }

  const body = await req.json();
  const { paramsToSign } = body as { paramsToSign: Record<string, string> };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!,
  );
  return NextResponse.json({ signature });
}
