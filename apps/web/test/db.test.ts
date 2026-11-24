/**
 * 실제 Postgres 로 DB 계층 검증. TEST_DATABASE_URL 이 있을 때만 실행 (CI 에서는 건너뜀).
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5433/careersync pnpm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("db store", () => {
  let store: typeof import("../lib/db/store");
  let userId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.ENCRYPTION_KEY = "k".repeat(40);
    store = await import("../lib/db/store");
    const u = await store.upsertGithubUser({ githubId: `t-${Date.now()}`, login: "tester" });
    userId = u.id;
  });

  afterAll(async () => {
    if (userId) await store.deleteUser(userId);
  });

  it("같은 GitHub ID 로 다시 로그인하면 같은 사용자", async () => {
    const u = await store.getUser(userId);
    const again = await store.upsertGithubUser({ githubId: u!.githubId, login: "renamed" });
    expect(again.id).toBe(userId);
    expect(again.login).toBe("renamed");
  });

  it("Notion 토큰은 암호화 저장, 같은 워크스페이스 재연결 시 셋업 유지, 다른 워크스페이스면 초기화", async () => {
    await store.saveNotionAuth(userId, { accessToken: "secret_abc", refreshToken: "r1", botId: "b", workspaceId: "w1", workspaceName: "WS", workspaceIcon: null });
    const { db } = await import("../lib/db/client");
    const sql = await db();
    const [raw] = await sql`select access_token from notion_connections where user_id = ${userId}`;
    expect(raw!.access_token).not.toContain("secret_abc");

    const ds = { workLog: "1", projects: "2", records: "3", metrics: "4", achievements: "5", posts: "6", attachments: "7" };
    await store.saveNotionSetup(userId, { parentPageId: "p", dataSources: ds, resumePageId: "r" });
    await store.saveNotionAuth(userId, { accessToken: "secret_new", refreshToken: null, botId: "b", workspaceId: "w1", workspaceName: "WS", workspaceIcon: null });
    let c = await store.getNotionConnection(userId);
    expect(c!.accessToken).toBe("secret_new");
    expect(c!.dataSources).toEqual(ds);
    expect(await store.usersByWorkspace("w1")).toContain(userId);
    expect(await store.listReadyUserIds()).toContain(userId);

    await store.updateNotionTokens(userId, "secret_refreshed", null);
    c = await store.getNotionConnection(userId);
    expect(c!.accessToken).toBe("secret_refreshed");
    expect(c!.refreshToken).toBeNull(); // 기존 refresh 토큰이 없었으므로 유지(null)

    await store.saveNotionAuth(userId, { accessToken: "x", refreshToken: null, botId: "b", workspaceId: "w2", workspaceName: null, workspaceIcon: null });
    c = await store.getNotionConnection(userId);
    expect(c!.dataSources).toBeNull();
    expect(c!.setupAt).toBeNull();
  });

  it("설정 기본값 · 저장 · 민감값 복호화", async () => {
    expect((await store.getSettings(userId)).postIntervalDays).toBe(14);
    await store.saveSettings(userId, { ...store.DEFAULT_SETTINGS, resumeName: "홍길동", denylist: "ACME=A사", notifyWebhookUrl: "https://hooks.example.com/x" });
    const s = await store.getSettings(userId);
    expect(s.resumeName).toBe("홍길동");
    expect(s.denylist).toBe("ACME=A사");
    expect(s.notifyWebhookUrl).toBe("https://hooks.example.com/x");
  });

  it("AI 사용량: 한도 안에서만 예약, 동시 요청도 한도 초과 없음, 실패 시 되돌리기", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => store.reserveAiUsage(userId, "tailor", 3)));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(await store.monthlyAiUsage(userId)).toBe(3);
    await store.releaseAiUsage(results.find((r) => r.ok)!.id!);
    expect(await store.monthlyAiUsage(userId)).toBe(2);
    expect((await store.reserveAiUsage(userId, "digest", null)).ok).toBe(true); // 무제한
  });

  it("배치 기록: 실패는 마지막 성공으로 치지 않는다", async () => {
    const t0 = new Date(Date.now() - 1000);
    await store.recordJobRun(userId, "weekly-digest", "ok", "done", t0);
    await store.recordJobRun(userId, "weekly-digest", "error", "boom", new Date());
    expect((await store.lastSuccessfulRun(userId, "weekly-digest"))!.getTime()).toBe(t0.getTime());
    expect(await store.recentJobRuns(userId)).toHaveLength(2);
  });

  it("계정 삭제 시 연관 데이터 cascade 삭제", async () => {
    const tmp = await store.upsertGithubUser({ githubId: `tmp-${Date.now()}`, login: "tmp" });
    await store.saveSettings(tmp.id, store.DEFAULT_SETTINGS);
    await store.reserveAiUsage(tmp.id, "draft", 10);
    await store.deleteUser(tmp.id);
    expect(await store.getUser(tmp.id)).toBeNull();
    expect(await store.monthlyAiUsage(tmp.id)).toBe(0);
  });
});
