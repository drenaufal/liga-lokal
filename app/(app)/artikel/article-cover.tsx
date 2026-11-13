import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cover image of an article; articles without one get a plain tile so cards keep their shape. */
export function ArticleCover({ url, title, className }: { url: string | null; title: string; className?: string }) {
  return (
    <div className={cn("relative aspect-[16/9] w-full overflow-hidden bg-night", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div aria-hidden className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#3a3a3a_0%,#151515_70%)] text-white/25">
          <Newspaper className="size-10" />
        </div>
      )}
    </div>
  );
}
