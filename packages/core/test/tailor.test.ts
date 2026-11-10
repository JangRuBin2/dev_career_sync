import { describe, expect, it } from "vitest";
import type { Metric, RecordEntry } from "../src/notion/types";
import {
  buildTailorMaterial,
  buildTailorPrompt,
  extractTechTerms,
  matchJobKeywords,
  renderTailoredResume,
  renderToolkitReference,
  validateTailored,
  type TailoredResult,
} from "../src/tailor";
import { parseDenylist } from "../src/sanitize";
import { achievement, project } from "./fixtures";

const record = (over: Partial<RecordEntry> = {}): RecordEntry => ({
  id: "r1",
  url: "",
  title: "결제 API 응답속도 개선",
  period: { start: "2026-11-02", end: "2026-11-06" },
  cadence: "주간",
  summary: "ACME 승인 내역 조회의 슬로우 쿼리를 분석해 복합 인덱스를 추가했다.",
  highlights: "• p95 응답시간 40% 단축",
  role: "원인 분석과 개선 주도",
  contribution: null,
  tech: ["PostgreSQL", "Redis"],
  projectIds: ["p1"],
  logIds: [],
  metricIds: ["m1"],
  attachmentIds: [],
  status: "확정",
  confirmedAt: null,
  origin: "자동",
  ...over,
});

const metric = (over: Partial<Metric> = {}): Metric => ({
  id: "m1",
  name: "결제 승인 API p95",
  category: "성능",
  before: 820,
  after: 490,
  unit: "ms",
  direction: "낮을수록 좋음",
  improvement: 40.2,
  method: "슬로우쿼리 로그 기준",
  period: null,
  confidence: "직접 측정",
  evidence: "",
  recordIds: ["r1"],
  status: "초안",
  ...over,
});

const material = () =>
  buildTailorMaterial({
    projects: [project(), project({ id: "p2", name: "디자인 시스템", stack: ["React", "TypeScript"], resumeOrder: 2 })],
    records: [record()],
    metrics: [metric()],
    achievements: [
      achievement(),
      achievement({ id: "a2", text: "공통 컴포넌트 40종 정리", projectIds: ["p2"], recordIds: [] }),
      achievement({ id: "a3", text: "반려된 문장", assignment: "반려" }),
      achievement({ id: "a4", text: "추천 단계 문장 93% 감소", assignment: "추천됨", projectIds: [], suggestedProjectId: "p1" }),
    ],
    denylist: parseDenylist("ACME=A사"),
  });

const result = (over: Partial<TailoredResult> = {}): TailoredResult => ({
  analysis: { mustHave: ["PostgreSQL 운영 경험"], niceToHave: ["Kafka"], coreDuties: "결제 백엔드 운영", focusPoints: ["DB 성능"] },
  requirements: [
    { requirement: "PostgreSQL 운영 경험", kind: "필수", status: "충족", sourceKeys: ["A1", "ZZ"], note: "" },
    { requirement: "Kafka", kind: "우대", status: "부족", sourceKeys: [], note: "경험 없음" },
  ],
  intro: "결제 API 응답시간을 40% 줄인 백엔드 개발자입니다.",
  highlights: [
    { text: "복합 인덱스로 결제 API p95 820ms → 490ms (40% 단축)", sourceKeys: ["M1", "A1"] },
    { text: "근거 없는 문장", sourceKeys: ["ZZ"] },
    { text: "쿼리 튜닝으로 p95 70% 단축", sourceKeys: ["A1"] },
    { text: "재시도 정책으로 실패 99% 감소", sourceKeys: ["R1"] },
  ],
  skills: { primary: ["postgresql", "Kafka"], others: ["Node.js", "PostgreSQL", "react"] },
  projects: [
    { key: "P1", reason: "필수 요건과 직결", bullets: [{ text: "슬로우 쿼리 분석 후 복합 인덱스 추가로 p95 40% 단축", sourceKeys: ["R1", "M1"] }] },
    { key: "P9", reason: "없는 프로젝트", bullets: [{ text: "x", sourceKeys: ["A1"] }] },
    { key: "P1", reason: "중복", bullets: [] },
  ],
  gaps: ["Kafka 실무 경험 없음 — 사이드 프로젝트로 보완 가능"],
  changeNotes: ["결제 프로젝트를 맨 위로"],
  ...over,
});

