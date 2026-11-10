"use server";

import { updateTag } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { put } from "@vercel/blob";
import { parseDenylist, renderResume } from "@careersync/core";
import { createAnthropic, explainAuthError, tailorResume } from "@careersync/core/llm";
import { buildTailorMaterial } from "@careersync/core/tailor";
import type { PostMode } from "@careersync/core/notion";
import { TAGS, getRepo } from "@/lib/data";
import { promoteToPublic } from "@/lib/blob";
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
    await getRepo().createWorkLog({
      title: title || content.slice(0, 40),
      content,
      type: str(fd, "type") || undefined,
      projectId: str(fd, "projectId") || undefined,
    });
    updateTag(TAGS.worklogs);
    return "기록했어요";
  });
}

// ---------- 이력서 ----------

/** 이력서 전체를 다시 그려 Notion 에 반영하고, 스냅샷을 비공개 Blob 에 남긴다 */
async function applyResume(): Promise<string> {
  const repo = getRepo();
  const [projects, achievements] = await Promise.all([repo.listProjects(), repo.listAchievements({ assignment: ["확인됨", "새 프로젝트"] })]);
  const markdown = renderResume({
    profile: { name: process.env.RESUME_NAME, headline: process.env.RESUME_HEADLINE },
    projects,
    achievements,
  });
  const pageId = process.env.NOTION_RESUME_PAGE_ID;
  if (!pageId) throw new Error("NOTION_RESUME_PAGE_ID 가 설정되지 않았습니다.");
  await repo.replacePageMarkdown(pageId, markdown);
  if (process.env.BLOB_PRIVATE_READ_WRITE_TOKEN) {
    await put(`resume-history/${new Date().toISOString()}.md`, markdown, {
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

    const repo = getRepo();
    const [projects, records, metrics, achievements] = await Promise.all([
      repo.listProjects(),
      repo.listRecords(),
      repo.listMetrics(),
      repo.listAchievements(),
    ]);
    const material = buildTailorMaterial({ projects, records, metrics, achievements, denylist: parseDenylist(process.env.DENYLIST) });

    let result;
    try {
      result = await tailorResume(createAnthropic(), { job, material });
    } catch (err) {
      const auth = explainAuthError(err);
      throw auth ? new Error(auth) : err;
    }

    const id = newTailoredId();
    await saveTailored({
      id,
      createdAt: new Date().toISOString(),
      job,
      profile: { name: process.env.RESUME_NAME, headline: process.env.RESUME_HEADLINE },
      material,
      result,
    });
    redirect(`/dashboard/resume/tailor/${id}`);
  });
}

export async function deleteTailoredAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await deleteTailored(str(fd, "id"));
    redirect("/dashboard/resume/tailor?deleted=1");
  });
}

// ---------- Inbox: 프로젝트 배정 확인 ----------

export async function resolveAchievementAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const id = str(fd, "id");
    const kind = str(fd, "kind");
    const text = str(fd, "text") || undefined;
    const repo = getRepo();

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
    for (const t of [TAGS.achievements, TAGS.projects, TAGS.records, TAGS.metrics]) updateTag(t);
    redirect(`/dashboard/inbox?done=${kind}`);
  });
}

export async function confirmRecordAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await getRepo().confirmRecord(str(fd, "id"), str(fd, "projectId") || undefined);
    updateTag(TAGS.records);
    updateTag(TAGS.metrics);
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
    await getRepo().updateProjectLinks(id, { publicUrl: clean(str(fd, "publicUrl")), repoUrl: clean(str(fd, "repoUrl")) });
    updateTag(TAGS.projects);
  });
}

export async function setCoverImageAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await getRepo().updateProjectLinks(str(fd, "projectId"), { coverImage: str(fd, "url") || null });
    updateTag(TAGS.projects);
  });
}

// ---------- 첨부 ----------

export async function addLinkAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const og = await fetchOg(str(fd, "url"));
    await getRepo().createLinkAttachment({
      name: str(fd, "name") || og.title || og.url,
      url: og.url,
      ogImage: og.image,
      caption: str(fd, "caption"),
      projectId: str(fd, "projectId") || null,
      recordId: str(fd, "recordId") || null,
    });
    updateTag(TAGS.attachments);
  });
}

/** 공개 승격: 마스킹 확인 체크가 있어야만 public store 로 복사 */
export async function promoteAttachmentAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    if (fd.get("maskChecked") !== "on") throw new Error("민감정보 마스킹을 확인한 뒤 체크해 주세요");
    const repo = getRepo();
    const att = await repo.getAttachment(str(fd, "id"));
    if (att.kind !== "이미지" || !att.blobPath) throw new Error("이미지 첨부만 공개 전환할 수 있어요");
    const url = att.publicUrl ?? (await promoteToPublic(att.blobPath));
    await repo.setAttachmentVisibility(att.id, "공개가능", url);
    updateTag(TAGS.attachments);
  });
}

/** 비공개로 되돌리기. 이미 velog 등에 쓰인 공개 URL 은 별도로 삭제해야 한다 */
export async function demoteAttachmentAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await getRepo().setAttachmentVisibility(str(fd, "id"), "비공개", null);
    updateTag(TAGS.attachments);
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
    await getRepo().updatePost(id, {
      ...(mode ? { mode } : {}),
      reviewed,
      scheduledAt: target ? new Date(`${target}T09:00:00+09:00`).toISOString() : null,
      status: reviewed ? "검토완료" : "검토대기",
    });
    updateTag(TAGS.posts);
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
    const repo = getRepo();
    const post = await repo.getPost(id);
    await repo.updatePost(id, {
      status: "발행됨",
      reviewed: true,
      velogUrl: url ?? post.velogUrl,
      publishedAt: new Date().toISOString(),
      platforms: [...new Set([...post.platforms, ...(platform ? [platform] : [])])],
    });
    updateTag(TAGS.posts);
    return "발행 완료로 기록했어요";
  });
}

export async function savePostBodyAction(fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await getRepo().updatePostBody(str(fd, "id"), str(fd, "markdown"));
    updateTag(TAGS.posts);
  });
}
