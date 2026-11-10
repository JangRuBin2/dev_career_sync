/**
 * 채용공고(JD) 맞춤 이력서.
 *
 * resume-ai-toolkit 의 워크플로우를 그대로 옮겼다:
 *   원본은 보존 → 공고 분석(필수/우대/직무 핵심) → 내 레퍼런스에서 매칭 → 부족 항목 파악
 *   → "없는 경험을 만들지 않고 강조점만 바꾼" 회사별 맞춤본 생성.
 *
 * 이 파일은 순수 로직만 담는다 (LLM 호출은 ../llm/tailor.ts).
 *  - buildTailorMaterial: Notion 데이터 → LLM/프롬프트에 넣을 근거 묶음 (짧은 ID 부여, 마스킹)
 *  - matchJobKeywords: LLM 없이 공고 ↔ 내 기술스택 키워드 매칭
 *  - buildTailorPrompt: Claude.ai/ChatGPT 에 붙여넣을 프롬프트 (toolkit Step 3)
 *  - validateTailored: 환각 방지 (모르는 근거 ID, 원문에 없는 숫자, 없는 기술 제거)
 *  - renderTailoredResume: toolkit 의 이력서_맞춤.md 구조로 Markdown 렌더
 *  - renderToolkitReference: 프로젝트를 toolkit 의 reference/*.md 형식으로 내보내기
 */
import type { Achievement, Metric, Project, RecordEntry } from "../notion/types";
import { extractNumbers, formatImprovement } from "../metrics";
import { maskText, type DenyRule } from "../sanitize";
import { renderResume, type ResumeProfile } from "../resume";

// ---------- 근거 묶음 ----------

export interface MaterialSource {
  /** 프롬프트용 짧은 ID: A1(성과) · R1(기록) · M1(지표) */
  key: string;
  kind: "achievement" | "record" | "metric";
  /** Notion 페이지 ID */
  id: string;
  /** 이 근거가 속한 프로젝트 키 (P1 …) */
  projectKeys: string[];
  /** 사람이 확정한 근거인지 (성과: 확인됨/새 프로젝트, 기록·지표: 확정) */
  confirmed: boolean;
  /** 프롬프트에 그대로 들어가는 본문 (마스킹 후) */
  text: string;
  /** 숫자 검증에 쓰는 값 (지표의 before/after/개선율 등) */
  numbers: number[];
}

export interface MaterialProject {
  key: string;
  project: Project;
  /** 프로젝트 + 연결된 기록의 기술 (중복 제거) */
  tech: string[];
}

export interface TailorMaterial {
  projects: MaterialProject[];
  sources: MaterialSource[];
  /** 내 기술 전체 (프로젝트 stack + 기록 tech) */
  skills: string[];
}

const CONFIRMED_ASSIGNMENT = new Set(["확인됨", "새 프로젝트"]);

const uniq = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = normalizeSkill(s);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function normalizeSkill(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "").replace(/\.js$/, "js");
}

/**
 * 이력서 맞춤에 쓸 근거를 모은다.
 * - 반려·보류된 성과는 제외. 추천 단계(미확정) 성과·초안 기록도 넣되 confirmed=false 로 표시해
 *   맞춤본에서 "확인 필요"로 드러나게 한다.
 * - 모든 본문은 DENYLIST 로 마스킹한다 (회사·고객사 이름이 LLM·이력서로 새지 않도록).
 */
