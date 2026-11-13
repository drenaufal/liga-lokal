"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

export type RadarAxis = { key: string; label: string };
export type RadarSeries = { label: string; color: string; values: Record<string, number> };

/**
 * Radar / spider chart for a player's multi-metric profile (actual counters,
 * scaled to a shared maximum across all series). 1–3 series; legend for ≥2;
 * axis labels always visible; hover a vertex for the exact value.
 */
export function Radar({
  axes,
  series,
  size = 320,
  className,
}: {
  axes: RadarAxis[];
  series: RadarSeries[];
  size?: number;
  className?: string;
}) {
  const t = useT();
  const [hover, setHover] = React.useState<{ s: number; a: number } | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const n = axes.length;

  const maxValue = Math.max(1, ...series.flatMap((s) => axes.map((a) => s.values[a.key] ?? 0)));
  const point = (axisIdx: number, value: number) => {
    const angle = (Math.PI * 2 * axisIdx) / n - Math.PI / 2;
    const dist = (value / 100) * r;
    return [cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist];
  };

  const rings = [25, 50, 75, 100];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg viewBox={"-45 -20 " + (size + 90) + " " + (size + 40)} width={size + 90} height={size + 40} className="max-w-full" role="img" aria-label={t("Radar statistik pertandingan")}>
        {/* grid rings */}
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={axes
              .map((_, i) => point(i, ring).join(","))
              .join(" ")}
            fill="none"
            stroke="var(--color-grid)"
            strokeWidth={1}
          />
        ))}
        {/* spokes */}
        {axes.map((_, i) => {
          const [x, y] = point(i, 100);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--color-grid)"
              strokeWidth={1}
            />
          );
        })}
        {/* series */}
        {series.map((s, si) => {
          const pts = axes.map((a, i) => point(i, ((s.values[a.key] ?? 0) / maxValue) * 100));
          return (
            <g key={s.label}>
              <polygon
                points={pts.map((p) => p.join(",")).join(" ")}
                fill={s.color}
                fillOpacity={series.length > 1 ? 0.12 : 0.16}
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {pts.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={hover?.s === si && hover?.a === i ? 5 : 3}
                  fill="var(--color-surface)"
                  stroke={s.color}
                  strokeWidth={2}
                  onMouseEnter={() => setHover({ s: si, a: i })}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </g>
          );
        })}
        {/* axis labels */}
        {axes.map((a, i) => {
          const [x, y] = point(i, 122);
          return (
            <text
              key={a.key}
              x={x}
              y={y}
              textAnchor={x < cx - 8 ? "end" : x > cx + 8 ? "start" : "middle"}
              dominantBaseline="middle"
              className="fill-[var(--color-ink-secondary)] text-[10px] font-medium"
            >
              {a.label}
            </text>
          );
        })}
        {hover && (
          <g>
            {(() => {
              const [x, y] = point(hover.a, ((series[hover.s].values[axes[hover.a].key] ?? 0) / maxValue) * 100);
              return (
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  className="fill-[var(--color-ink)] text-[10px] font-semibold"
                >
                  {Math.round(series[hover.s].values[axes[hover.a].key] ?? 0)}
                </text>
              );
            })()}
          </g>
        )}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {series.map((s) => (
            <span
              key={s.label}
              className="flex items-center gap-1.5 text-[11px] text-ink-secondary"
            >
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
