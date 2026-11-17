import type { Locale } from "./config";
import type { MessageId } from "./messages";

export type { MessageId };

export type Vars = Record<string, string | number>;

/**
 * Marks a string as a translatable message without translating it yet — for catalogs and
 * constants that are defined at module level and rendered later through `t(...)`.
 */
export function msg<K extends MessageId>(id: K): K {
  return id;
}

/**
 * `{name}` is replaced by `vars.name`. `{n|singular|plural}` picks a form by `vars.n`, which
 * English needs ("1 player", "2 players") and Indonesian does not.
 */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)(?:\|([^|{}]*)\|([^{}]*))?\}/g, (whole, name: string, one?: string, other?: string) => {
    const value = vars[name];
    if (value === undefined) return whole;
    if (one !== undefined) return Number(value) === 1 ? one : (other ?? "");
    return String(value);
  });
}

export type TFunction = {
  /** Translates a message that exists in the catalog. An unknown id is a type error. */
  (id: MessageId, vars?: Vars): string;
  /**
   * Translates a string that is only known at runtime (a label read from a catalog, say).
   * Falls back to the text itself, so unknown strings — and user-entered data — pass through.
   */
  dyn(text: string, vars?: Vars): string;
};

/**
 * Two different English words for the same Indonesian one get a context suffix after `::` —
 * `"Modul"` (the nav section) and `"Modul::jenis"` (the kind of search result). The suffix is
 * the translator's hint only; it is never shown.
 */
const CONTEXT = "::";
const withoutContext = (id: string) => {
  const at = id.indexOf(CONTEXT);
  return at === -1 ? id : id.slice(0, at);
};

export function createT(locale: Locale, messages: Readonly<Record<string, string>>): TFunction {
  const english = locale === "en";
  const known = (text: string) => (Object.hasOwn(messages, text) ? messages[text] : undefined);
  const t = ((id: string, vars?: Vars) =>
    interpolate((english ? known(id) : undefined) ?? withoutContext(id), vars)) as TFunction;
  // Runtime strings may be user data, so they are never cut at a "::".
  t.dyn = (text, vars) => interpolate((english ? known(text) : undefined) ?? text, vars);
  return t;
}
