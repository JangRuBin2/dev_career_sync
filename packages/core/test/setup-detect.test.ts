import { describe, expect, it } from "vitest";
import { DB_KEYS, DB_TITLES } from "../src/notion/schema";
import { RESUME_PAGE_TITLE, findExistingWorkspace, listCandidatePages } from "../src/notion/setup";
import type { Client } from "../src/notion/sdk";

const fake = (children: object[], pages: object[] = []) =>
  ({
    blocks: { children: { list: async () => ({ results: children, has_more: false, next_cursor: null }) } },
    databases: { retrieve: async ({ database_id }: { database_id: string }) => ({ data_sources: [{ id: `ds-of-${database_id}` }] }) },
    search: async () => ({ results: pages }),
  }) as unknown as Client;

const allDbs = DB_KEYS.map((k) => ({ id: `db-${k}`, type: "child_database", child_database: { title: DB_TITLES[k] } }));
const resume = { id: "resume-1", type: "child_page", child_page: { title: RESUME_PAGE_TITLE } };

describe("findExistingWorkspace", () => {
  it("DB 7개 + 이력서 페이지가 모두 있으면 재사용", async () => {
    const r = await findExistingWorkspace(fake([...allDbs, resume, { id: "x", type: "paragraph" }]), "parent");
    expect(r?.resumePageId).toBe("resume-1");
    expect(r?.dataSources.projects).toBe("ds-of-db-projects");
  });
  it("하나라도 없으면 null (새로 만든다)", async () => {
    expect(await findExistingWorkspace(fake([...allDbs.slice(1), resume]), "parent")).toBeNull();
    expect(await findExistingWorkspace(fake(allDbs), "parent")).toBeNull();
  });
});

describe("listCandidatePages", () => {
  it("DB 행은 빼고 일반 페이지만, 제목 추출", async () => {
    const pages = [
      { id: "p1", url: "u1", last_edited_time: "t", parent: { type: "workspace" }, properties: { title: { type: "title", title: [{ plain_text: "커리어" }] } } },
      { id: "row", url: "u2", last_edited_time: "t", parent: { type: "data_source_id" }, properties: {} },
      { id: "p2", url: "u3", last_edited_time: "t", parent: { type: "page_id" }, properties: {} },
    ];
    const r = await listCandidatePages(fake([], pages));
    expect(r.map((p) => [p.id, p.title])).toEqual([
      ["p1", "커리어"],
      ["p2", "(제목 없음)"],
    ]);
  });
});
