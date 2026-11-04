import { describe, expect, it } from "vitest";
import { validateDigest, type Digest } from "../src/llm/digest";
import { log, project } from "./fixtures";

const base: Digest["records"][number] = {
  title: "결제 API 튜닝",
  summary: "인덱스 추가",
  highlights: ["a", "b", "c", "d"],
  role: "주도",
  tech: ["PostgreSQL"],
  logIds: ["l1", "ghost"],
  projectMatch: { projectId: "p1", newProjectName: null, confidence: 1.4, reason: "" },
  metrics: [
    { name: "p95", category: "성능", before: 820, after: 490, unit: "ms", direction: "낮을수록 좋음", method: "", confidence: "직접 측정", sourceQuote: "" },
    { name: "환각", category: "성능", before: 1000, after: 10, unit: "ms", direction: "낮을수록 좋음", method: "", confidence: "추정", sourceQuote: "" },
  ],
  achievements: ["x"],
};

describe("validateDigest", () => {
  it("없는 logId 제거, 원문에 없는 숫자 지표 제거, 신뢰도 클램프, 핵심성과 3개 제한", () => {
    const out = validateDigest({ records: [base], blogIdeas: [], securityNotes: [] }, [log()], [project()]);
    const rec = out.records[0]!;
    expect(rec.logIds).toEqual(["l1"]);
    expect(rec.metrics.map((m) => m.name)).toEqual(["p95"]);
    expect(rec.projectMatch.confidence).toBe(1);
    expect(rec.highlights).toHaveLength(3);
  });
  it("없는 프로젝트 ID 는 새 프로젝트 제안으로 바뀐다", () => {
    const rec = { ...base, projectMatch: { projectId: "nope", newProjectName: null, confidence: 0.5, reason: "" } };
    const out = validateDigest({ records: [rec], blogIdeas: [], securityNotes: [] }, [log()], [project()]);
    expect(out.records[0]?.projectMatch).toMatchObject({ projectId: null, newProjectName: "결제 API 튜닝" });
  });
  it("근거 로그가 하나도 없는 record 는 버린다", () => {
    const rec = { ...base, logIds: ["ghost"] };
    expect(validateDigest({ records: [rec], blogIdeas: [], securityNotes: [] }, [log()], [project()]).records).toHaveLength(0);
  });
});
