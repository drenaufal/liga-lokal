import { auth } from "./auth";
import { common } from "./common";
import { landing } from "./landing";
import { shell } from "./shell";
import { components } from "./components";
import { rbac } from "./rbac";
import { status } from "./status";
import { dashboard } from "./dashboard";
import { match } from "./match";
import { registry } from "./registry";
import { competition } from "./competition";
import { ingestion } from "./ingestion";
import { schedule } from "./schedule";
import { intelligence } from "./intelligence";
import { scout } from "./scout";
import { audit } from "./audit";
import { settings } from "./settings";
import { finance } from "./finance";
import { articles } from "./articles";

/**
 * English for every message in the app. The key is the Indonesian source text, so a missing
 * entry shows Indonesian instead of breaking — and `t("…")` with an unknown key fails `tsc`.
 * One file per area keeps the diffs small; `npm run check:i18n` flags duplicates across them.
 */
export const en = {
  ...common,
  ...shell,
  ...landing,
  ...auth,
  ...components,
  ...rbac,
  ...status,
  ...dashboard,
  ...match,
  ...registry,
  ...competition,
  ...ingestion,
  ...schedule,
  ...intelligence,
  ...scout,
  ...audit,
  ...settings,
  ...finance,
  ...articles,
};

export type MessageId = keyof typeof en;
