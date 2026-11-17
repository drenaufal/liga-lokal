/**
 * Consistency checks for the English catalog (lib/i18n/messages). `tsc` already rejects a
 * `t("…")` call whose text is not a key; this covers what the type system cannot see:
 *
 *   - every area file is registered in messages/index.ts
 *   - no text is defined in two area files (the later spread would silently win)
 *   - the English value uses the same {placeholders} as the Indonesian key
 *   - plural forms ({n|one|many}) are well formed and refer to a placeholder of the key
 *   - inline tags (<b>, <i>, <code>) match between key and value
 *
 * Run with `npm run check:i18n`.
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "lib/i18n/messages");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts").sort();
const index = fs.readFileSync(path.join(dir, "index.ts"), "utf8");

const errors: string[] = [];
const warnings: string[] = [];
const owner = new Map<string, string>();
let total = 0;

const placeholders = (text: string) => new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const tags = (text: string) => [...text.matchAll(/<\/?(b|i|code)>/g)].map((m) => m[0]).sort().join("");

for (const file of files) {
  const area = file.replace(/\.ts$/, "");
  if (!new RegExp(`import \\{ ${area} \\} from "\\./${area}";`).test(index)) errors.push(`${file}: not imported in messages/index.ts`);
  if (!new RegExp(`\\.\\.\\.${area},`).test(index)) errors.push(`${file}: not spread into \`en\` in messages/index.ts`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports -- tsx runs this as CommonJS
  const mod = require(path.join(dir, file));
  const entries: Record<string, string> = mod[area];
  if (!entries) {
    errors.push(`${file}: expected an export named "${area}"`);
    continue;
  }

  for (const [key, value] of Object.entries(entries)) {
    total++;
    const where = `${area}: ${JSON.stringify(key.length > 70 ? key.slice(0, 70) + "…" : key)}`;
    const other = owner.get(key);
    if (other) errors.push(`${where} is also defined in ${other}`);
    else owner.set(key, area);

    if (!value.trim()) {
      errors.push(`${where} has an empty English text`);
      continue;
    }

    const text = key.split("::")[0];
    const have = placeholders(text);

    // plural forms: {n|one|many}
    for (const group of value.match(/\{[^{}]*\|[^{}]*\}/g) ?? []) {
      const m = /^\{(\w+)\|([^|{}]*)\|([^{}]*)\}$/.exec(group);
      if (!m) errors.push(`${where}: malformed plural form ${group}`);
      else if (!have.has(m[1])) errors.push(`${where}: plural form ${group} refers to {${m[1]}}, which the key does not have`);
    }

    const used = new Set([...value.matchAll(/\{(\w+)(?:\|[^{}]*)?\}/g)].map((m) => m[1]));
    for (const name of used) if (!have.has(name)) errors.push(`${where}: English uses {${name}}, which the key does not have`);
    for (const name of have) if (!used.has(name)) warnings.push(`${where}: English leaves out {${name}}`);

    if (tags(text) !== tags(value)) errors.push(`${where}: inline tags differ between the key and the English text`);
  }
}

for (const message of warnings) console.warn(`warn  ${message}`);
for (const message of errors) console.error(`error ${message}`);
console.log(`${total} messages in ${files.length} files · ${errors.length} errors · ${warnings.length} warnings`);
if (errors.length) process.exit(1);
