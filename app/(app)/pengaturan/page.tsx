import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Users,
  Database,
  ShieldCheck,
  Gauge,
  ScrollText,
} from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getSettingsData } from "@/lib/queries/settings";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, ROLE_DESCRIPTION, can } from "@/lib/auth/rbac";
import { formatNumber, relativeTime } from "@/lib/utils";
import { UserCreate, UserEdit } from "./user-manage";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const viewer = await requireCapability("settings:view");
  const { users, counts } = await getSettingsData(viewer.role);
  const canManageAccess = can(viewer, "access:manage");
  const canAudit = can(viewer, "audit:view");
  const canSeeUsers = can(viewer, "settings:users");
  const canCreateUser = canSeeUsers && can(viewer, "settings.users:create");
  const canEditUser = canSeeUsers && can(viewer, "settings.users:edit");
  const viewerIsAdmin = viewer.role === "admin" || viewer.role === "super_admin";

  // Each tile links to its module only when the viewer may open it.
  const dataStats = [
    ["Pemain", counts.players, "/registry/pemain", "registry.player:view"],
    ["SSB", counts.clubs, "/registry/klub", "registry.club:view"],
    ["Wasit", counts.referees, "/registry/wasit", "registry.referee:view"],
    ["Pelatih", counts.coaches, "/registry/pelatih", "registry.coach:view"],
    ["Kategori Usia", counts.ageCategories, "/registry/kategori-usia", "registry.category:view"],
    ["Venue", counts.venues, "/registry/venue", "registry.venue:view"],
    ["Turnamen", counts.competitions, "/kompetisi", "competition:view"],
    ["KU", counts.tournaments, "/kompetisi", "competition:view"],
    ["Pertandingan", counts.matches, "/match-ops", "match:view"],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi organisasi, manajemen pengguna, dan jejak audit menyeluruh."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4" /> Profil Organisasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <Row label="Nama instansi">[Nama Instansi / Federasi]</Row>
            <Row label="Penyelenggara">PT DVONES Indonesia</Row>
            <Row label="Lingkungan">Demo (on-request)</Row>
            <Row label="Zona waktu">Asia/Jakarta (WIB)</Row>
            <Row label="Bahasa">Bahasa Indonesia</Row>
            <Row label="Klasifikasi">Rahasia & Terbatas</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4" /> Ringkasan Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {dataStats.map(([label, n, href, cap]) => {
                const body = (
                  <>
                    <div className="text-lg font-semibold tabular-nums text-ink">
                      {formatNumber(n)}
                    </div>
                    <div className="text-[10px] text-ink-muted">{label}</div>
                  </>
                );
                return can(viewer, cap) ? (
                  <Link
                    key={label}
                    href={href}
                    className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5 transition-colors hover:border-brand/30"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={label} className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
                    {body}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-ink-muted">
              {formatNumber(counts.events)} kejadian pertandingan · {formatNumber(counts.auditEntries)} entri audit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-4" /> Konfigurasi Sistem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {can(viewer, "intelligence.formula:view") && (
              <Link href="/player-intelligence/formula" className="flex items-center justify-between rounded-lg border border-line-soft p-2.5 hover:border-brand/30">
                <span className="text-ink-secondary">Formula penilaian</span>
                <span className="text-brand">Kelola →</span>
              </Link>
            )}
            {can(viewer, "registry.category:view") && (
              <Link href="/registry/kategori-usia" className="flex items-center justify-between rounded-lg border border-line-soft p-2.5 hover:border-brand/30">
                <span className="text-ink-secondary">Aturan kategori usia</span>
                <span className="text-brand">Kelola →</span>
              </Link>
            )}
            {canManageAccess && (
              <Link href="/pengaturan/akses" className="flex items-center justify-between rounded-lg border border-line-soft p-2.5 hover:border-brand/30">
                <span className="text-ink-secondary">Hak akses peran</span>
                <span className="text-brand">Kelola →</span>
              </Link>
            )}
            {canAudit && (
              <Link href="/pengaturan/audit" className="flex items-center justify-between rounded-lg border border-line-soft p-2.5 hover:border-brand/30">
                <span className="text-ink-secondary">Jejak audit menyeluruh</span>
                <span className="text-brand">Buka →</span>
              </Link>
            )}
            <div className="flex items-center justify-between rounded-lg border border-line-soft p-2.5">
              <span className="text-ink-secondary">Integrasi Google Gemini AI</span>
              <Badge tone="warn">Nonaktif</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line-soft p-2.5">
              <span className="text-ink-secondary">Cloudinary (media)</span>
              <Badge tone="warn">Belum dikonfigurasi</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {canSeeUsers && <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> Manajemen Pengguna & Peran
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-ink-muted">{users.length} akun</span>
            {canCreateUser && <UserCreate viewerIsAdmin={viewerIsAdmin} />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5">Pengguna</th>
                  <th className="px-2 py-2.5">Peran</th>
                  <th className="px-2 py-2.5">Cakupan Akses</th>
                  <th className="px-2 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Login Terakhir</th>
                  {canEditUser && <th className="px-4 py-2.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} size={30} />
                        <div>
                          <p className="text-xs font-medium text-ink">{u.name}</p>
                          <p className="text-[10px] text-ink-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge tone="violet">{ROLE_LABEL[u.role]}</Badge>
                    </td>
                    <td className="px-2 py-2.5 max-w-xs text-[11px] text-ink-muted">
                      {ROLE_DESCRIPTION[u.role]}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge tone={u.active ? "success" : "neutral"} dot>
                        {u.active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-ink-muted">
                      {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "—"}
                    </td>
                    {canEditUser && (
                      <td className="px-4 py-2.5 text-right">
                        {u.role === "admin" && !viewerIsAdmin ? null : (
                          <UserEdit
                            key={[u.id, u.name, u.email, u.title, u.role, u.active].join("|")}
                            user={{ id: u.id, name: u.name, email: u.email, title: u.title, role: u.role, active: u.active }}
                            isSelf={u.id === viewer.id}
                            viewerIsAdmin={viewerIsAdmin}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink-secondary">{children}</span>
    </div>
  );
}
