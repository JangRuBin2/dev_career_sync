import { describe, expect, it } from "vitest";
import { DB_KEYS, DB_SPECS, type DataSourceIds, type DbKey } from "../src/notion";
import { diffSchema, type ActualSchema } from "../src/notion/verify";

const ds = Object.fromEntries(DB_KEYS.map((k) => [k, `ds-${k}`])) as DataSourceIds;

/** DB_SPECS 를 그대로 만족하는 "정상" 스키마 */
function perfect(): ActualSchema {
  const out = Object.fromEntries(DB_KEYS.map((k) => [k, {}])) as ActualSchema;
  for (const key of DB_KEYS) {
    for (const [name, spec] of Object.entries(DB_SPECS[key])) {
      out[key][name] = spec.type === "relation" ? { type: "relation", relation: { data_source_id: ds[spec.target] } } : { type: spec.type };
      if (spec.type === "relation" && spec.syncedName) {
        out[spec.target][spec.syncedName] = { type: "relation", relation: { data_source_id: ds[key as DbKey] } };
      }
    }
  }
  return out;
}

describe("diffSchema", () => {
  it("정상 스키마면 문제 없음", () => expect(diffSchema(perfect(), ds)).toEqual([]));

  it("빠진 속성 · 타입 불일치 · 잘못된 relation · 역방향 이름 불일치를 잡는다", () => {
    const s = perfect();
    delete s.metrics["개선율"];
    s.projects["기술스택"] = { type: "rich_text" };
    s.records["프로젝트"] = { type: "relation", relation: { data_source_id: "ds-posts" } };
    delete s.projects["기록"]; // Records.프로젝트 의 역방향
    s.projects["Related to Records (프로젝트)"] = { type: "relation", relation: { data_source_id: "ds-records" } };
    const problems = diffSchema(s, ds).map((i) => `${i.db}.${i.property}: ${i.problem}`);
    expect(problems).toContain("metrics.개선율: 속성이 없음");
    expect(problems).toContain("projects.기술스택: 타입 불일치 (기대 multi_select, 실제 rich_text)");
    expect(problems.some((p) => p.startsWith("records.프로젝트:") && p.includes("다른 DB"))).toBe(true);
    expect(problems.some((p) => p.startsWith("projects.기록:") && p.includes("역방향"))).toBe(true);
  });

  it("ID 하이픈 유무는 무시", () => {
    const s = perfect();
    s.metrics["기록"] = { type: "relation", relation: { data_source_id: "ds-records".replace("-", "") } };
    expect(diffSchema(s, ds).filter((i) => i.db === "metrics")).toEqual([]);
  });
});
