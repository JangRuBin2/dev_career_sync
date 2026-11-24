import "server-only";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import type { AssignmentStatus, CareerRepo, PostStatus } from "@careersync/core/notion";
import { getUserContext, requireReady } from "./context";

/** 캐시 태그 — 실제 태그는 사용자별로 `u:<userId>:<tag>` */
export const TAGS = {
  projects: "projects",
  records: "records",
  metrics: "metrics",
  achievements: "achievements",
  posts: "posts",
  attachments: "attachments",
  worklogs: "worklogs",
} as const;
export type Tag = (typeof TAGS)[keyof typeof TAGS];
export const ALL_TAGS = Object.values(TAGS);

export const userTag = (userId: string, tag: Tag) => `u:${userId}:${tag}`;

const REVALIDATE = 300;

/** 로그인 사용자의 Notion 데이터를 사용자별 키·태그로 캐시 */
async function cachedFor<R>(name: string, tag: Tag, args: unknown[], fn: (repo: CareerRepo) => Promise<R>): Promise<R> {
  const ctx = await requireReady();
  return unstable_cache(() => fn(ctx.repo), [name, ctx.userId, JSON.stringify(args)], {
    tags: [userTag(ctx.userId, tag)],
    revalidate: REVALIDATE,
  })();
}

export async function getRepo(): Promise<CareerRepo> {
  return (await requireReady()).repo;
}

/** Server Action 에서: 현재 사용자의 캐시 즉시 무효화 */
export async function invalidate(...tags: Tag[]) {
  const { userId } = await getUserContext();
  for (const t of tags) updateTag(userTag(userId, t));
}

/** Route Handler · 배치에서: 특정 사용자 캐시 무효화 */
export function revalidateUser(userId: string, tags: readonly Tag[] = ALL_TAGS) {
  for (const t of tags) revalidateTag(userTag(userId, t), { expire: 0 });
}

export const getProjects = () => cachedFor("projects", TAGS.projects, [], (r) => r.listProjects());
export const getProject = (id: string) => cachedFor("project", TAGS.projects, [id], (r) => r.getProject(id));
export const getRecords = (projectId?: string) => cachedFor("records", TAGS.records, [projectId], (r) => r.listRecords({ projectId }));
export const getRecord = (id: string) => cachedFor("record", TAGS.records, [id], (r) => r.getRecord(id));
export const getMetrics = (recordId?: string) => cachedFor("metrics", TAGS.metrics, [recordId], (r) => r.listMetrics({ recordId }));
export const getAchievements = (assignment?: AssignmentStatus[]) =>
  cachedFor("achievements", TAGS.achievements, [assignment], (r) => r.listAchievements({ assignment }));
export const getPosts = (statuses?: PostStatus[]) => cachedFor("posts", TAGS.posts, [statuses], (r) => r.listPosts({ statuses }));
export const getPost = (id: string) => cachedFor("post", TAGS.posts, [id], (r) => r.getPost(id));
export const getPostMarkdown = (id: string) => cachedFor("post-md", TAGS.posts, [id], (r) => r.getPageMarkdown(id));
export const getAttachments = (opts: { projectId?: string; recordId?: string } = {}) =>
  cachedFor("attachments", TAGS.attachments, [opts], (r) => r.listAttachments(opts));
export const getWorkLogs = (since?: string) => cachedFor("worklogs", TAGS.worklogs, [since], (r) => r.listWorkLogs({ since }));