export function buildTailorMaterial(input: {
  projects: Project[];
  records: RecordEntry[];
  metrics: Metric[];
  achievements: Achievement[];
  denylist?: DenyRule[];
}): TailorMaterial {
  const rules = input.denylist ?? [];
  const mask = (s: string) => maskText(s, rules);

  const projects: MaterialProject[] = input.projects.map((p, i) => ({
    key: `P${i + 1}`,
    project: { ...p, name: mask(p.name), summary: mask(p.summary), role: mask(p.role) },
    tech: uniq([...p.stack, ...input.records.filter((r) => r.projectIds.includes(p.id)).flatMap((r) => r.tech)]),
  }));
  const projectKeyById = new Map(projects.map((p) => [p.project.id, p.key]));
  const keysOf = (ids: string[]) => ids.map((id) => projectKeyById.get(id)).filter((k): k is string => Boolean(k));

  const sources: MaterialSource[] = [];

  input.achievements
    .filter((a) => a.assignment !== "반려" && a.assignment !== "보류")
    .forEach((a, i) => {
      const projectIds = a.projectIds.length ? a.projectIds : a.suggestedProjectId ? [a.suggestedProjectId] : [];
      const text = mask(a.text);
      sources.push({
        key: `A${i + 1}`,
        kind: "achievement",
        id: a.id,
        projectKeys: keysOf(projectIds),
        confirmed: a.assignment !== null && CONFIRMED_ASSIGNMENT.has(a.assignment),
        text,
        numbers: extractNumbers(text),
      });
    });

  const recordProjects = new Map(input.records.map((r) => [r.id, r.projectIds]));
  input.records.forEach((r, i) => {
    const text = mask([r.title, r.summary, r.highlights, r.role && `역할: ${r.role}`].filter(Boolean).join("\n"));
    sources.push({
      key: `R${i + 1}`,
      kind: "record",
      id: r.id,
      projectKeys: keysOf(r.projectIds),
      confirmed: r.status === "확정",
      text,
      numbers: extractNumbers(text),
    });
  });

  input.metrics.forEach((m, i) => {
    const projectIds = m.recordIds.flatMap((id) => recordProjects.get(id) ?? []);
    const nums = [m.before, m.after, m.improvement].filter((n): n is number => typeof n === "number");
    const rate = m.improvement !== null ? Math.abs(m.improvement) : null;
    // "40% 단축"처럼 반올림해서 쓰는 경우를 허용
    if (rate !== null) nums.push(rate, Math.round(rate));
    const text = mask(
      `${m.name}: ${m.before ?? "?"} → ${m.after ?? "?"} ${m.unit ?? ""} (개선율 ${formatImprovement(m.improvement)}, ${m.direction ?? "방향 미기재"})` +
        (m.method ? ` · 측정: ${m.method}` : ""),
    );
    sources.push({
      key: `M${i + 1}`,
      kind: "metric",
      id: m.id,
      projectKeys: keysOf(projectIds),
      confirmed: m.status === "확정",
      text,
      numbers: [...nums, ...extractNumbers(text)],
    });
  });

  return { projects, sources, skills: uniq(projects.flatMap((p) => p.tech)) };
}

/** LLM 에 넣는 근거 블록 (짧은 ID 로 참조하게 한다) */
export function materialToPrompt(material: TailorMaterial): string {
  const lines: string[] = ["<projects>"];
  for (const p of material.projects) {
    lines.push(
      JSON.stringify({
        key: p.key,
        name: p.project.name,
        period: p.project.period,
        role: p.project.role,
        summary: p.project.summary,
        tech: p.tech,
        onResume: p.project.onResume,
      }),
    );
  }
  lines.push("</projects>", "", "<evidence>");
  for (const s of material.sources) {
    lines.push(JSON.stringify({ key: s.key, kind: s.kind, projects: s.projectKeys, confirmed: s.confirmed, text: s.text }));
  }
  lines.push("</evidence>");
  return lines.join("\n");
}

// ---------- LLM 없이: 키워드 매칭 ----------

export interface KeywordMatch {
  /** 공고에도 있고 내 기술에도 있는 것 */
  matched: string[];
  /** 공고에 나오지만 내 기술 목록에는 없는 영문 기술 키워드 (부족 항목 후보) */
  missing: string[];
  /** 프로젝트별 매칭 점수 (높은 순) */
  projects: { key: string; name: string; score: number; matched: string[] }[];
}

const STOP_WORDS = new Set(
  [
    "and", "or", "the", "of", "to", "in", "for", "with", "on", "a", "an", "is", "are", "be", "we", "you", "our", "your",
    "experience", "years", "year", "team", "service", "services", "skills", "etc", "plus", "based", "using", "development",
    "developer", "engineer", "api", "apis", "it", "sw", "engineering", "job", "position", "work", "working", "knowledge", "understanding", "ability",
    "good", "strong", "preferred", "required", "requirements", "qualifications", "responsibilities", "about", "who", "what",
  ].map((s) => s.toLowerCase()),
);

