"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  /** Auto-advance speed in px per second. 0 = only moves when dragged. */
  speed?: number;
  /** Space between two items, in px. */
  gap?: number;
  className?: string;
};

/** Friction of a fling: the speed left after one second is e^-FRICTION of it. */
const FRICTION = 3.2;
const MAX_FLING = 2600;
const DRAG_THRESHOLD = 6;

/**
 * An endless row that drifts on its own and can be grabbed: drag it with the mouse or a finger and
 * let go to fling it. It pauses while the pointer is over it or something in it has focus, stops
 * moving for people who ask for less motion (and still drags), and looks the same however few
 * items there are — the list repeats until it fills the width.
 *
 * Position is a plain number moved with a CSS transform on every frame, so it stays smooth and never
 * hits the integer rounding of `scrollLeft`. A drag that moved the row does not click the item
 * under the pointer; a tap does.
 */
export function DragMarquee({ children, speed = 34, gap = 20, className }: Props) {
  const t = useT();
  const items = React.Children.toArray(children);
  const viewport = React.useRef<HTMLDivElement>(null);
  const track = React.useRef<HTMLDivElement>(null);
  const [copies, setCopies] = React.useState(1);
  const s = React.useRef({
    x: 0,
    v: 0,
    setWidth: 0,
    dragging: false,
    moved: false,
    hover: false,
    focus: false,
    offscreen: false,
    reduced: false,
    startX: 0,
    startPos: 0,
    lastX: 0,
    lastT: 0,
  });

  // How many copies of the list make one "set" at least as wide as the viewport; two sets loop seamlessly.
  React.useLayoutEffect(() => {
    const vp = viewport.current;
    const tr = track.current;
    if (!vp || !tr) return;
    const measure = () => {
      const total = tr.scrollWidth;
      const perItemSet = total / (2 * copies); // width of the list once
      if (perItemSet <= 0) return;
      const need = Math.max(1, Math.ceil(vp.clientWidth / perItemSet));
      if (need !== copies) setCopies(need);
      s.current.setWidth = perItemSet * copies;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(tr);
    return () => ro.disconnect();
  }, [copies, items.length]);

  React.useEffect(() => {
    const st = s.current;
    const vp = viewport.current;
    const tr = track.current;
    if (!vp || !tr) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => (st.reduced = media.matches);
    syncMotion();
    media.addEventListener("change", syncMotion);

    const io = new IntersectionObserver(([entry]) => (st.offscreen = !entry.isIntersecting), { threshold: 0 });
    io.observe(vp);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!st.dragging) {
        st.x += st.v * dt;
        st.v *= Math.exp(-FRICTION * dt);
        if (Math.abs(st.v) < 4) st.v = 0;
        if (speed && !st.reduced && !st.hover && !st.focus && !st.offscreen && st.v === 0) st.x += speed * dt;
      }
      const w = st.setWidth;
      if (w > 0) st.x = ((st.x % w) + w) % w;
      tr.style.transform = `translate3d(${-st.x}px,0,0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      media.removeEventListener("change", syncMotion);
      io.disconnect();
    };
  }, [speed]);

  // The listeners of one drag live on `window` and die together with it.
  const drag = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => drag.current?.abort(), []);

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const st = s.current;
    st.dragging = true;
    st.moved = false;
    st.v = 0;
    st.startX = e.clientX;
    st.startPos = st.x;
    st.lastX = e.clientX;
    st.lastT = performance.now();

    drag.current?.abort();
    const ac = new AbortController();
    drag.current = ac;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - st.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) st.moved = true;
      st.x = st.startPos - dx;
      const now = performance.now();
      const dt = (now - st.lastT) / 1000;
      if (dt > 0) {
        const instant = -(ev.clientX - st.lastX) / dt;
        st.v = 0.75 * st.v + 0.25 * Math.max(-MAX_FLING, Math.min(MAX_FLING, instant));
      }
      st.lastX = ev.clientX;
      st.lastT = now;
    };
    const onEnd = () => {
      st.dragging = false;
      // a pause with the finger still down means "stay": no fling
      if (performance.now() - st.lastT > 90) st.v = 0;
      ac.abort();
      // the click that ends this gesture is swallowed (see onClickCapture); a later tap is not
      window.setTimeout(() => (st.moved = false), 0);
    };
    window.addEventListener("pointermove", onMove, { signal: ac.signal });
    window.addEventListener("pointerup", onEnd, { signal: ac.signal });
    window.addEventListener("pointercancel", onEnd, { signal: ac.signal });
  };

  /** Arrow buttons / keys: a gentle fling one way or the other. */
  const nudge = (direction: 1 | -1) => (s.current.v = direction * 1100);

  const set = (key: string, hidden: boolean) =>
    Array.from({ length: copies }, (_, copy) =>
      items.map((item, i) => (
        <div
          key={`${key}-${copy}-${i}`}
          className="shrink-0"
          style={{ marginRight: gap }}
          aria-hidden={hidden || copy > 0 ? true : undefined}
          inert={hidden || copy > 0}
        >
          {item}
        </div>
      )),
    );

  return (
    <div className={cn("group/marquee relative", className)}>
      <div
        ref={viewport}
        role="group"
        aria-roledescription="carousel"
        onPointerDown={down}
        onClickCapture={(e) => {
          if (s.current.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        onPointerEnter={(e) => e.pointerType === "mouse" && (s.current.hover = true)}
        onPointerLeave={() => (s.current.hover = false)}
        onFocusCapture={() => (s.current.focus = true)}
        onBlurCapture={() => (s.current.focus = false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") nudge(1);
          if (e.key === "ArrowLeft") nudge(-1);
        }}
        // a focused card the browser scrolls into view must not shift the row sideways
        onScroll={(e) => (e.currentTarget.scrollLeft = 0)}
        className="cursor-grab touch-pan-y select-none overflow-hidden py-3 active:cursor-grabbing [mask-image:linear-gradient(to_right,transparent,#000_5%,#000_95%,transparent)]"
      >
        <div ref={track} className="flex w-max will-change-transform">
          {set("a", false)}
          {set("b", true)}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-2 right-2 hidden items-center justify-between sm:flex">
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label={t("Geser ke kiri")}
          className="pointer-events-auto grid size-11 place-items-center rounded-full bg-white text-ink opacity-0 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-opacity hover:bg-ink hover:text-white focus-visible:opacity-100 group-hover/marquee:opacity-100"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label={t("Geser ke kanan")}
          className="pointer-events-auto grid size-11 place-items-center rounded-full bg-white text-ink opacity-0 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-opacity hover:bg-ink hover:text-white focus-visible:opacity-100 group-hover/marquee:opacity-100"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
