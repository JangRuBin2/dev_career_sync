import "server-only";
import { unstable_cache } from "next/cache";
import { CareerRepo, createNotion, dataSourceIdsFromEnv, type AssignmentStatus, type PostStatus } from "@careersync/core/notion";

/** 캐시 태그 — 배치·webhook·server action 이 이 태그로 무효화한다 */
export const TAGS = {
  projects: "projects",
  records: "records",
  metrics: "metrics",
  achievements: "achievements",
  posts: "posts",
  attachments: "attachments",
  worklogs: "worklogs",
} as const;
export const ALL_TAGS = Object.values(TAGS);

let repo: CareerRepo | null = null;
export function getRepo(): CareerRepo {
  repo ??= new CareerRepo(createNotion(), dataSourceIdsFromEnv());
  return repo;
}

const REVALIDATE = 300;
const cached = <A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, tags: string[]) =>
  unstable_cache(fn, [key], { tags, revalidate: REVALIDATE });

export const getProjects = cached(() => getRepo().listProjects(), "projects", [TAGS.projects]);
export const getProject = cached((id: string) => getRepo().getProject(id), "project", [TAGS.projects]);
export const getRecords = cached((projectId?: string) => getRepo().listRecords({ projectId }), "records", [TAGS.records]);
export const getRecord = cached((id: string) => getRepo().getRecord(id), "record", [TAGS.records]);
export const getMetrics = cached((recordId?: string) => getRepo().listMetrics({ recordId }), "metrics", [TAGS.metrics]);
export const getAchievements = cached(
  (assignment?: AssignmentStatus[]) => getRepo().listAchievements({ assignment }),
  "achievements",
  [TAGS.achievements],
);
export const getPosts = cached((statuses?: PostStatus[]) => getRepo().listPosts({ statuses }), "posts", [TAGS.posts]);
export const getPost = cached((id: string) => getRepo().getPost(id), "post", [TAGS.posts]);
export const getPostMarkdown = cached((id: string) => getRepo().getPageMarkdown(id), "post-md", [TAGS.posts]);
export const getAttachments = cached(
  (opts: { projectId?: string; recordId?: string } = {}) => getRepo().listAttachments(opts),
  "attachments",
  [TAGS.attachments],
);
export const getWorkLogs = cached((since?: string) => getRepo().listWorkLogs({ since }), "worklogs", [TAGS.worklogs]);
