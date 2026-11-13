import { requireAnyCapability } from "@/lib/auth/session";
import { allowedChildHrefs, moduleViewCaps } from "@/lib/nav";
import { RegistryTabs } from "./tabs";

export default async function RegistryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Each tab has its own "view" permission; the menu opens when at least one is allowed.
  const user = await requireAnyCapability(moduleViewCaps("registry"));
  return (
    <div>
      <RegistryTabs allowed={allowedChildHrefs("registry", user)} />
      {children}
    </div>
  );
}
