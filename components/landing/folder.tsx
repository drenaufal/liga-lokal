import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Folder-shaped card from the homepage design: a darker tab peeks out behind
 * the top-left corner and the lighter body rises to full height at the right
 * through a short diagonal. The tab is a stretched SVG strip, the body a plain
 * rounded block, so the card grows with its content.
 */
export function Folder({
  body,
  tab,
  className,
  bodyClassName,
  children,
}: {
  /** Fill of the card (hex). */
  body: string;
  /** Fill of the tab behind it (hex). */
  tab: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <svg aria-hidden viewBox="0 0 280 28" preserveAspectRatio="none" className="-mb-px block h-7 w-full shrink-0">
        <path d="M0 28V12Q0 0 12 0H172V28Z" fill={tab} />
        <path d="M0 28V16Q0 12 6 12H116Q124 12 129 7L137 3Q142 0 150 0H268Q280 0 280 12V28Z" fill={body} />
      </svg>
      <div className={cn("flex-1 rounded-b-[1.75rem]", bodyClassName)} style={{ background: body }}>
        {children}
      </div>
    </div>
  );
}
