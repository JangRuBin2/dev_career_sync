"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { deleteUserBlobs } from "@/lib/blob";
import { getUserContext } from "@/lib/context";
import { revalidateUser } from "@/lib/data";
import { deleteNotionConnection, deleteUser, saveSettings, type JobName } from "@/lib/db/store";
import { JOB_LABEL, JOB_NAMES, runJobForUser } from "@/lib/jobs";
import { revokeNotionToken } from "@/lib/notion-oauth";
import { SESSION_COOKIE } from "@/lib/session";
import { parseSettingsForm } from "@/lib/settings-validate";

async function dbContext() {
  const ctx = await getUserContext();
  if (ctx.mode !== "db") throw new Error("로컬 env 모드에서는 설정을 .env 로 관리해요");
  return ctx;
}

async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    return { ok: (await fn()) || "저장했어요" };
  } catch (err) {
    unstable_rethrow(err);
    console.error(err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveSettingsAction(fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await dbContext();
    await saveSettings(ctx.userId, parseSettingsForm(fd));
    revalidateUser(ctx.userId); // 이력서 이름·금지어가 화면에 반영되도록
  });
}

/** Notion 연결 해제: 토큰 폐기 + 연결 정보 삭제. Notion 에 있는 데이터는 그대로 남는다 */
export async function disconnectNotionAction(): Promise<ActionState> {
  return run(async () => {
    const ctx = await dbContext();
    if (ctx.connection) await revokeNotionToken(ctx.connection.accessToken).catch((err) => console.warn("Notion 토큰 폐기 실패", err));
    await deleteNotionConnection(ctx.userId);
    revalidateUser(ctx.userId);
    redirect("/onboarding");
  });
}

/** 계정 삭제: Notion 토큰 폐기 → 비공개 파일 삭제 → DB 삭제(cascade) → 로그아웃 */
export async function deleteAccountAction(fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await dbContext();
    if (String(fd.get("confirm") ?? "").trim() !== ctx.login) throw new Error(`확인을 위해 GitHub 아이디(${ctx.login})를 정확히 입력하세요`);
    if (ctx.connection) await revokeNotionToken(ctx.connection.accessToken).catch((err) => console.warn("Notion 토큰 폐기 실패", err));
    await deleteUserBlobs(ctx.userId);
    await deleteUser(ctx.userId);
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/?deleted=1");
  });
}

/** 설정 화면의 "지금 실행" — 주기와 상관없이 바로 (AI 한도는 그대로 적용) */
export async function runJobNowAction(fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await dbContext();
    const job = String(fd.get("job") ?? "") as JobName;
    if (!JOB_NAMES.includes(job)) throw new Error("알 수 없는 작업");
    const r = await runJobForUser(ctx.userId, job, { force: true });
    return `${JOB_LABEL[job]}: ${r.message}`;
  });
}
