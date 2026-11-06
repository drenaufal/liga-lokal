import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getLatestArticles } from "@/lib/queries/articles";
import { articleSummary } from "@/lib/articles";
import { cn } from "@/lib/utils";

const TINTS = ["bg-block-blue", "bg-block-yellow", "bg-block-mint"] as const;

/**
 * Home page: the latest published articles, right below the tournaments. Left out when there is
 * nothing to show, or when the database cannot be reached — the rest of the home page must never
 * depend on it. Articles are written and published in Artikel (admin).
 */
export async function ArticleSection() {
  const { t, fmt } = await getI18n();
  let items: Awaited<ReturnType<typeof getLatestArticles>>;
  try {
    items = await getLatestArticles(3);
  } catch (e) {
    console.error("[home] articles unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
  if (!items.length) return null;

  return (
    <section aria-labelledby="home-articles" className="relative py-10 lg:py-16">
      <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-coral sm:text-[16px]">{t("Artikel")}</p>
            <h2 id="home-articles" className="mt-2 font-headline text-[52px] uppercase leading-[0.88] text-ink sm:text-[76px] xl:text-[88px]">
              {t("Kabar terbaru")}
            </h2>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-snug text-ink-secondary sm:text-base">
              {t("Berita, laporan pekan, dan cerita dari kompetisi dan pembinaan pemain.")}
            </p>
          </div>
          <Link
            href="/artikel"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-ink px-7 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand lg:self-auto"
          >
            {t("Lihat semua artikel")} <ArrowRight className="size-4" />
          </Link>
        </div>

        <ul className="mt-8 grid gap-5 md:grid-cols-3 lg:mt-10">
          {items.map((a, i) => (
            <li key={a.id} className="min-w-0">
              <Link href={`/artikel/${a.id}`} className="group block h-full overflow-hidden rounded-[2rem] bg-white ring-1 ring-black/5 transition-shadow hover:shadow-[0_24px_50px_-28px_rgba(20,20,20,0.55)]">
                <div className={cn("relative aspect-[16/10] w-full overflow-hidden", TINTS[i % TINTS.length])}>
                  {a.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.coverUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div aria-hidden className="absolute inset-0 grid place-items-center text-ink/25">
                      <Newspaper className="size-12" />
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <p className="text-xs font-semibold text-ink-muted">
                    {a.publishedAt ? fmt.date(a.publishedAt, { day: "numeric", month: "long", year: "numeric" }) : ""}
                  </p>
                  <h3 className="mt-2 line-clamp-3 font-headline text-[34px] uppercase leading-[0.95] text-ink transition-colors group-hover:text-brand">{a.title}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-secondary">{articleSummary({ excerpt: a.excerpt, body: a.bodyPreview })}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand">
                    {t("Baca selengkapnya")} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
