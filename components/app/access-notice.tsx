"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { CAPABILITY_INFO, type Capability } from "@/lib/auth/rbac";

/**
 * Pages send people they may not open to their first allowed menu with `?denied=<capability>`.
 * Say why once, then clean the address bar.
 */
export function AccessNotice() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const denied = params.get("denied");
  const announced = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!denied || announced.current === denied) return;
    announced.current = denied;
    const info = CAPABILITY_INFO[denied as Capability];
    toast.warn("Akses ditolak", info ? `Peran Anda tidak memiliki izin “${info.label}”.` : undefined);
    const next = new URLSearchParams(params.toString());
    next.delete("denied");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [denied, params, pathname, router]);

  return null;
}
