/**
 * Role-access rules that need no database: the capability catalog, defaults, overrides,
 * dependencies, the hidden Super Admin and the menu each role ends up seeing.
 * Run with `npm run test:access`.
 */
import {
  ALL_CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_INFO,
  EDITABLE_ROLES,
  REQUIRES,
  ROLES,
  can,
  canAny,
  canSeeRole,
  defaultGrants,
  diffAgainstDefaults,
  normalizeGrants,
  resolveGrants,
  type Capability,
  type GrantMatrix,
  type Role,
} from "@/lib/auth/rbac";
import { NAV, SETTINGS_NAV, allowedChildHrefs, homeHref, moduleViewCaps, navFor } from "@/lib/nav";

let failures = 0;
const ok = (cond: unknown, label: string) => {
  if (!cond) failures++;
  console.log(`${cond ? "✓" : "✗"} ${label}`);
};

const defaults = () =>
  Object.fromEntries(EDITABLE_ROLES.map((r) => [r, normalizeGrants(r, defaultGrants(r))])) as GrantMatrix;
const hrefs = (role: Role, grants?: Capability[]) => navFor({ role, grants: grants ?? resolveGrants(role) }).map((n) => n.key);

/* ── Catalog ── */
const listed = CAPABILITY_GROUPS.flatMap((g) => g.caps);
ok(new Set(listed).size === listed.length, "every capability appears in exactly one group");
ok(listed.length === ALL_CAPABILITIES.length && ALL_CAPABILITIES.length >= 60, `catalog has ${ALL_CAPABILITIES.length} capabilities`);
ok(ALL_CAPABILITIES.every((c) => CAPABILITY_INFO[c].label && CAPABILITY_INFO[c].description), "every capability has a label and description");
ok(Object.entries(REQUIRES).every(([c, need]) => need && ALL_CAPABILITIES.includes(need) && c !== need), "every prerequisite points at a real capability");
ok(
  ALL_CAPABILITIES.filter((c) => CAPABILITY_INFO[c].kind === "feature").every((c) => {
    // a feature must (transitively) hang off a menu so it can never be granted on its own
    let cur: Capability | undefined = c;
    for (let i = 0; i < 6 && cur; i++) {
      if (CAPABILITY_INFO[cur].kind === "menu") return true;
      cur = REQUIRES[cur];
    }
    // the two switches that cut across every menu
    return c === "registry:documents" || c === "scope:all-clubs";
  }),
  "every feature depends on a menu (except the shared documents and club-scope switches)",
);
ok(ALL_CAPABILITIES.filter((c) => c.endsWith(":view")).length >= 15, "each menu and tab has its own view capability");

/* ── Super Admin ── */
ok(ALL_CAPABILITIES.every((c) => can("super_admin", c)), "super_admin holds every capability");
ok(resolveGrants("super_admin").length === ALL_CAPABILITIES.length, "super_admin resolves to the full list");
ok(canSeeRole("super_admin", "super_admin"), "super_admin sees itself");
ok(ROLES.filter((r) => r !== "super_admin").every((r) => !canSeeRole(r, "super_admin")), "no other role can see super_admin");
ok(!canSeeRole(undefined, "super_admin"), "anonymous cannot see super_admin");

/* ── access:manage is Super Admin only ── */
ok(can("admin", "access:manage") === false, "admin cannot manage access");
ok(EDITABLE_ROLES.every((r) => !resolveGrants(r, { [r]: { "access:manage": true } }).includes("access:manage")), "overrides cannot grant access:manage");
ok(can({ role: "operator", grants: ["access:manage"] }, "access:manage") === false, "a forged grants list cannot grant access:manage");
const adminDefault = defaultGrants("admin");
ok(adminDefault.length === ALL_CAPABILITIES.length - 1 && !adminDefault.includes("access:manage"), "admin default = everything but access:manage");

