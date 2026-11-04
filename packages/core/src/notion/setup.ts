import type { Client } from "./sdk";
import { DB_ENV, DB_KEYS, DB_SPECS, DB_TITLES, type DbKey, type DbSpec } from "./schema";
import type { DataSourceIds } from "./client";

type Log = (msg: string) => void;
type DsUpdateArgs = Parameters<Client["dataSources"]["update"]>[0];
type DbCreateArgs = Parameters<Client["databases"]["create"]>[0];

function basicConfig(spec: DbSpec[string]): Record<string, unknown> | null {
  switch (spec.type) {
    case "title":
      return { title: {} };
    case "rich_text":
      return { rich_text: {} };
    case "number":
      return { number: { format: spec.format ?? "number" } };
    case "checkbox":
      return { checkbox: {} };
    case "date":
      return { date: {} };
    case "url":
      return { url: {} };
    case "select":
      return { select: { options: spec.options.map((name) => ({ name })) } };
    case "multi_select":
      return { multi_select: { options: (spec.options ?? []).map((name) => ({ name })) } };
    default:
      return null; // relation / formula 는 나중 단계에서 추가
  }
}

/**
 * 상위 페이지 아래에 CareerSync DB 7개와 이력서 페이지를 만든다.
 * 1) 기본 속성으로 DB 생성 → 2) relation 추가(+역방향 이름 지정) → 3) formula 추가 → 4) 이력서 페이지
 */
export async function setupNotionWorkspace(
  notion: Client,
  parentPageId: string,
  log: Log = console.log,
): Promise<{ dataSources: DataSourceIds; resumePageId: string; env: string }> {
  const ds = {} as DataSourceIds;

  // 1단계: DB 생성
  for (const key of DB_KEYS) {
    const properties: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(DB_SPECS[key])) {
      const cfg = basicConfig(spec);
      if (cfg) properties[name] = cfg;
    }
    const db = await notion.databases.create({
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: DB_TITLES[key] } }],
      initial_data_source: { properties },
    } as DbCreateArgs);
    const dataSources = (db as unknown as { data_sources?: { id: string }[] }).data_sources ?? [];
    const first = dataSources[0];
    if (!first) throw new Error(`${DB_TITLES[key]} 의 data source ID 를 받지 못했습니다.`);
    ds[key] = first.id;
    log(`✔ ${DB_TITLES[key]} 생성 (${first.id})`);
  }

  // 2단계: relation
  for (const key of DB_KEYS) {
    for (const [name, spec] of Object.entries(DB_SPECS[key])) {
      if (spec.type !== "relation") continue;
      const relation = spec.syncedName
        ? { data_source_id: ds[spec.target], type: "dual_property", dual_property: {} }
        : { data_source_id: ds[spec.target], type: "single_property", single_property: {} };
      await notion.dataSources.update({
        data_source_id: ds[key],
        properties: { [name]: { relation } },
      } as DsUpdateArgs);

      if (spec.syncedName) await renameSyncedProperty(notion, ds[key], name, ds[spec.target], spec.syncedName);
      log(`  ↳ relation ${DB_TITLES[key]}.${name} → ${DB_TITLES[spec.target]}${spec.syncedName ? ` (역방향: ${spec.syncedName})` : ""}`);
    }
  }

  // 3단계: formula
  for (const key of DB_KEYS) {
    for (const [name, spec] of Object.entries(DB_SPECS[key])) {
      if (spec.type !== "formula") continue;
      await notion.dataSources.update({
        data_source_id: ds[key],
        properties: { [name]: { formula: { expression: spec.expression } } },
      } as DsUpdateArgs);
      log(`  ↳ formula ${DB_TITLES[key]}.${name}`);
    }
  }

  // 4단계: 이력서 페이지
  const resume = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: { title: { title: [{ type: "text", text: { content: "📄 이력서 (자동 생성)" } }] } },
    markdown: "> 이 페이지는 CareerSync 가 자동으로 다시 그립니다. 직접 수정한 내용은 덮어써질 수 있어요.",
  } as Parameters<Client["pages"]["create"]>[0]);
  log(`✔ 이력서 페이지 생성 (${resume.id})`);

  const env = [
    ...DB_KEYS.map((k: DbKey) => `${DB_ENV[k]}=${ds[k]}`),
    `NOTION_RESUME_PAGE_ID=${resume.id}`,
  ].join("\n");

  return { dataSources: ds, resumePageId: resume.id, env };
}

/** dual relation 이 대상 DB에 만든 역방향 속성의 이름을 바꾼다 */
async function renameSyncedProperty(notion: Client, sourceDs: string, propName: string, targetDs: string, newName: string) {
  const source = await notion.dataSources.retrieve({ data_source_id: sourceDs });
  const prop = (source as unknown as { properties: Record<string, { relation?: { dual_property?: { synced_property_id?: string } } }> })
    .properties[propName];
  const syncedId = prop?.relation?.dual_property?.synced_property_id;
  if (!syncedId) return;
  await notion.dataSources.update({
    data_source_id: targetDs,
    properties: { [syncedId]: { name: newName } },
  } as DsUpdateArgs);
}
