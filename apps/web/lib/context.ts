import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { parseDenylist, type DenyRule, type ResumeProfile } from "@careersync/core";
import { CareerRepo, createNotion, dataSourceIdsFromEnv } from "@careersync/core/notion";
import { DEV_SESSION, getSession, isAdmin } from "./auth";
import { hasDatabase } from "./db/client";
import { DEFAULT_SETTINGS, getNotionConnection, getSettings, upsertGithubUser, type NotionConnection, type UserSettings } from "./db/store";
import { notionForUser } from "./notion-oauth";

/**
 * 요청마다 한 번 만드는 사용자 컨텍스트 (React cache 로 요청 내 공유).
 *  - db 모드: 로그인 사용자 + Notion 연결 + 설정 (배포 환경)
 *  - env 모드: DB 없이 DEV_BYPASS_AUTH 로 띄운 로컬 개발 — 기존처럼 .env 의 Notion·설정을 쓴다
 */
export interface UserContext {
  mode: "db" | "env";
  userId: string;
  githubId: string;
  login: string;
  admin: boolean;
  settings: UserSettings;
  connection: NotionConnection | null;
  /** Notion 셋업까지 끝났을 때만 */
  repo: CareerRepo | null;
  resumePageId: string | null;
}

export interface ReadyContext extends UserContext {
  repo: CareerRepo;
}

function envSettings(): UserSettings {
  const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);
  return {
    ...DEFAULT_SETTINGS,
    resumeName: process.env.RESUME_NAME ?? "",
    resumeHeadline: process.env.RESUME_HEADLINE ?? "",
    denylist: process.env.DENYLIST ?? "",
    velogUsername: process.env.VELOG_USERNAME ?? "",
    postIntervalDays: num(process.env.POST_INTERVAL_DAYS, 14),
    postLeadDays: num(process.env.POST_LEAD_DAYS, 3),
    notifyWebhookUrl: process.env.NOTIFY_WEBHOOK_URL ?? "",
  };
}

export const getUserContext = cache(async (): Promise<UserContext> => {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasDatabase()) {
    if (session.userId !== DEV_SESSION.userId) throw new Error("DATABASE_URL 이 설정되지 않았습니다.");
    return {
      mode: "env",
      ...DEV_SESSION,
      admin: true,
      settings: envSettings(),
      connection: null,
      repo: new CareerRepo(createNotion(), dataSourceIdsFromEnv()),
      resumePageId: process.env.NOTION_RESUME_PAGE_ID ?? null,
    };
  }

  // 로컬 개발(우회 로그인)이면 DB 에 dev 사용자를 만든다
  const userId = session.userId === DEV_SESSION.userId ? (await upsertGithubUser({ githubId: "dev", login: "dev" })).id : session.userId;
  const [connection, settings] = await Promise.all([getNotionConnection(userId), getSettings(userId)]);
  const repo = connection?.dataSources ? new CareerRepo(notionForUser(userId, connection), connection.dataSources) : null;
  return {
    mode: "db",
    userId,
    githubId: session.githubId,
    login: session.login,
    admin: isAdmin(session.githubId),
    settings,
    connection,
    repo,
    resumePageId: connection?.resumePageId ?? null,
  };
});

/** Notion 연결·셋업이 끝난 사용자만. 아니면 온보딩으로 */
export const requireReady = cache(async (): Promise<ReadyContext> => {
  const ctx = await getUserContext();
  if (!ctx.repo) redirect("/onboarding");
  return ctx as ReadyContext;
});

export const profileOf = (ctx: UserContext): ResumeProfile => ({
  name: ctx.settings.resumeName || undefined,
  headline: ctx.settings.resumeHeadline || undefined,
});

export const denylistOf = (ctx: UserContext): DenyRule[] => parseDenylist(ctx.settings.denylist);
