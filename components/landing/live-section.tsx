import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getFeaturedTournaments, getLiveFeed } from "@/lib/queries/live-feed";
import { LiveTournaments } from "./live-tournaments";

/**
 * Home page: the tournaments being played now and the ones about to open, as a row visitors can
 * drag. Each card opens its tournament page; goals, cards and substitutions the operators record
 * are announced as they happen (see LiveTournaments). Left out when there is nothing to show, or
 * when the database cannot be reached — the rest of the home page must never depend on it.
 */
export async function LiveSection() {
  const { t } = await getI18n();
  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load();
  } catch (e) {
    console.error("[home] live tournaments unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
  if (!data.items.length) return null;

  return (
    <section aria-labelledby="live-tournaments" className="relative py-10 lg:py-16">
      <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-coral sm:text-[16px]">
              <span className="animate-live size-2.5 rounded-full bg-brand" />
              {t("Turnamen")}
            </p>
            <h2 id="live-tournaments" className="mt-2 font-headline text-[52px] uppercase leading-[0.88] text-ink sm:text-[76px] xl:text-[88px]">
              {t("Sedang berlangsung & segera hadir")}
            </h2>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-snug text-ink-secondary sm:text-base">
              {t("Geser barisnya, lalu klik turnamen untuk membuka halamannya. Skor dan kejadian pertandingan — gol, kartu, pergantian — muncul di sini begitu operator mencatatnya.")}
            </p>
          </div>
          <Link
            href="/kompetisi"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-ink px-7 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand lg:self-auto"
          >
            {t("Lihat semua turnamen")} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="mt-6 lg:mt-8">
        <LiveTournaments items={data.items} initialFeed={data.feed} />
      </div>
    </section>
  );
}

async function load() {
  const [items, feed] = await Promise.all([getFeaturedTournaments(), getLiveFeed()]);
  return { items, feed };
}
