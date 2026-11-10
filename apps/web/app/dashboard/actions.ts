"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { put } from "@vercel/blob";
import { renderResume } from "@careersync/core";
import { createAnthropic, explainAuthError, tailorResume } from "@careersync/core/llm";
import { buildTailorMaterial } from "@careersync/core/tailor";
import type { PostMode } from "@careersync/core/notion";
import { TAGS, getRepo, invalidate } from "@/lib/data";
import { ownsCapture, promoteToPublic, userPrefix } from "@/lib/blob";
import { withAiQuota } from "@/lib/ai";
import { denylistOf, profileOf, requireReady } from "@/lib/context";
import { fetchOg } from "@/lib/og";
import { deleteTailored, newTailoredId, saveTailored } from "@/lib/tailored-store";
import { requireSession } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

/** 세션 확인 + 사용자 오류를 { error } 로 변환 (redirect 는 그대로 통과) */
async function guard(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    await requireSession();
    const ok = await fn();
    return { ok: ok || "저장했어요" };
  } catch (err) {
    unstable_rethrow(err);
    console.error(err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

// ---------- 빠른 기록 ----------

export async function quickLogAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const title = str(fd, "title");
    const content = str(fd, "content");
    if (!title && !content) throw new Error("제목이나 내용을 입력하세요");
    await (await getRepo()).createWorkLog({
      title: title || content.slice(0, 40),
      content,
      type: str(fd, "type") || undefined,
      projectId: str(fd, "projectId") || undefined,
    });
    await invalidate(TAGS.worklogs);
    return "기록했어요";
  });
}

// ---------- 이력서 ----------

/** 이력서 전체를 다시 그려 Notion 에 반영하고, 스냅샷을 비공개 Blob 에 남긴다 */
async function applyResume(): Promise<string> {
  const ctx = await requireReady();
  const repo = ctx.repo;
  const [projects, achievements] = await Promise.all([repo.listProjects(), repo.listAchievements({ assignment: ["확인됨", "새 프로젝트"] })]);
  const markdown = renderResume({ profile: profileOf(ctx), projects, achievements });
  const pageId = ctx.resumePageId;
  if (!pageId) throw new Error("이력서 페이지가 아직 없어요. 설정에서 Notion 연결을 확인하세요.");
  await repo.replacePageMarkdown(pageId, markdown);
  if (process.env.BLOB_PRIVATE_READ_WRITE_TOKEN) {
    await put(`${userPrefix(ctx.userId)}resume-history/${new Date().toISOString()}.md`, markdown, {
      access: "private",
      contentType: "text/markdown; charset=utf-8",
      token: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN,
    });
  }
  return markdown;
}

export async function applyResumeAction(): Promise<ActionState> {
  return guard(async () => {
    await applyResume();
    redirect("/dashboard/resume?applied=1");
  });
}

// ---------- 채용공고 맞춤 이력서 ----------

/** 공고 + 내 근거로 회사별 맞춤본을 만들어 따로 저장 (원본 이력서는 그대로) */
export async function tailorResumeAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const job = { company: str(fd, "company"), position: str(fd, "position"), text: str(fd, "jd"), focus: str(fd, "focus") || undefined };
    if (!job.text) throw new Error("채용공고 내용을 붙여넣으세요");
    if (job.text.length > 30_000) throw new Error("공고가 너무 길어요. 자격요건·우대사항·주요업무 위주로 줄여 주세요.");

    const ctx = await requireReady();
    const repo = ctx.repo;
    const [projects, records, metrics, achievements] = await Promise.all([
      repo.listProjects(),
      repo.listRecords(),
      repo.listMetrics(),
      repo.listAchievements(),
    ]);
    const material = buildTailorMaterial({ projects, records, metrics, achievements, denylist: denylistOf(ctx) });

    const result = await withAiQuota(ctx, "tailor", async () => {
      try {
        return await tailorResume(createAnthropic(), { job, material });
      } catch (err) {
        console.error(err);
        // 서버 키 문제는 운영자 몫 — 사용자에게는 일반 안내만
        throw explainAuthError(err) ? new Error("AI 서비스 설정에 문제가 있어요. 잠시 후 다시 시도하거나 운영자에게 알려 주세요.") : err;
      }
    });

    const id = newTailoredId();
    await saveTailored(ctx.userId, {
      id,
      createdAt: new Date().toISOString(),
      job,
      profile: profileOf(ctx),
      material,
      result,
    });
    redirect(`/dashboard/resume/tailor/${id}`);
  });
}

export async function deleteTailoredAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const { userId } = await requireReady();
    await deleteTailored(userId, str(fd, "id"));
    redirect("/dashboard/resume/tailor?deleted=1");
  });
}

// ---------- Inbox: 프로젝트 배정 확인 ----------

