import type { Direction } from "../notion/schema";

/** Notion 수식과 같은 규칙의 개선율(%) — 소수점 첫째 자리 */
export function improvementRate(before: number, after: number, direction: Direction): number {
  if (before === 0) return 0;
  const raw = direction === "낮을수록 좋음" ? (before - after) / before : (after - before) / before;
  return Math.round(raw * 1000) / 10;
}

export function formatImprovement(rate: number | null): string {
  if (rate === null || Number.isNaN(rate)) return "-";
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate}%`;
}

/** 텍스트에 등장하는 숫자들 (콤마·소수 포함) */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? [];
  return matches.map((m) => Number(m.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
}

/**
 * LLM 이 만든 지표의 숫자가 원문에 실제로 있는지 검사 (환각 방지).
 * 1000 단위 표기(1.2k, 3만 등)는 지원하지 않으므로 원문 그대로의 숫자만 통과.
 */
export function numbersAppearIn(source: string, ...values: number[]): boolean {
  const nums = new Set(extractNumbers(source));
  return values.every((v) => nums.has(v));
}
