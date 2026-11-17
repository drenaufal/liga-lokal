import { ArrowUpRight, Flag, Goal, Hand, Route, ShieldAlert, ShieldCheck, Sparkles, Target } from "lucide-react";

function CardGlyph({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-[17px] w-[12px] rotate-6 rounded-[2px] ring-1 ring-black/10" style={{ background: color }} />;
}

const YellowCard = () => <CardGlyph color="var(--color-block-yellow)" />;
const RedCard = () => <CardGlyph color="var(--color-brand)" />;

/** Shared by the quick-record controls (player and team) and the match statistics labels. */
export const MATCH_EVENT_STYLE = {
  goal: { icon: Goal, tile: "bg-brand text-white hover:bg-brand-dark" },
  assist: { icon: Sparkles, tile: "bg-block-blue text-white hover:brightness-95" },
  shot_on: { icon: Target, tile: "bg-block-mint text-ink hover:brightness-95" },
  save: { icon: Hand, tile: "bg-block-lavender text-ink hover:brightness-95" },
  interception: { icon: ShieldCheck, tile: "bg-block-pink text-ink hover:brightness-95" },
  shot_off: { icon: ArrowUpRight, tile: "bg-block-orange text-ink hover:brightness-95" },
  red_card: { icon: RedCard, tile: "bg-surface text-ink ring-1 ring-line hover:bg-elevated" },
  yellow_card: { icon: YellowCard, tile: "bg-surface text-ink ring-1 ring-line hover:bg-elevated" },
  corner: { icon: Flag, tile: "bg-block-sky text-ink" },
  foul: { icon: ShieldAlert, tile: "bg-block-coral text-ink" },
  pass: { icon: Route, tile: "bg-block-lime text-ink" },
};
