import { describe, expect, it } from "vitest";
import { lineDiff, previewAssignment, renderResume } from "../src/resume";
import { achievement, project } from "./fixtures";

describe("renderResume", () => {
  it("확정된 성과만, 이력서 노출 프로젝트만 렌더한다", () => {
    const md = renderResume({
      profile: { name: "홍길동" },
      projects: [project(), project({ id: "p2", name: "숨김 프로젝트", onResume: false })],
      achievements: [achievement(), achievement({ id: "a2", text: "추천만 된 성과", assignment: "추천됨" })],
      generatedAt: "2026-11-04",
    });
    expect(md).toContain("### 결제 시스템 고도화");
    expect(md).toContain("- 쿼리 튜닝으로 결제 API p95 응답시간 40% 단축");
    expect(md).toContain("2026.03 ~ 진행중");
    expect(md).not.toContain("숨김 프로젝트");
    expect(md).not.toContain("추천만 된 성과");
  });
});

describe("previewAssignment", () => {
  it("후보 성과를 넣었을 때 섹션 Before/After 를 만든다", () => {
    const candidate = achievement({ id: "a9", text: "캐시 도입으로 DB 부하 30% 감소", projectIds: [], assignment: "추천됨" });
    const { before, after } = previewAssignment({ project: project(), achievements: [achievement()], candidate });
    expect(before).not.toContain("캐시 도입");
    expect(after).toContain("- 캐시 도입으로 DB 부하 30% 감소");
    const diff = lineDiff(before, after);
    expect(diff.filter((d) => d.type === "add").map((d) => d.line)).toEqual(["- 캐시 도입으로 DB 부하 30% 감소"]);
  });
});
