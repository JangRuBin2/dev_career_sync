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
    properties: { title: { title: [{ type: "text", text: { content: RESUME_PAGE_TITLE } }] } },
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

// ---------- 기존 워크스페이스 재사용 ----------

type ChildBlock = { id: string; type: string; child_database?: { title: string }; child_page?: { title: string } };

/**
 * 상위 페이지 아래에 이미 CareerSync DB 7개가 있으면(1인용 시절 setup:notion 결과 등) 그 ID 를 찾는다.
 * 하나라도 없으면 null → 새로 만든다.
 */
export async function findExistingWorkspace(
  notion: Client,
  parentPageId: string,
): Promise<{ dataSources: DataSourceIds; resumePageId: string } | null> {
  const children: ChildBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = (await notion.blocks.children.list({ block_id: parentPageId, start_cursor: cursor, page_size: 100 })) as unknown as {
      results: ChildBlock[];
      has_more: boolean;
      next_cursor: string | null;
    };
    children.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const ds = {} as DataSourceIds;
  for (const key of DB_KEYS) {
    const block = children.find((b) => b.type === "child_database" && b.child_database?.title === DB_TITLES[key]);
    if (!block) return null;
    const db = (await notion.databases.retrieve({ database_id: block.id })) as unknown as { data_sources?: { id: string }[] };
    const first = db.data_sources?.[0];
    if (!first) return null;
    ds[key] = first.id;
  }
  const resume = children.find((b) => b.type === "child_page" && b.child_page?.title === RESUME_PAGE_TITLE);
  if (!resume) return null;
  return { dataSources: ds, resumePageId: resume.id };
}

export const RESUME_PAGE_TITLE = "📄 이력서 (자동 생성)";

/** 연결된 워크스페이스에서 CareerSync 를 둘 수 있는 페이지 목록 (DB 행은 제외) */
export async function listCandidatePages(notion: Client, limit = 50): Promise<{ id: string; title: string; url: string; editedAt: string }[]> {
  const res = (await notion.search({
    filter: { property: "object", value: "page" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
    page_size: limit,
  } as Parameters<Client["search"]>[0])) as unknown as {
    results: {
      id: string;
      url: string;
      last_edited_time: string;
      parent: { type: string };
      properties?: Record<string, { type: string; title?: { plain_text: string }[] }>;
    }[];
  };
  return res.results
    .filter((p) => p.parent.type === "page_id" || p.parent.type === "workspace" || p.parent.type === "block_id")
    .map((p) => {
      const titleProp = Object.values(p.properties ?? {}).find((v) => v.type === "title");
      return { id: p.id, url: p.url, editedAt: p.last_edited_time, title: titleProp?.title?.map((t) => t.plain_text).join("") || "(제목 없음)" };
    });
}
