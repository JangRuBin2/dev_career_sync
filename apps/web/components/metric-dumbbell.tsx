import { formatImprovement } from "@careersync/core";
import type { Metric } from "@careersync/core/notion";
import { Badge } from "./ui";

/**
 * 성과 지표 Before → After (dumbbell).
 * - 지표마다 단위가 달라(ms·건·%) 축을 공유하지 않고, 행마다 0 ~ max(before, after) 로 그린다.
 * - 색은 한 hue 두 단계: 이전 = 연한 accent, 이후 = accent (light/dark 모두 validator 통과).
 * - 값은 텍스트 토큰으로 행 아래에 적고(표 대용), 점에 hover/focus 하면 툴팁.
 */
const BEFORE = "color-mix(in srgb, var(--accent) 55%, var(--surface))";
const AFTER = "var(--accent)";

const fmt = (n: number | null, unit: string | null) => (n === null ? "?" : `${n.toLocaleString("ko-KR")}${unit ? ` ${unit}` : ""}`);

function Dot({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const left = max > 0 ? (value / max) * 100 : 0;
  return (
    <span
      tabIndex={0}
      aria-label={label}
      className="group absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center outline-none"
      style={{ left: `${left}%` }}
    >
      <span
        className="block h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125 group-focus:scale-125"
        style={{ background: color, boxShadow: "0 0 0 2px var(--surface)" }}
      />
      <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink shadow-sm group-hover:block group-focus:block">
        {label}
      </span>
    </span>
  );
}

export function MetricDumbbell({ metric: m }: { metric: Metric }) {
  const hasBoth = m.before !== null && m.after !== null;
  const max = Math.max(m.before ?? 0, m.after ?? 0);
  const improved = (m.improvement ?? 0) > 0;
  const worse = (m.improvement ?? 0) < 0;
  const lo = hasBoth ? (Math.min(m.before!, m.after!) / (max || 1)) * 100 : 0;
  const hi = hasBoth ? (Math.max(m.before!, m.after!) / (max || 1)) * 100 : 0;

  return (
    <li>
      <div className="flex items-start justify-between gap-2 text-sm">
        <span className="min-w-0">{m.name}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-semibold tabular-nums">{formatImprovement(m.improvement)}</span>
          {improved && <Badge tone="good">▲ 개선</Badge>}
          {worse && <Badge tone="bad">▼ 악화</Badge>}
        </span>
      </div>
      {hasBoth ? (
        <div className="relative mx-3 mt-1 h-6" role="img" aria-label={`${m.name}: 이전 ${fmt(m.before, m.unit)}, 이후 ${fmt(m.after, m.unit)}`}>
          {/* 기준선 (0 ~ max) */}
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
          {/* 연결선 */}
          <span className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full" style={{ left: `${lo}%`, width: `${hi - lo}%`, background: AFTER }} />
          <Dot value={m.before!} max={max} color={BEFORE} label={`이전 ${fmt(m.before, m.unit)}`} />
          <Dot value={m.after!} max={max} color={AFTER} label={`이후 ${fmt(m.after, m.unit)}`} />
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">이전/이후 값이 모두 있어야 그래프를 그려요.</p>
      )}
      <div className="mt-0.5 text-xs text-muted">
        <span className="tabular-nums">
          {fmt(m.before, m.unit)} → {fmt(m.after, m.unit)}
        </span>
        {m.direction ? ` · ${m.direction}` : ""} · {m.method || "측정 방법 미기재"}
      </div>
    </li>
  );
}

/** 카드 상단 범례 (2개 계열이라 범례 필수) */
export function MetricLegend() {
  return (
    <span className="flex items-center gap-3 text-xs font-normal text-muted">
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: BEFORE }} />
        이전
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: AFTER }} />
        이후
      </span>
    </span>
  );
}
