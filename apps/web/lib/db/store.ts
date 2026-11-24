import "server-only";
import type { DataSourceIds } from "@careersync/core/notion";
import { decrypt, decryptOrNull, encrypt, encryptOrNull } from "../crypto";
import { db } from "./client";

// ---------- 사용자 ----------

export interface User {
  id: string;
  githubId: string;
  login: string;
  avatarUrl: string | null;
  createdAt: string;
}

type UserRow = { id: string; github_id: string; login: string; avatar_url: string | null; created_at: Date };
const toUser = (r: UserRow): User => ({ id: r.id, githubId: r.github_id, login: r.login, avatarUrl: r.avatar_url, createdAt: r.created_at.toISOString() });

/** GitHub 로그인 시 사용자 생성/갱신 */
export async function upsertGithubUser(input: { githubId: string; login: string; avatarUrl?: string | null }): Promise<User> {
  const sql = await db();
  const [row] = await sql<UserRow[]>`
    insert into users (github_id, login, avatar_url) values (${input.githubId}, ${input.login}, ${input.avatarUrl ?? null})
    on conflict (github_id) do update set login = excluded.login, avatar_url = excluded.avatar_url, last_login_at = now()
    returning id, github_id, login, avatar_url, created_at`;
  return toUser(row!);
}

export async function getUser(id: string): Promise<User | null> {
  const sql = await db();
  const [row] = await sql<UserRow[]>`select id, github_id, login, avatar_url, created_at from users where id = ${id}`;
  return row ? toUser(row) : null;
}

/** 계정 삭제 — 연결·설정·사용량·배치 기록은 cascade 로 함께 지워진다 */
export async function deleteUser(id: string): Promise<void> {
  const sql = await db();
  await sql`delete from users where id = ${id}`;
}

// ---------- Notion 연결 ----------

export interface NotionConnection {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  botId: string;
  workspaceId: string;
  workspaceName: string | null;
  workspaceIcon: string | null;
  parentPageId: string | null;
  dataSources: DataSourceIds | null;
  resumePageId: string | null;
  setupAt: string | null;
}

type ConnRow = {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  bot_id: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  parent_page_id: string | null;
  data_sources: DataSourceIds | null;
  resume_page_id: string | null;
  setup_at: Date | null;
};
const toConn = (r: ConnRow): NotionConnection => ({
  userId: r.user_id,
  accessToken: decrypt(r.access_token),
  refreshToken: decryptOrNull(r.refresh_token),
  botId: r.bot_id,
  workspaceId: r.workspace_id,
  workspaceName: r.workspace_name,
  workspaceIcon: r.workspace_icon,
  parentPageId: r.parent_page_id,
  dataSources: r.data_sources,
  resumePageId: r.resume_page_id,
  setupAt: r.setup_at?.toISOString() ?? null,
});

export async function getNotionConnection(userId: string): Promise<NotionConnection | null> {
  const sql = await db();
  const [row] = await sql<ConnRow[]>`select * from notion_connections where user_id = ${userId}`;
  return row ? toConn(row) : null;
}

/**
 * OAuth 완료 시 저장. 같은 워크스페이스로 다시 연결하면 기존 DB 설정은 유지하고,
 * 다른 워크스페이스로 바꾸면 DB 설정을 비워 온보딩을 다시 하게 한다.
 */
export async function saveNotionAuth(
  userId: string,
  t: { accessToken: string; refreshToken: string | null; botId: string; workspaceId: string; workspaceName: string | null; workspaceIcon: string | null },
): Promise<void> {
  const sql = await db();
  await sql`
    insert into notion_connections (user_id, access_token, refresh_token, bot_id, workspace_id, workspace_name, workspace_icon)
    values (${userId}, ${encrypt(t.accessToken)}, ${encryptOrNull(t.refreshToken)}, ${t.botId}, ${t.workspaceId}, ${t.workspaceName}, ${t.workspaceIcon})
    on conflict (user_id) do update set
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      bot_id = excluded.bot_id,
      workspace_name = excluded.workspace_name,
      workspace_icon = excluded.workspace_icon,
      parent_page_id = case when notion_connections.workspace_id = excluded.workspace_id then notion_connections.parent_page_id end,
      data_sources = case when notion_connections.workspace_id = excluded.workspace_id then notion_connections.data_sources end,
      resume_page_id = case when notion_connections.workspace_id = excluded.workspace_id then notion_connections.resume_page_id end,
      setup_at = case when notion_connections.workspace_id = excluded.workspace_id then notion_connections.setup_at end,
      workspace_id = excluded.workspace_id,
      updated_at = now()`;
}

/** 토큰 갱신(refresh_token grant) 결과 저장 */
export async function updateNotionTokens(userId: string, accessToken: string, refreshToken: string | null): Promise<void> {
  const sql = await db();
  await sql`update notion_connections set access_token = ${encrypt(accessToken)},
    refresh_token = coalesce(${encryptOrNull(refreshToken)}, refresh_token), updated_at = now() where user_id = ${userId}`;
}

export async function saveNotionSetup(userId: string, s: { parentPageId: string; dataSources: DataSourceIds; resumePageId: string }): Promise<void> {
  const sql = await db();
  await sql`update notion_connections set parent_page_id = ${s.parentPageId}, data_sources = ${sql.json(s.dataSources)},
    resume_page_id = ${s.resumePageId}, setup_at = now(), updated_at = now() where user_id = ${userId}`;
}

export async function deleteNotionConnection(userId: string): Promise<void> {
  const sql = await db();
  await sql`delete from notion_connections where user_id = ${userId}`;
}