describe("buildTailorMaterial", () => {
  it("짧은 키 부여, 반려 제외, 확정 여부 표시, 금지어 마스킹", () => {
    const m = material();
    expect(m.projects.map((p) => p.key)).toEqual(["P1", "P2"]);
    expect(m.sources.filter((s) => s.kind === "achievement").map((s) => s.text)).not.toContain("반려된 문장");
    const rec = m.sources.find((s) => s.kind === "record")!;
    expect(rec.text).toContain("A사");
    expect(rec.text).not.toContain("ACME");
    expect(rec.confirmed).toBe(true);
    const suggested = m.sources.find((s) => s.text.startsWith("추천 단계"))!;
    expect(suggested.confirmed).toBe(false);
    expect(suggested.projectKeys).toEqual(["P1"]); // 추천 프로젝트로 연결
    expect(m.sources.find((s) => s.kind === "metric")!.projectKeys).toEqual(["P1"]); // 기록 경유
    expect(m.skills).toEqual(["Node.js", "PostgreSQL", "Redis", "React", "TypeScript"]);
  });
});

describe("validateTailored", () => {
  const out = validateTailored(result(), material());

  it("근거 없는 문장 제거, 원문에 없는 숫자는 원래 성과 문장으로 되돌리거나 제거", () => {
    const texts = out.highlights.map((h) => h.text);
    expect(texts[0]).toBe("복합 인덱스로 결제 API p95 820ms → 490ms (40% 단축)");
    expect(texts).not.toContain("근거 없는 문장");
    // A1 근거의 70% → 원래 문장으로
    expect(texts[1]).toBe("쿼리 튜닝으로 결제 API p95 응답시간 40% 단축");
    expect(out.highlights[1]!.reverted).toBe(true);
    // R1 만 근거인 99% → 되돌릴 문장이 없어 제거
    expect(texts.some((t) => t.includes("99%"))).toBe(false);
    expect(out.warnings.some((w) => w.includes("99"))).toBe(true);
  });

  it("모르는 프로젝트·중복 제거, 모르는 근거 키 제거", () => {
    expect(out.projects.map((p) => p.key)).toEqual(["P1"]);
    expect(out.requirements[0]!.sourceKeys).toEqual(["A1"]);
  });

  it("기술스택은 내 기술 이름 그대로, 없는 기술은 빼고, 주요/기타 중복 제거", () => {
    expect(out.skills.primary).toEqual(["PostgreSQL"]);
    expect(out.skills.others).toEqual(["Node.js", "React"]);
    expect(out.warnings.some((w) => w.includes("Kafka"))).toBe(true);
  });

  it("미확정 근거만 쓴 문장은 unconfirmed", () => {
    const m = material();
    const key = m.sources.find((s) => s.text.startsWith("추천 단계"))!.key;
    const r = validateTailored(result({ highlights: [{ text: "추천 단계 문장 93% 감소", sourceKeys: [key] }] }), m);
    expect(r.highlights[0]!.unconfirmed).toBe(true);
  });

  it("소개 문단의 근거 없는 숫자는 경고", () => {
    const r = validateTailored(result({ intro: "트래픽 10배를 처리했습니다." }), material());
    expect(r.warnings.some((w) => w.includes("소개 문단"))).toBe(true);
  });
});