/* ── Defaults keep today's behaviour ── */
ok(can("operator", "registry.player:create") && can("operator", "competition:delete") && can("operator", "ku:delete"), "operator keeps registry + competition powers");
ok(!can("operator", "intelligence.formula:edit") && !can("operator", "registry.operator:create"), "operator still cannot edit formulas or create operators");
ok(can("referee", "match:operate") && can("referee", "match:confirm") && !can("referee", "match:assign"), "referee runs and confirms matches only");
ok(can("coach", "dsp:submit") && !can("coach", "dsp:any-club") && !can("coach", "registry.player:create"), "coach submits DSP for own club only");
ok(can("viewer", "match:view") && !can("viewer", "match:events") && !can("viewer", "scout:view"), "viewer stays read-only");
ok(can("scout", "scout:report") && !can("scout", "match:events"), "scout uses AI Scout");
ok(can(null, "match:view") === false && can(undefined, "match:view") === false, "no role → no access");
ok(EDITABLE_ROLES.every((r) => resolveGrants(r).length === normalizeGrants(r, defaultGrants(r)).length), "default grants are already normalised");

/* ── Overrides ── */
const viewerPlus = resolveGrants("viewer", { viewer: { "scout:view": true, "match:view": false } });
ok(viewerPlus.includes("scout:view"), "override grants a menu the role never had");
ok(!viewerPlus.includes("match:view"), "override revokes a default menu");
ok(!viewerPlus.includes("match:operate") && !viewerPlus.includes("match:events"), "revoking a menu drops its features");
ok(can({ role: "viewer", grants: viewerPlus }, "scout:view") && !can({ role: "viewer", grants: viewerPlus }, "match:view"), "can() honours resolved grants");
const featureOnly = resolveGrants("viewer", { viewer: { "registry.player:create": true } });
ok(featureOnly.includes("registry.player:create") && featureOnly.includes("registry.player:view"), "granting a feature keeps its menu (already granted)");
ok(normalizeGrants("operator", ["registry.player:create"]).length === 0, "a feature alone, without its menu, is dropped");
ok(normalizeGrants("operator", ["match:view", "match:events", "match:undo-any"]).length === 3, "undo-any → events → view chain survives together");
ok(normalizeGrants("operator", ["match:view", "match:undo-any"]).join() === "match:view", "undo-any without events is dropped");
ok(canAny({ role: "viewer", grants: ["match:view"] }, ["scout:view", "match:view"]) && !canAny({ role: "viewer", grants: [] }, ["match:view"]), "canAny matches any one capability");

/* ── Diff ── */
ok(Object.keys(diffAgainstDefaults(defaults())).length === 0, "an untouched matrix produces no overrides");
const edited = defaults();
edited.scout = [...edited.scout, "ingestion:view" as Capability];
edited.operator = edited.operator.filter((c) => c !== "intelligence.badge:select");
const diff = diffAgainstDefaults(edited);
ok(diff.scout?.["ingestion:view"] === true && diff.operator?.["intelligence.badge:select"] === false, "diff records grants and revocations");
ok(Object.keys(diff).sort().join() === "operator,scout", "diff only lists roles that changed");
ok(resolveGrants("scout", diff).includes("ingestion:view") && !resolveGrants("operator", diff).includes("intelligence.badge:select"), "diff round-trips through resolveGrants");
const forged = defaults();
forged.coach = [...forged.coach, "access:manage" as Capability];
ok(Object.keys(diffAgainstDefaults(forged)).length === 0, "access:manage in a submitted matrix is ignored");

