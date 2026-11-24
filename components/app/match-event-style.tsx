import { ArrowUpRight, Flag, Goal, Hand, Route, ShieldAlert, ShieldCheck, Sparkles, Target } from "lucide-react";

function CardGlyph({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-[17px] w-[12px] rotate-6 rounded-[2px] ring-1 ring-black/10" style={{ background: color }} />;
}

const YellowCard = () => <CardGlyph color="var(--color-block-yellow)" />;
const RedCard = () => <CardGlyph color="var(--color-brand)" />;

/** Shared by the quick-record controls (player and team) and the match statistics labels. */
export const MATCH_EVENT_STYLE = {
  goal: { icon: Goal, tile: " text-black " },
  assist: { icon: Sparkles, tile: "text-black" },
  shot_on: { icon: Target, tile: "text-black" },
  save: { icon: Hand, tile: "text-black" },
  interception: { icon: ShieldCheck, tile: "text-black" },
  shot_off: { icon: ArrowUpRight, tile: "text-black" },
  red_card: { icon: RedCard, tile: "text-black" },
  yellow_card: { icon: YellowCard, tile: "text-black" },
  corner: { icon: Flag, tile: "text-black" },
  foul: { icon: ShieldAlert, tile: "text-black" },
  pass: { icon: Route, tile: "text-black" },
};
