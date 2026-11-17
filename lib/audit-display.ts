import { audit } from "@/lib/i18n/messages/audit";
import type { Locale } from "@/lib/i18n/config";
import type { MessageId, TFunction, Vars } from "@/lib/i18n/translate";

/**
 * Audit entries are stored in Indonesian. For an English viewer each stored text is matched back
 * against the templates of lib/i18n/messages/audit.ts (`Data SSB {name} diperbarui{changed}`), the
 * pieces it carried are picked out again, and the English template is filled with them.
 * Text that matches no template — free text, or entries from before a template existed — is
 * shown as it was stored (or by its catalog entry, when it is a fixed text).
 */

type Rule = { id: MessageId; rx: RegExp; names: string[]; fixed: number };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let rules: Rule[] | undefined;

function compile(): Rule[] {
  return (Object.keys(audit) as MessageId[])
    .map((id) => {
      const names: string[] = [];
      let source = "";
      id.split("::")[0].split(/\{(\w+)\}/).forEach((part, index) => {
        if (index % 2 === 0) {
          source += escape(part);
          return;
        }
        names.push(part);
        // " (nama, logo)" or nothing at all
        source += part === "changed" ? "((?: \\([^()]*\\))?)" : "([\\s\\S]+?)";
      });
      return { id, names, rx: new RegExp("^" + source + "$"), fixed: source.length };
    })
    // the template with the most fixed text is the most specific one
    .sort((a, b) => b.fixed - a.fixed);
}

const each = (value: string, fn: (part: string) => string) => value.split(", ").map(fn).join(", ");

function translatePiece(t: TFunction, name: string, raw: string) {
  // " (nama, logo)" → " (name, logo)"
  if (name === "changed") return raw.replace(/^ \((.*)\)$/, (_m, inner: string) => ` (${each(inner, (p) => t.dyn(p))})`);
  // "Operator Kompetisi (+3 / −1), Wasit (+1 / −0)" → role names translated, counts kept
  if (name === "roles") return each(raw, (p) => p.replace(/^(.+?)( \(\+\d+ \/ −\d+\))$/, (_m, role: string, rest: string) => t.dyn(role) + rest));
  return t.dyn(raw);
}

/** The summary of an audit entry as the viewer should read it. `t` is the viewer's translator. */
export function localizeAudit(t: TFunction, locale: Locale, summary: string): string {
  if (locale !== "en") return summary;
  rules ??= compile();
  for (const rule of rules) {
    const match = rule.rx.exec(summary);
    if (!match) continue;
    const vars: Vars = {};
    rule.names.forEach((name, index) => {
      vars[name] = translatePiece(t, name, match[index + 1] ?? "");
    });
    return t(rule.id, vars);
  }
  // a fixed text that is already in the catalog (the seed data has some) translates as it is
  return t.dyn(summary);
}
