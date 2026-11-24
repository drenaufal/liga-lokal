import { redirect } from "next/navigation";
import { requireAnyCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

/** /generate opens the first of its two menus the person may use. */
export default async function GeneratePage() {
  const user = await requireAnyCapability(["generate.nametag:view", "generate.certificate:view"]);
  redirect(can(user, "generate.nametag:view") ? "/generate/name-tag" : "/generate/sertifikat");
}
