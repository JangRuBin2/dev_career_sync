import { DB_KEYS, DB_SPECS, DB_TITLES, type DbKey } from "./schema";
import type { DataSourceIds } from "./client";

/** dataSources.retrieve 응답의 속성 (필요한 필드만) */
export type ActualProp = {
  type: string;
  relation?: { data_source_id?: string };
};
export type ActualSchema = Record<DbKey, Record<string, ActualProp>>;

export interface VerifyIssue {
  db: DbKey;
  property: string;
  problem: string;
}

const norm = (id: string | undefined) => (id ?? "").replace(/-/g, "").toLowerCase();

/** DB_SPECS(기대 스키마)와 실제 Notion 스키마를 비교한다. 순수 함수 — 테스트 가능 */
export function diffSchema(actual: ActualSchema, ds: DataSourceIds): VerifyIssue[] {
  const issues: VerifyIssue[] = [];
  for (const key of DB_KEYS) {
    const props = actual[key] ?? {};
    for (const [name, spec] of Object.entries(DB_SPECS[key])) {
      const prop = props[name];
      if (!prop) {
        issues.push({ db: key, property: name, problem: "속성이 없음" });
        continue;
      }
      if (prop.type !== spec.type) {
        issues.push({ db: key, property: name, problem: `타입 불일치 (기대 ${spec.type}, 실제 ${prop.type})` });
        continue;
      }
      if (spec.type === "relation") {
        if (norm(prop.relation?.data_source_id) !== norm(ds[spec.target])) {
          issues.push({ db: key, property: name, problem: `${DB_TITLES[spec.target]} 가 아닌 다른 DB 를 가리킴` });
        }
        if (spec.syncedName) {
          const reverse = actual[spec.target]?.[spec.syncedName];
          if (!reverse || reverse.type !== "relation" || norm(reverse.relation?.data_source_id) !== norm(ds[key])) {
            issues.push({ db: spec.target, property: spec.syncedName, problem: `${DB_TITLES[key]}.${name} 의 역방향 속성이 없거나 이름이 다름` });
          }
        }
      }
    }
  }
  return issues;
}
