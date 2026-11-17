import { requireAnyViewerCapability } from "@/lib/auth/session";
import { allowedChildHrefs, moduleViewCaps } from "@/lib/nav";
import { PageHeader } from "@/components/app/page-header";
import { PiTabs } from "./tabs";
import { getI18n } from "@/lib/i18n/server";

export default async function PiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await getI18n();
  // Each tab has its own "view" permission; the menu opens when at least one is allowed.
  const user = await requireAnyViewerCapability(moduleViewCaps("player-intelligence"));
  return (
    <div>
      <PageHeader
        title={t("Player Intelligence & Radar")}
        description={t("Visualisasi dan analitik performa pemain untuk mendukung keputusan pembinaan yang lebih terarah.")}
      />
      <PiTabs allowed={allowedChildHrefs("player-intelligence", user)} />
      <div className="mt-5">{children}</div>
    </div>
  );
}
