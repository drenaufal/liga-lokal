import { requireAnyCapability } from "@/lib/auth/session";
import { allowedChildHrefs, moduleViewCaps } from "@/lib/nav";
import { PageHeader } from "@/components/app/page-header";
import { PiTabs } from "./tabs";

export default async function PiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Each tab has its own "view" permission; the menu opens when at least one is allowed.
  const user = await requireAnyCapability(moduleViewCaps("player-intelligence"));
  return (
    <div>
      <PageHeader
        title="Player Intelligence & Radar"
        description="Visualisasi dan analitik performa pemain untuk mendukung keputusan pembinaan yang lebih terarah."
      />
      <PiTabs allowed={allowedChildHrefs("player-intelligence", user)} />
      <div className="mt-5">{children}</div>
    </div>
  );
}
