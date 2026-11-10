"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { findExistingWorkspace, setupNotionWorkspace } from "@careersync/core/notion";
import type { ActionState } from "@/lib/action-state";
import { getUserContext } from "@/lib/context";
import { saveNotionSetup } from "@/lib/db/store";
import { notionForUser } from "@/lib/notion-oauth";

/**
 * 고른 페이지 아래에 CareerSync 를 준비한다.
 * 이미 DB 7개가 있으면(예전 setup:notion 결과) 그대로 연결하고, 없으면 새로 만든다.
 */
export async function setupWorkspaceAction(fd: FormData): Promise<ActionState> {
  try {
    const ctx = await getUserContext();
    if (ctx.mode !== "db" || !ctx.connection) throw new Error("먼저 Notion 을 연결하세요");
    const pageId = String(fd.get("pageId") ?? "").trim();
    if (!/^[0-9a-f-]{32,36}$/i.test(pageId)) throw new Error("CareerSync 를 둘 페이지를 고르세요");

    const notion = notionForUser(ctx.userId, ctx.connection);
    const existing = await findExistingWorkspace(notion, pageId).catch(() => null);
    const result = existing ?? (await setupNotionWorkspace(notion, pageId, () => {}));
    await saveNotionSetup(ctx.userId, { parentPageId: pageId, dataSources: result.dataSources, resumePageId: result.resumePageId });
    redirect(`/dashboard?welcome=${existing ? "existing" : "new"}`);
  } catch (err) {
    unstable_rethrow(err);
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    return { error: /restricted|object_not_found|Could not find/i.test(msg) ? "이 페이지에 CareerSync 접근 권한이 없어요. Notion 연결을 다시 하면서 페이지를 공유해 주세요." : msg };
  }
}
