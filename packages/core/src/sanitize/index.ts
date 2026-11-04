/**
 * 보안 마스킹 1단계: 금지어 사전 + 패턴 기반 치환.
 * (2단계 LLM 검토, 3단계 사람 승인은 별도)
 */

export interface DenyRule {
  from: string;
  to: string;
}

/**
 * "회사명=A사,고객사=B사" 또는 줄바꿈 구분 형식을 파싱한다.
 * '=' 가 없으면 기본 치환어 "[비공개]" 를 쓴다.
 */
export function parseDenylist(raw: string | undefined | null): DenyRule[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf("=");
      if (idx === -1) return { from: entry, to: "[비공개]" };
      return { from: entry.slice(0, idx).trim(), to: entry.slice(idx + 1).trim() || "[비공개]" };
    })
    .filter((r) => r.from.length > 0)
    // 긴 단어부터 치환해야 부분 일치로 깨지지 않는다
    .sort((a, b) => b.from.length - a.from.length);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATTERNS: { re: RegExp; to: string }[] = [
  { re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, to: "[이메일]" },
  { re: /\b01[016789]-?\d{3,4}-?\d{4}\b/g, to: "[전화번호]" },
  { re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, to: "[IP]" },
  { re: /\bhttps?:\/\/[^\s)]*\.(?:internal|corp|local|intra)(?:[:/][^\s)]*)?/gi, to: "[내부 URL]" },
  { re: /\b(?:sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{16,}\b/g, to: "[토큰]" },
];

export function maskText(text: string, rules: DenyRule[]): string {
  let out = text;
  for (const { re, to } of PATTERNS) out = out.replace(re, to);
  for (const rule of rules) {
    out = out.replace(new RegExp(escapeRegExp(rule.from), "gi"), rule.to);
  }
  return out;
}

/** 외부 발행 직전 검사: 금지어/패턴이 남아 있으면 목록을 돌려준다 */
export function findLeaks(text: string, rules: DenyRule[]): string[] {
  const leaks = new Set<string>();
  for (const rule of rules) {
    if (new RegExp(escapeRegExp(rule.from), "i").test(text)) leaks.add(rule.from);
  }
  for (const { re, to } of PATTERNS) {
    const matches = text.match(new RegExp(re.source, re.flags));
    if (matches?.length) leaks.add(`${to} 패턴: ${matches[0]}`);
  }
  return [...leaks];
}