/* ── Menus ── */
ok(navFor("super_admin").length === NAV.length + 1, "super_admin sees every menu including Pengaturan");
ok(hrefs("viewer").join() === "command-center,registry,kompetisi,match-ops,player-intelligence", "viewer sees the read-only menus");
ok(hrefs("coach").join() === "dsp,kompetisi,player-intelligence", "a coach has exactly three menus: DSP, Competition and Player Intelligence");
ok(!can("coach", "dashboard:view") && !can("coach", "match:view") && !can("coach", "registry.player:view") && !can("coach", "scout:view"), "no dashboard, match operations, registry or AI Scout for a coach by default");
ok(can("coach", "dsp:submit") && can("coach", "competition:view") && can("coach", "intelligence.radar:view") && !can("coach", "scope:all-clubs"), "a coach fills the DSP, reads competitions and player analytics, but only for their own SSB");
ok(!hrefs("operator").includes("dsp") && hrefs("operator").includes("pengaturan"), "operator menu has Pengaturan but not DSP");
ok(!hrefs("scout").includes("pengaturan"), "scout has no Pengaturan");
ok(adminDefault.includes("settings:view") && navFor("admin").at(-1)?.key === "pengaturan", "admin keeps Pengaturan");
const onlyPlayers = resolveGrants("viewer", { viewer: Object.fromEntries(ALL_CAPABILITIES.filter((c) => c !== "registry.player:view").map((c) => [c, false])) });
ok(onlyPlayers.join() === "registry.player:view", "stripping everything but one tab leaves exactly that tab");
const registryMenu = navFor({ role: "viewer", grants: onlyPlayers }).find((n) => n.key === "registry");
ok(registryMenu?.children?.length === 1 && registryMenu.href === "/registry/pemain", "a menu with one allowed tab shows just that tab");
ok(allowedChildHrefs("registry", { role: "viewer", grants: onlyPlayers }).join() === "/registry/pemain", "tab bar only lists allowed tabs");
ok(homeHref({ role: "viewer", grants: [] }) === null, "a role with nothing has no home page");
ok(homeHref({ role: "viewer", grants: onlyPlayers }) === "/registry/pemain", "without the dashboard, home page is the first allowed menu");
ok(homeHref("admin") === "/command-center" && homeHref("coach") === "/dsp", "with the dashboard allowed, home page is the dashboard; a coach lands on the DSP");
ok(moduleViewCaps("registry").length === 7 && moduleViewCaps("player-intelligence").length === 4, "module guards cover every tab");
const lonelyAudit = navFor({ role: "operator", grants: ["audit:view"] });
ok(lonelyAudit.length === 0, "audit without settings:view opens nothing (settings:view is required)");
ok(SETTINGS_NAV.children?.some((c) => c.capability === "access:manage"), "Pengaturan lists the access screen for those who may use it");

/* ── Unit Bisnis (Keuangan) ── */
ok(can("unit_bisnis", "finance:view") && can("unit_bisnis", "finance:input"), "a unit login can open Keuangan and fill in its data");
ok(!can("unit_bisnis", "finance:all-units") && !can("unit_bisnis", "finance.units:manage") && !can("unit_bisnis", "finance:delete"), "a unit login cannot see other units, manage units or delete");
ok(resolveGrants("unit_bisnis").every((c) => c.startsWith("finance")), "a unit login holds finance permissions only");
ok(hrefs("unit_bisnis").join() === "keuangan", "a unit login's menu is just Keuangan");
ok(homeHref("unit_bisnis") === "/keuangan", "a unit login lands on Keuangan, not on a dashboard it cannot open");
ok(can("admin", "finance:all-units") && can("admin", "finance.units:manage") && can("admin", "finance:delete"), "admin sees every unit, manages units and may delete");
ok((["operator", "referee", "coach", "scout", "viewer"] as const).every((r) => !can(r, "finance:view")), "the other roles have no finance access by default");
ok(allowedChildHrefs("keuangan", "unit_bisnis").length === 7 && allowedChildHrefs("keuangan", "admin").length === 8, "a unit login gets seven tabs, admin also gets Unit Bisnis");
ok(normalizeGrants("unit_bisnis", ["finance:view", "finance.units:manage"]).join() === "finance:view", "managing units without seeing all units is dropped");
ok(normalizeGrants("viewer", ["finance:view", "finance:all-units"]).includes("finance:all-units"), "a super admin can hand all-units access to any role");
ok(navFor("super_admin").some((n) => n.key === "keuangan") && !hrefs("viewer").includes("keuangan"), "Keuangan is in the super admin's menu and not in a viewer's");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll access checks passed");
process.exit(failures ? 1 : 0);