export async function resolveAchievementAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const id = str(fd, "id");
    const kind = str(fd, "kind");
    const text = str(fd, "text") || undefined;
    const repo = await getRepo();

    if (kind === "hold" || kind === "reject") {
      await repo.resolveAchievement(id, { kind });
    } else if (kind === "existing") {
      const projectId = str(fd, "projectId");
      if (!projectId) throw new Error("프로젝트를 선택하세요");
      await repo.resolveAchievement(id, { kind: "existing", projectId, text });
    } else if (kind === "new") {
      const name = str(fd, "newName");
      if (!name) throw new Error("새 프로젝트 이름을 입력하세요");
      await repo.resolveAchievement(id, {
        kind: "new",
        text,
        project: { name, role: str(fd, "newRole"), periodStart: str(fd, "newStart") || null, stack: str(fd, "newStack").split(",").map((s) => s.trim()).filter(Boolean) },
      });
    } else {
      throw new Error(`알 수 없는 선택: ${kind}`);
    }

    if (kind === "existing" || kind === "new") await applyResume();
    await invalidate(TAGS.achievements, TAGS.projects, TAGS.records, TAGS.metrics);
    redirect(`/dashboard/inbox?done=${kind}`);
  });
}

export async function confirmRecordAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await (await getRepo()).confirmRecord(str(fd, "id"), str(fd, "projectId") || undefined);
    await invalidate(TAGS.records);
    await invalidate(TAGS.metrics);
  });
}

// ---------- 프로젝트 ----------

export async function updateProjectLinksAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const id = str(fd, "id");
    const clean = (v: string) => {
      if (!v) return null;
      const u = new URL(v);
      if (!/^https?:$/.test(u.protocol)) throw new Error("http(s) 링크만 입력하세요");
      return u.toString();
    };
    await (await getRepo()).updateProjectLinks(id, { publicUrl: clean(str(fd, "publicUrl")), repoUrl: clean(str(fd, "repoUrl")) });
    await invalidate(TAGS.projects);
  });
}

export async function setCoverImageAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await (await getRepo()).updateProjectLinks(str(fd, "projectId"), { coverImage: str(fd, "url") || null });
    await invalidate(TAGS.projects);
  });
}

// ---------- 첨부 ----------

export async function addLinkAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const og = await fetchOg(str(fd, "url"));
    await (await getRepo()).createLinkAttachment({
      name: str(fd, "name") || og.title || og.url,
      url: og.url,
      ogImage: og.image,
      caption: str(fd, "caption"),
      projectId: str(fd, "projectId") || null,
      recordId: str(fd, "recordId") || null,
    });
    await invalidate(TAGS.attachments);
  });
}

/** 공개 승격: 마스킹 확인 체크가 있어야만 public store 로 복사 */
export async function promoteAttachmentAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    if (fd.get("maskChecked") !== "on") throw new Error("민감정보 마스킹을 확인한 뒤 체크해 주세요");
    const ctx = await requireReady();
    const repo = ctx.repo;
    const att = await repo.getAttachment(str(fd, "id"));
    if (att.kind !== "이미지" || !att.blobPath) throw new Error("이미지 첨부만 공개 전환할 수 있어요");
    // blobPath 는 사용자가 Notion 에서 바꿀 수 있는 값이라, 본인 파일인지 반드시 확인 (남의 비공개 캡처 공개 방지)
    const legacy = ctx.admin && att.blobPath.startsWith("captures/") && !att.blobPath.includes("..");
    if (!ownsCapture(ctx.userId, att.blobPath) && !legacy) throw new Error("이 첨부의 파일에 접근할 수 없어요");
    const url = att.publicUrl ?? (await promoteToPublic(att.blobPath));
    await repo.setAttachmentVisibility(att.id, "공개가능", url);
    await invalidate(TAGS.attachments);
  });
}

/** 비공개로 되돌리기. 이미 velog 등에 쓰인 공개 URL 은 별도로 삭제해야 한다 */
export async function demoteAttachmentAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await (await getRepo()).setAttachmentVisibility(str(fd, "id"), "비공개", null);
    await invalidate(TAGS.attachments);
  });
}

// ---------- 포스팅 ----------

export async function updatePostSettingsAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const id = str(fd, "id");
    // 발행 모드는 자동 발행(현재 비활성화) 전용이라 폼에 있을 때만 반영
    const mode = str(fd, "mode") as PostMode;
    const target = str(fd, "targetDate"); // 발행 목표일 (date, KST)
    const reviewed = fd.get("reviewed") === "on";
    await (await getRepo()).updatePost(id, {
      ...(mode ? { mode } : {}),
      reviewed,
      scheduledAt: target ? new Date(`${target}T09:00:00+09:00`).toISOString() : null,
      status: reviewed ? "검토완료" : "검토대기",
    });
    await invalidate(TAGS.posts);
  });
}

/** 직접 블로그에 올린 뒤 발행처·URL 기록 */
export async function markPublishedAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const id = str(fd, "id");
    const platform = str(fd, "platform");
    const raw = str(fd, "url");
    let url: string | null = null;
    if (raw) {
      const u = new URL(raw);
      if (!/^https?:$/.test(u.protocol)) throw new Error("http(s) 링크만 입력하세요");
      url = u.toString();
    }
    const repo = await getRepo();
    const post = await repo.getPost(id);
    await repo.updatePost(id, {
      status: "발행됨",
      reviewed: true,
      velogUrl: url ?? post.velogUrl,
      publishedAt: new Date().toISOString(),
      platforms: [...new Set([...post.platforms, ...(platform ? [platform] : [])])],
    });
    await invalidate(TAGS.posts);
    return "발행 완료로 기록했어요";
  });
}

export async function savePostBodyAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await (await getRepo()).updatePostBody(str(fd, "id"), str(fd, "markdown"));
    await invalidate(TAGS.posts);
  });
}
