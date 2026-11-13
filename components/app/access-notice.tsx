"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { CAPABILITY_INFO, type Capability } from "@/lib/auth/rbac";
import { useT } from "@/lib/i18n/client";

/**
 * Pages send people they may not open to their first allowed menu with `?denied=<capability>`.
 * Say why once, then clean the address bar.
 */
export function AccessNotice() {
  const t = useT();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const denied = params.get("denied");
  const announced = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!denied || announced.current === denied) return;
    announced.current = denied;
    const info = CAPABILITY_INFO[denied as Capability];
    toast.warn(
      t("Akses ditolak"),
      info ? t("Peran Anda tidak memiliki izin “{label}”.", { label: t.dyn(info.label) }) : undefined,
    );
    const next = new URLSearchParams(params.toString());
    next.delete("denied");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [denied, params, pathname, router, t]);

  return null;
}