/** 공고에서 영문 기술 키워드 후보를 뽑는다 (React, Next.js, CI/CD, C++, Node.js …) */
export function extractTechTerms(jd: string): string[] {
  const raw = jd.match(/[A-Za-z][A-Za-z0-9]*(?:[.+#/-][A-Za-z0-9+#]+)*\+*#?/g) ?? [];
  const terms = raw
    .map((t) => t.replace(/[.,/-]+$/, ""))
    // "PostgreSQL/MySQL" 은 나누고, "CI/CD" · "UI/UX" 처럼 짧은 약어 묶음은 그대로
    .flatMap((t) => (t.includes("/") && t.split("/").some((p) => p.length > 3) ? t.split("/") : [t]));
  return uniq(terms.filter((t) => t.length >= 2 && !STOP_WORDS.has(t.toLowerCase())));
}

/** 표기 차이 흡수: 소문자, Node.js ↔ NodeJS */
const canonText = (s: string) => s.toLowerCase().replace(/\.js\b/g, "js");

function containsSkill(haystack: string, skill: string): boolean {
  const s = canonText(skill.trim());
  if (!s) return false;
  // 영숫자 경계로만 일치 (Java ⊂ JavaScript 오탐 방지)
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`).test(canonText(haystack));
}

export function matchJobKeywords(jd: string, material: TailorMaterial): KeywordMatch {
  const matched = material.skills.filter((s) => containsSkill(jd, s));
  const mine = new Set(material.skills.map(normalizeSkill));
  const missing = extractTechTerms(jd).filter((t) => !mine.has(normalizeSkill(t)) && !matched.some((m) => containsSkill(t, m)));
  const projects = material.projects
    .map((p) => {
      const hit = p.tech.filter((t) => containsSkill(jd, t));
      return { key: p.key, name: p.project.name, score: hit.length, matched: hit };
    })
    .sort((a, b) => b.score - a.score);
  return { matched, missing, projects };
}

// ---------- LLM 없이: 붙여넣기용 프롬프트 (toolkit Step 3) ----------

export interface JobPosting {
  company: string;
  position: string;
  text: string;
  /** 강조하고 싶은 포인트 (선택) */
  focus?: string;
}

export const TAILOR_RULES = [
  "공고의 필수 요건에 매핑되는 내용을 우선 배치",
  "수치화된 성과를 앞으로 끌어올릴 것",
  "없는 경험·수치·기술을 만들지 말 것, 있는 경험의 강조점을 바꿀 것",
  "각 항목은 문제→행동→성과 구조로 작성",
  "소제목·문장은 '행동 + 성과' 혼합형 (기술 나열 금지)",
  "수치가 없으면 지어내지 말고 상대적 표현을 쓸 것",
  "회사·고객사·내부 시스템 이름은 쓰지 말 것 ([비공개] 같은 표시는 그대로 둘 것)",
];

export function buildTailorPrompt(input: { job: JobPosting; material: TailorMaterial; originResume: string }): string {
  const { job, material } = input;
  const refs = material.projects.map((p) => renderToolkitReferenceFromMaterial(p, material)).join("\n\n---\n\n");
  return [
    "아래 채용공고를 분석하고, 내 원본 이력서를 이 공고에 맞게 보완해줘.",
    "",
    `[지원 회사 / 포지션]`,
    `${job.company || "(회사명)"} — ${job.position || "(포지션)"}`,
    "",
    "[채용공고]",
    job.text.trim(),
    "",
    "[원본 이력서]",
    input.originResume.trim(),
    "",
    "[관련 프로젝트 레퍼런스]",
    refs,
    job.focus?.trim() ? `\n[강조하고 싶은 포인트]\n${job.focus.trim()}` : "",
    "",
    "먼저 공고를 분석해줘:",
    "- 필수 요건 / 우대 요건 / 직무 핵심 (이 팀이 실제로 하는 일)",
    "- 각 요건에 매칭되는 내 경험, 그리고 부족한 항목",
    "",
    "그다음 맞춤 이력서를 작성해줘. 조건:",
    ...TAILOR_RULES.map((r) => `- ${r}`),
    "",
    "마지막에 '변경 포인트 메모'로 원본 대비 무엇을 바꿨는지 정리해줘.",
  ].join("\n");
}

// ---------- LLM 결과 형식 + 검증 ----------

export type RequirementStatus = "충족" | "부분" | "부족";

export interface TailoredBullet {
  text: string;
  sourceKeys: string[];
}

export interface TailoredResult {
  analysis: {
    mustHave: string[];
    niceToHave: string[];
    coreDuties: string;
    focusPoints: string[];
  };
  requirements: { requirement: string; kind: "필수" | "우대"; status: RequirementStatus; sourceKeys: string[]; note: string }[];
  intro: string;
  highlights: TailoredBullet[];
  skills: { primary: string[]; others: string[] };
  projects: { key: string; reason: string; bullets: TailoredBullet[] }[];
  gaps: string[];
  changeNotes: string[];
}

export interface ValidatedBullet extends TailoredBullet {
  /** 근거가 모두 미확정(추천됨·초안)이면 true — 제출 전 확인 필요 */
  unconfirmed: boolean;
  /** 원문에 없는 숫자 때문에 원래 성과 문장으로 되돌렸으면 true */
  reverted: boolean;
}

export interface ValidatedTailored extends Omit<TailoredResult, "highlights" | "projects"> {
  highlights: ValidatedBullet[];
  projects: { key: string; reason: string; bullets: ValidatedBullet[] }[];
  /** 검증 과정에서 고치거나 뺀 것 (사람이 봐야 하는 것) */
  warnings: string[];
}

/** 텍스트의 숫자가 근거에 모두 있는지 */
function unsupportedNumbers(text: string, allowed: Set<number>): number[] {
  const abs = new Set([...allowed].map(Math.abs));
  return extractNumbers(text).filter((n) => !abs.has(Math.abs(n)));
}

/**
 * 환각 방지 검증 (validateDigest 와 같은 원칙):
 * - 모르는 근거 키 / 프로젝트 키 제거, 근거 없는 문장 제거
 * - 문장의 숫자가 근거 원문에 없으면: 성과(A*) 근거가 있으면 그 원래 문장으로 되돌리고, 없으면 제거
 * - 기술스택은 내 기술 목록에 있는 것만 (공고에만 있는 기술을 끼워 넣지 않음)
 */
export function validateTailored(result: TailoredResult, material: TailorMaterial): ValidatedTailored {
  const warnings: string[] = [];
  const byKey = new Map(material.sources.map((s) => [s.key, s]));
  const projectKeys = new Set(material.projects.map((p) => p.key));
  const allNumbers = new Set(material.sources.flatMap((s) => s.numbers));

  const checkBullet = (b: TailoredBullet, where: string): ValidatedBullet | null => {
    const keys = [...new Set(b.sourceKeys)].filter((k) => byKey.has(k));
    if (!keys.length) {
      warnings.push(`${where}: 근거가 없는 문장을 뺐어요 — "${b.text}"`);
      return null;
    }
    const sources = keys.map((k) => byKey.get(k)!);
    const unconfirmed = sources.every((s) => !s.confirmed);
    const allowed = new Set(sources.flatMap((s) => s.numbers));
    const bad = unsupportedNumbers(b.text, allowed);
    if (!bad.length) return { text: b.text.trim(), sourceKeys: keys, unconfirmed, reverted: false };

    const original = sources.find((s) => s.kind === "achievement");
    if (original) {
      warnings.push(`${where}: 근거에 없는 숫자(${bad.join(", ")})가 있어 원래 성과 문장으로 되돌렸어요`);
      return { text: original.text, sourceKeys: keys, unconfirmed: !original.confirmed, reverted: true };
    }
    warnings.push(`${where}: 근거에 없는 숫자(${bad.join(", ")})가 있어 문장을 뺐어요 — "${b.text}"`);
    return null;
  };

  const highlights = result.highlights
    .map((b, i) => checkBullet(b, `핵심 성과 ${i + 1}`))
    .filter((b): b is ValidatedBullet => b !== null)
    .slice(0, 5);

  const seenProjects = new Set<string>();
  const projects = result.projects
    .filter((p) => {
      if (!projectKeys.has(p.key)) {
        warnings.push(`알 수 없는 프로젝트(${p.key})를 뺐어요`);
        return false;
      }
      if (seenProjects.has(p.key)) return false;
      seenProjects.add(p.key);
      return true;
    })
    .map((p) => {
      const name = material.projects.find((m) => m.key === p.key)!.project.name;
      return {
        key: p.key,
        reason: p.reason,
        bullets: p.bullets.map((b, i) => checkBullet(b, `${name} ${i + 1}번`)).filter((b): b is ValidatedBullet => b !== null),
      };
    });

  const mine = new Map(material.skills.map((s) => [normalizeSkill(s), s]));
  const keepSkills = (list: string[]) =>
    uniq(
      list.flatMap((s) => {
        const hit = mine.get(normalizeSkill(s));
        if (!hit) {
          warnings.push(`내 기록에 없는 기술 "${s}"을 기술스택에서 뺐어요`);
          return [];
        }
        return [hit];
      }),
    );
  const primary = keepSkills(result.skills.primary);
  const primarySet = new Set(primary.map(normalizeSkill));
  const others = keepSkills(result.skills.others).filter((s) => !primarySet.has(normalizeSkill(s)));

  const badIntro = unsupportedNumbers(result.intro, allNumbers);
  if (badIntro.length) warnings.push(`소개 문단에 근거에서 찾지 못한 숫자(${badIntro.join(", ")})가 있어요. 제출 전 확인하세요.`);

  const requirements = result.requirements.map((r) => ({ ...r, sourceKeys: r.sourceKeys.filter((k) => byKey.has(k)) }));

  return { ...result, requirements, highlights, projects, skills: { primary, others }, warnings };
}

// ---------- 렌더 (toolkit 의 companies/_template/이력서_맞춤.md 구조) ----------

function formatPeriod(p: Project["period"]): string {
  if (!p) return "";
  const fmt = (d: string) => d.slice(0, 7).replace("-", ".");
  return `${fmt(p.start)} ~ ${p.end ? fmt(p.end) : "진행중"}`;
}

const bulletLine = (b: ValidatedBullet) => `- ${b.text}`;

/**
 * 맞춤 이력서 Markdown.
 * includeMemo=true 면 toolkit 템플릿처럼 맨 아래에 "변경 포인트 메모 (제출 전 삭제)"를 붙인다.
 */
export function renderTailoredResume(input: {
  job: Pick<JobPosting, "company" | "position">;
  result: ValidatedTailored;
  material: TailorMaterial;
  profile?: ResumeProfile;
  generatedAt?: string;
  includeMemo?: boolean;
}): string {
  const { job, result, material, profile = {} } = input;
  const out: string[] = [];
  const target = [job.company, job.position].filter(Boolean).join(" — ");

  out.push(`# ${profile.name ? `${profile.name} ` : ""}이력서${job.company ? ` (${job.company} 맞춤)` : ""}`);
  if (input.includeMemo) {
    out.push("", `> 대상: ${target || "-"} · CareerSync 생성 ${input.generatedAt ?? new Date().toISOString().slice(0, 10)}`);
    if (result.analysis.focusPoints.length) out.push(`> 강조 포인트: ${result.analysis.focusPoints.join(" · ")}`);
  }
  if (profile.headline) out.push("", profile.headline);
  if (profile.links?.length) out.push("", profile.links.map((l) => `[${l.label}](${l.url})`).join(" · "));
  if (result.intro.trim()) out.push("", result.intro.trim());

  if (result.highlights.length) {
    out.push("", "## 핵심 성과 요약", "");
    for (const b of result.highlights) out.push(bulletLine(b));
  }

  if (result.skills.primary.length || result.skills.others.length) {
    out.push("", "## 기술스택", "");
    if (result.skills.primary.length) out.push(`**주요** ${result.skills.primary.join(", ")}`);
    if (result.skills.others.length) out.push(`${result.skills.primary.length ? "\n" : ""}**기타** ${result.skills.others.join(", ")}`);
  }

  const projects = result.projects.filter((p) => p.bullets.length);
  if (projects.length) {
    out.push("", "## 경력 · 프로젝트");
    for (const p of projects) {
      const mp = material.projects.find((m) => m.key === p.key)!;
      out.push("", `### ${mp.project.name}`);
      const meta = [formatPeriod(mp.project.period), mp.project.role].filter(Boolean).join(" · ");
      if (meta) out.push(`*${meta}*`);
      if (mp.project.summary) out.push("", mp.project.summary);
      const links = [mp.project.publicUrl && `[서비스](${mp.project.publicUrl})`, mp.project.repoUrl && `[저장소](${mp.project.repoUrl})`].filter(Boolean);
      if (links.length) out.push("", links.join(" · "));
      out.push("");
      for (const b of p.bullets) out.push(bulletLine(b));
    }
  }

  if (input.includeMemo) out.push("", "---", "", renderChangeMemo(result, material));
  return out.join("\n").trim() + "\n";
}

/** 제출 전 확인용 메모: 요건 매핑 · 부족 항목 · 변경 포인트 · 검증 경고 */
export function renderChangeMemo(result: ValidatedTailored, material: TailorMaterial): string {
  const label = (keys: string[]) => keys.join(", ") || "근거 없음";
  const unconfirmed = [...result.highlights, ...result.projects.flatMap((p) => p.bullets)].filter((b) => b.unconfirmed);
  const lines = ["> **변경 포인트 메모 (제출 전 삭제)**", ">"];
  if (result.analysis.coreDuties) lines.push(`> 직무 핵심: ${result.analysis.coreDuties}`, ">");
  lines.push("> 요건 매핑");
  for (const r of result.requirements) lines.push(`> - [${r.kind}·${r.status}] ${r.requirement} ← ${label(r.sourceKeys)}${r.note ? ` (${r.note})` : ""}`);
  if (result.gaps.length) {
    lines.push(">", "> 부족한 항목");
    for (const g of result.gaps) lines.push(`> - ${g}`);
  }
  if (result.changeNotes.length) {
    lines.push(">", "> 원본 대비 변경");
    result.changeNotes.forEach((n, i) => lines.push(`> ${i + 1}. ${n}`));
  }
  if (unconfirmed.length) {
    lines.push(">", "> 아직 확정 전 근거로 쓴 문장 (Inbox 에서 확정 후 제출 권장)");
    for (const b of unconfirmed) lines.push(`> - ${b.text}`);
  }
  if (result.warnings.length) {
    lines.push(">", "> 자동 검증 메모");
    for (const w of result.warnings) lines.push(`> - ${w}`);
  }
  lines.push(">", `> 근거 키: ${material.sources.map((s) => `${s.key}=${s.kind === "achievement" ? "성과" : s.kind === "record" ? "기록" : "지표"}`).join(" ")}`);
  return lines.join("\n");
}

// ---------- resume-ai-toolkit 레퍼런스 내보내기 ----------

function renderToolkitReferenceFromMaterial(mp: MaterialProject, material: TailorMaterial): string {
  const sources = material.sources.filter((s) => s.projectKeys.includes(mp.key));
  return renderToolkitReferenceCore({
    project: mp.project,
    tech: mp.tech,
    records: sources.filter((s) => s.kind === "record").map((s) => ({ text: s.text })),
    metrics: sources.filter((s) => s.kind === "metric").map((s) => s.text),
    sentences: sources.filter((s) => s.kind === "achievement").map((s) => s.text),
    questions: [],
  });
}

function renderToolkitReferenceCore(input: {
  project: Project;
  tech: string[];
  records: { title?: string; summary?: string; highlights?: string; text?: string }[];
  metrics: string[];
  sentences: string[];
  questions: string[];
}): string {
  const { project: p } = input;
  const out: string[] = [];
  out.push(`# ${p.name}${p.summary ? ` — ${p.summary}` : ""}`, "");
  const links = [p.publicUrl, p.repoUrl].filter(Boolean).join(" · ");
  out.push(`> 경로/링크: ${links || "-"}`);
  out.push(`> 태그: ${input.tech.map((t) => `\`${t}\``).join(" ") || "-"}`);
  const meta = [formatPeriod(p.period), p.role, p.teamSize ? `팀 ${p.teamSize}명` : ""].filter(Boolean).join(" · ");
  if (meta) out.push(`> 기간/역할: ${meta}`);
  out.push("", "## 기술스택", "", `- 사용 기술: ${input.tech.join(", ") || "-"}`);

  out.push("", "## 핵심 기여");
  if (!input.records.length) out.push("", "- (연결된 기록이 없어요)");
  for (const r of input.records) {
    if (r.text) {
      const [title, ...rest] = r.text.split("\n");
      out.push("", `### ${title}`, "", ...rest.map((l) => `- ${l.replace(/^[•\-]\s*/, "")}`));
    } else {
      out.push("", `### ${r.title}`, "");
      if (r.summary) out.push(`- **문제·행동**: ${r.summary}`);
      const hs = (r.highlights ?? "").split("\n").map((l) => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean);
      if (hs.length) out.push(`- **성과**: ${hs.join(" / ")}`);
    }
  }
  if (input.metrics.length) {
    out.push("", "### 성과 지표", "");
    for (const m of input.metrics) out.push(`- ${m}`);
  }

  out.push("", "## 이력서 활용 문장 예시", "");
  if (input.sentences.length) for (const s of input.sentences) out.push(`- "${s}"`);
  else out.push("- (확인된 성과 문장이 아직 없어요)");

  if (input.questions.length) {
    out.push("", "## 면접 예상 질문", "");
    for (const q of input.questions) out.push(`- ${q}`);
  }
  out.push("", "## 맞는 포지션", "", `- ${p.role || "-"}`);
  return out.join("\n").trim() + "\n";
}