/** webhook: 이벤트의 워크스페이스에 연결된 사용자들 */
export async function usersByWorkspace(workspaceId: string): Promise<string[]> {
  const sql = await db();
  return (await sql<{ user_id: string }[]>`select user_id from notion_connections where workspace_id = ${workspaceId}`).map((r) => r.user_id);
}

/** 배치 대상: Notion 셋업까지 끝난 사용자 */
export async function listReadyUserIds(): Promise<string[]> {
  const sql = await db();
  return (await sql<{ user_id: string }[]>`select user_id from notion_connections where setup_at is not null order by setup_at`).map((r) => r.user_id);
}

// ---------- 설정 ----------

export interface UserSettings {
  resumeName: string;
  resumeHeadline: string;
  denylist: string;
  velogUsername: string;
  postIntervalDays: number;
  postLeadDays: number;
  notifyWebhookUrl: string;
  autoDigest: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  resumeName: "",
  resumeHeadline: "",
  denylist: "",
  velogUsername: "",
  postIntervalDays: 14,
  postLeadDays: 3,
  notifyWebhookUrl: "",
  autoDigest: true,
};

export async function getSettings(userId: string): Promise<UserSettings> {
  const sql = await db();
  const [r] = await sql<
    {
      resume_name: string | null;
      resume_headline: string | null;
      denylist: string | null;
      velog_username: string | null;
      post_interval_days: number;
      post_lead_days: number;
      notify_webhook_url: string | null;
      auto_digest: boolean;
    }[]
  >`select * from user_settings where user_id = ${userId}`;
  if (!r) return { ...DEFAULT_SETTINGS };
  return {
    resumeName: r.resume_name ?? "",
    resumeHeadline: r.resume_headline ?? "",
    denylist: decryptOrNull(r.denylist) ?? "",
    velogUsername: r.velog_username ?? "",
    postIntervalDays: r.post_interval_days,
    postLeadDays: r.post_lead_days,
    notifyWebhookUrl: decryptOrNull(r.notify_webhook_url) ?? "",
    autoDigest: r.auto_digest,
  };
}

export async function saveSettings(userId: string, s: UserSettings): Promise<void> {
  const sql = await db();
  const row = {
    user_id: userId,
    resume_name: s.resumeName || null,
    resume_headline: s.resumeHeadline || null,
    denylist: encryptOrNull(s.denylist),
    velog_username: s.velogUsername || null,
    post_interval_days: s.postIntervalDays,
    post_lead_days: s.postLeadDays,
    notify_webhook_url: encryptOrNull(s.notifyWebhookUrl),
    auto_digest: s.autoDigest,
  };
  await sql`
    insert into user_settings ${sql(row)}
    on conflict (user_id) do update set
      resume_name = excluded.resume_name, resume_headline = excluded.resume_headline, denylist = excluded.denylist,
      velog_username = excluded.velog_username, post_interval_days = excluded.post_interval_days,
      post_lead_days = excluded.post_lead_days, notify_webhook_url = excluded.notify_webhook_url,
      auto_digest = excluded.auto_digest, updated_at = now()`;
}

// ---------- AI 사용량 ----------

export type AiKind = "digest" | "draft" | "tailor";

/** 이번 달(UTC) 사용 횟수 */
export async function monthlyAiUsage(userId: string): Promise<number> {
  const sql = await db();
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from ai_usage where user_id = ${userId} and created_at >= date_trunc('month', now())`;
  return r?.n ?? 0;
}

/**
 * 한도 안에서 1회 예약. 한도 초과면 false.
 * 사용자별 advisory lock 으로 동시에 여러 요청이 와도 한도를 넘지 않는다.
 */
export async function reserveAiUsage(userId: string, kind: AiKind, limit: number | null): Promise<{ ok: boolean; id: number | null; used: number }> {
  const sql = await db();
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`ai:${userId}`}))`;
    const [r] = await tx<{ n: number }[]>`
      select count(*)::int as n from ai_usage where user_id = ${userId} and created_at >= date_trunc('month', now())`;
    const used = r?.n ?? 0;
    if (limit !== null && used >= limit) return { ok: false, id: null, used };
    const [row] = await tx<{ id: string }[]>`insert into ai_usage (user_id, kind) values (${userId}, ${kind}) returning id`;
    return { ok: true, id: Number(row!.id), used: used + 1 };
  });
}

/** AI 호출이 실패하면 예약을 되돌린다 */
export async function releaseAiUsage(id: number): Promise<void> {
  const sql = await db();
  await sql`delete from ai_usage where id = ${id}`;
}

// ---------- 배치 기록 ----------

export type JobName = "weekly-digest" | "draft-posts" | "sync-rss";
export type JobStatus = "ok" | "skipped" | "error";

export async function recordJobRun(userId: string, job: JobName, status: JobStatus, message: string, startedAt: Date): Promise<void> {
  const sql = await db();
  await sql`insert into job_runs (user_id, job, status, message, started_at, finished_at)
    values (${userId}, ${job}, ${status}, ${message.slice(0, 2000)}, ${startedAt}, now())`;
}

/** 마지막으로 끝난(ok/skipped) 실행 시각 — 실패는 다음 cron 에서 다시 시도 */
export async function lastSuccessfulRun(userId: string, job: JobName): Promise<Date | null> {
  const sql = await db();
  const [r] = await sql<{ started_at: Date }[]>`
    select started_at from job_runs where user_id = ${userId} and job = ${job} and status <> 'error'
    order by started_at desc limit 1`;
  return r?.started_at ?? null;
}

export async function recentJobRuns(userId: string, limit = 10) {
  const sql = await db();
  return sql<{ job: JobName; status: JobStatus; message: string | null; started_at: Date }[]>`
    select job, status, message, started_at from job_runs where user_id = ${userId} order by started_at desc limit ${limit}`;
}
