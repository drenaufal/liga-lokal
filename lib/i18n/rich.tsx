import * as React from "react";

type Render = (children: React.ReactNode) => React.ReactNode;
type Tags = Partial<Record<"b" | "i" | "code", Render>>;

const DEFAULT_TAGS: Record<"b" | "i" | "code", Render> = {
  b: (children) => <strong>{children}</strong>,
  i: (children) => <em>{children}</em>,
  code: (children) => <code>{children}</code>,
};

/**
 * Renders a translated message that carries simple inline markup — `<b>…</b>`, `<i>…</i>`,
 * `<code>…</code>` — so a sentence with one emphasised word is still a single message that
 * translators can reorder freely. Tags do not nest. Pass `tags` to style them.
 */
export function rich(text: string, tags: Tags = {}): React.ReactNode {
  const parts = text.split(/(<(?:b|i|code)>.*?<\/(?:b|i|code)>)/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    const match = /^<(b|i|code)>(.*)<\/\1>$/.exec(part);
    if (!match) return <React.Fragment key={index}>{part}</React.Fragment>;
    const render = tags[match[1] as keyof Tags] ?? DEFAULT_TAGS[match[1] as keyof Tags];
    return <React.Fragment key={index}>{render(match[2])}</React.Fragment>;
  });
}