describe("renderTailoredResume", () => {
  const m = material();
  const v = validateTailored(result(), m);

  it("제출용: toolkit 이력서_맞춤 구조, 메모 없음", () => {
    const md = renderTailoredResume({ job: { company: "토스", position: "Server Developer" }, result: v, material: m, profile: { name: "홍길동" } });
    expect(md).toContain("# 홍길동 이력서 (토스 맞춤)");
    expect(md).toContain("## 핵심 성과 요약");
    expect(md).toContain("**주요** PostgreSQL");
    expect(md).toContain("### 결제 시스템 고도화");
    expect(md).not.toContain("변경 포인트 메모");
    expect(md).not.toContain("디자인 시스템"); // 맞춤본에서 고르지 않은 프로젝트
  });

  it("메모 포함: 요건 매핑 · 부족 항목 · 변경 · 검증 경고", () => {
    const md = renderTailoredResume({ job: { company: "토스", position: "Server" }, result: v, material: m, includeMemo: true });
    expect(md).toContain("변경 포인트 메모 (제출 전 삭제)");
    expect(md).toContain("[필수·충족] PostgreSQL 운영 경험 ← A1");
    expect(md).toContain("Kafka 실무 경험 없음");
    expect(md).toContain("자동 검증 메모");
  });
});

describe("키워드 매칭 (LLM 없이)", () => {
  const jd = "[자격요건] Node.js 또는 Java 기반 서버 개발 3년 이상, PostgreSQL/MySQL 경험, Kafka 우대, CI/CD";

  it("공고의 영문 기술 키워드 추출", () => {
    expect(extractTechTerms(jd)).toEqual(expect.arrayContaining(["Node.js", "Java", "PostgreSQL", "MySQL", "Kafka", "CI/CD"]));
  });

  it("겹치는 기술 / 공고에만 있는 기술 / 프로젝트 점수", () => {
    const r = matchJobKeywords(jd, material());
    expect(r.matched).toEqual(["Node.js", "PostgreSQL"]);
    expect(r.missing).toEqual(expect.arrayContaining(["Java", "MySQL", "Kafka"]));
    expect(r.missing).not.toContain("Node.js");
    expect(r.projects[0]).toMatchObject({ key: "P1", score: 2 });
  });

  it("Java 는 JavaScript 안에서 오탐하지 않는다", () => {
    const m = buildTailorMaterial({ projects: [project({ stack: ["Java"] })], records: [], metrics: [], achievements: [] });
    expect(matchJobKeywords("JavaScript 개발자", m).matched).toEqual([]);
  });

  it("표기 차이(NodeJS ↔ Node.js) 흡수, 일반 단어(API)는 부족 키워드에서 제외", () => {
    const r = matchJobKeywords("NodeJS 로 REST API 개발", material());
    expect(r.matched).toContain("Node.js");
    expect(r.missing).not.toContain("API");
    expect(r.missing).not.toContain("NodeJS");
  });
});

describe("toolkit 연계", () => {
  it("붙여넣기용 프롬프트: 공고 · 원본 · 레퍼런스 · 조건", () => {
    const prompt = buildTailorPrompt({ job: { company: "토스", position: "Server", text: "Node.js 개발" }, material: material(), originResume: "# 원본" });
    expect(prompt).toContain("[채용공고]\nNode.js 개발");
    expect(prompt).toContain("[원본 이력서]\n# 원본");
    expect(prompt).toContain("# 결제 시스템 고도화");
    expect(prompt).toContain("없는 경험·수치·기술을 만들지 말 것");
  });

  it("reference/*.md 형식: 태그 · 핵심 기여 · 활용 문장 · 면접 질문(측정 방법)", () => {
    const md = renderToolkitReference({
      project: project(),
      records: [record()],
      metrics: [metric()],
      achievements: [achievement(), achievement({ id: "a9", text: "추천만 된 문장", assignment: "추천됨" })],
    });
    expect(md).toContain("> 태그: `Node.js` `PostgreSQL` `Redis`");
    expect(md).toContain("### 결제 API 응답속도 개선");
    expect(md).toContain("- **성과**: p95 응답시간 40% 단축");
    expect(md).toContain('- "쿼리 튜닝으로 결제 API p95 응답시간 40% 단축"');
    expect(md).not.toContain("추천만 된 문장");
    expect(md).toContain('"결제 승인 API p95" 수치는 어떻게 측정했나요? → 메모: 슬로우쿼리 로그 기준');
  });
});
