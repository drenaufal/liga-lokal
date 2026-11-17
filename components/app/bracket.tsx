import { cn } from "@/lib/utils";
import type { MatchRowData } from "./match-row";
import { STAGE_LABEL } from "@/lib/status";
import { matchWinnerSide, placeholderLabel } from "@/lib/fixtures";
import { ClubCrest } from "./club-crest";
import { MemberLink } from "./member-link";
import { getT } from "@/lib/i18n/server";

/**
 * Cup bracket — one column per round, left to right: first round → … → final
 * (+ the third-place match shown separately). Later rounds show "Pemenang …"
 * until their sides are known.
 */
export async function Bracket({ matches }: { matches: MatchRowData[] }) {
  const t = await getT();
  const thirdPlace = matches.filter((m) => m.stage === "third_place");
  const main = matches.filter((m) => m.stage !== "third_place");

  const rounds = [...new Set(main.map((m) => m.round))].sort((a, b) => a - b);
  if (rounds.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-xs text-ink-muted">
        {t("Bagan Cup akan tersedia setelah jadwal dibuat — otomatis dari tab Ringkasan, atau tambahkan pertandingan gugur di tab Jadwal & Hasil.")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {rounds.map((round) => {
          const roundMatches = main.filter((m) => m.round === round);
          const stage = roundMatches[0]?.stage ?? "";
          return (
            <div key={round} className="flex min-w-[220px] flex-1 flex-col justify-around gap-4">
              <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {STAGE_LABEL[stage] ? t.dyn(STAGE_LABEL[stage]) : t("Babak {round}", { round })}
              </p>
              {roundMatches.map((m) => (
                <BracketMatch key={m.id} m={m} />
              ))}
            </div>
          );
        })}
      </div>

      {thirdPlace.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            {t("Perebutan Tempat Ketiga")}
          </p>
          <div className="max-w-[240px]">
            <BracketMatch m={thirdPlace[0]} />
          </div>
        </div>
      )}
    </div>
  );
}

async function BracketMatch({ m }: { m: MatchRowData }) {
  const t = await getT();
  const done = m.status === "completed";
  const winner = done ? matchWinnerSide(m) : null;
  const homeWon = winner === "home";
  const awayWon = winner === "away";
  const level = done && m.homeScore === m.awayScore;
  const pens = level && m.homePenalties != null && m.awayPenalties != null;

  return (
    <MemberLink
      href={`/match-ops/${m.id}`}
      className="block overflow-hidden rounded-lg border border-line bg-surface-2/40 transition-colors hover:border-brand/40"
    >
      <BracketSide
        name={m.homeName ?? placeholderLabel(t, m.homePlaceholder) ?? "TBD"}
        short={m.homeShort}
        logo={m.homeLogo}
        score={done ? m.homeScore : null}
        penalties={pens ? m.homePenalties : null}
        won={homeWon}
        lost={awayWon}
        pending={!m.homeName}
      />
      <div className="h-px bg-line" />
      <BracketSide
        name={m.awayName ?? placeholderLabel(t, m.awayPlaceholder) ?? "TBD"}
        short={m.awayShort}
        logo={m.awayLogo}
        score={done ? m.awayScore : null}
        penalties={pens ? m.awayPenalties : null}
        won={awayWon}
        lost={homeWon}
        pending={!m.awayName}
      />
      <div className="border-t border-line-soft bg-surface/60 px-2.5 py-1 text-[9px] text-ink-muted">
        {m.status === "live"
          ? t("Berlangsung · {minute}'", { minute: m.currentMinute ?? 0 })
          : done
            ? pens
              ? t("Selesai · adu penalti")
              : t("Selesai")
            : t("Terjadwal")}
      </div>
    </MemberLink>
  );
}

function BracketSide({
  name,
  short,
  logo,
  score,
  penalties,
  won,
  lost,
  pending,
}: {
  name: string;
  short?: string | null;
  logo?: string | null;
  score: number | null;
  penalties?: number | null;
  won?: boolean;
  lost?: boolean;
  /** The side is still a "Pemenang …" placeholder. */
  pending?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-2",
        won && "bg-brand/5",
      )}
    >
      {pending ? (
        <span className="size-7 shrink-0 rounded-full border border-dashed border-line" aria-hidden />
      ) : (
        <ClubCrest logoUrl={logo} short={short} size={28} className="rounded" />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs",
          pending
            ? "italic text-ink-muted"
            : lost
              ? "text-ink-muted"
              : won
                ? "font-semibold text-ink"
                : "text-ink-secondary",
        )}
      >
        {name}
      </span>
      {score !== null && (
        <span
          className={cn(
            "font-mono text-xs font-bold tabular-nums",
            won ? "text-brand" : "text-ink-muted",
          )}
        >
          {score}
          {penalties != null && <span className="ml-1 text-[10px] font-semibold">({penalties})</span>}
        </span>
      )}
    </div>
  );
}