/**
 * 프로젝트 하나를 resume-ai-toolkit 의 reference/_template_project.md 형식으로.
 * toolkit 레포의 reference/ 폴더에 그대로 붙여넣어 쓸 수 있다.
 */
export function renderToolkitReference(input: {
  project: Project;
  records: RecordEntry[];
  metrics: Metric[];
  achievements: Achievement[];
}): string {
  const { project } = input;
  const records = input.records.filter((r) => r.projectIds.includes(project.id));
  const recordIds = new Set(records.map((r) => r.id));
  const metrics = input.metrics.filter((m) => m.recordIds.some((id) => recordIds.has(id)));
  const sentences = input.achievements
    .filter((a) => a.projectIds.includes(project.id) && a.assignment !== null && CONFIRMED_ASSIGNMENT.has(a.assignment))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((a) => a.text);
  const questions = [
    ...metrics.map((m) => `"${m.name}" 수치는 어떻게 측정했나요? → 메모: ${m.method || "측정 방법 미기재 — 답변 준비 필요"}`),
    ...project.stack.slice(0, 2).map((t) => `왜 ${t}을(를) 선택했나요? 다른 선택지는 없었나요?`),
  ];
  return renderToolkitReferenceCore({
    project,
    tech: uniq([...project.stack, ...records.flatMap((r) => r.tech)]),
    records: records.map((r) => ({ title: r.title, summary: r.summary, highlights: r.highlights })),
    metrics: metrics.map(
      (m) => `${m.name}: ${m.before ?? "?"} → ${m.after ?? "?"} ${m.unit ?? ""} (${formatImprovement(m.improvement)})${m.method ? ` · ${m.method}` : ""}`,
    ),
    sentences,
    questions,
  });
}

/** 원본 이력서 (toolkit 의 origin/이력서.md 자리) — 확인된 성과만 */
export function renderOriginResume(input: { profile?: ResumeProfile; projects: Project[]; achievements: Achievement[] }): string {
  return renderResume({ ...input, achievements: input.achievements.filter((a) => a.assignment !== null && CONFIRMED_ASSIGNMENT.has(a.assignment)) });
}

/** 파일·Blob 경로용 회사명 슬러그 */
export function slugifyCompany(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|#%\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "company";
}
