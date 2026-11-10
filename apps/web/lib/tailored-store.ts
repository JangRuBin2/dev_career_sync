import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import type { ResumeProfile } from "@careersync/core";
import type { JobPosting, TailorMaterial, ValidatedTailored } from "@careersync/core/tailor";

/**
 * 회사별 맞춤 이력서 저장소 (resume-ai-toolkit 의 companies/<회사>/ 자리).
 * 원본(Notion 이력서 페이지)은 건드리지 않고, 맞춤본만 따로 쌓는다.
 *  - 배포: 비공개 Blob `resume-tailored/<id>.json`
 *  - 로컬 개발(Blob 토큰 없음): `.careersync/tailored/<id>.json`
 */
export interface TailoredDoc {
  id: string;
  createdAt: string;
  job: JobPosting;
  profile: ResumeProfile;
  /** 생성 당시의 근거 스냅샷 — 나중에 Notion 이 바뀌어도 이 버전은 그대로 렌더된다 */
  material: TailorMaterial;
  result: ValidatedTailored;
}

export type TailoredSummary = Pick<TailoredDoc, "id" | "createdAt"> & { company: string; position: string };

const PREFIX = "resume-tailored/";
const token = () => process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
const localDir = () => path.join(process.cwd(), ".careersync", "tailored");
const ID_RE = /^[0-9a-z]+-[0-9a-f]{6}$/;

function backend(): "blob" | "local" {
  if (token()) return "blob";
  if (process.env.NODE_ENV !== "production") return "local";
  throw new Error("맞춤 이력서를 저장하려면 BLOB_PRIVATE_READ_WRITE_TOKEN 이 필요해요.");
}

export function storageLabel(): string {
  return token() ? "비공개 Blob" : process.env.NODE_ENV !== "production" ? "로컬 .careersync/ (개발용)" : "저장소 없음";
}

export function newTailoredId(now = new Date()): string {
  // 시간순 정렬되는 id
  return `${now.getTime().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export async function saveTailored(doc: TailoredDoc): Promise<void> {
  const body = JSON.stringify(doc);
  if (backend() === "blob") {
    await put(`${PREFIX}${doc.id}.json`, body, { access: "private", contentType: "application/json; charset=utf-8", token: token() });
    return;
  }
  await mkdir(localDir(), { recursive: true });
  await writeFile(path.join(localDir(), `${doc.id}.json`), body, "utf8");
}

export async function getTailored(id: string): Promise<TailoredDoc | null> {
  if (!ID_RE.test(id)) return null;
  if (backend() === "blob") {
    const res = await get(`${PREFIX}${id}.json`, { access: "private", token: token() });
    if (!res || res.statusCode !== 200) return null;
    return JSON.parse(await new Response(res.stream).text()) as TailoredDoc;
  }
  try {
    return JSON.parse(await readFile(path.join(localDir(), `${id}.json`), "utf8")) as TailoredDoc;
  } catch {
    return null;
  }
}

export async function deleteTailored(id: string): Promise<void> {
  if (!ID_RE.test(id)) return;
  if (backend() === "blob") {
    await del(`${PREFIX}${id}.json`, { token: token() });
    return;
  }
  await rm(path.join(localDir(), `${id}.json`), { force: true });
}

/** 최근 맞춤본 목록 (최신순) */
export async function listTailored(limit = 20): Promise<TailoredSummary[]> {
  let ids: string[];
  try {
    if (backend() === "blob") {
      const res = await list({ prefix: PREFIX, token: token(), limit: 100 });
      ids = res.blobs.map((b) => b.pathname.slice(PREFIX.length).replace(/\.json$/, ""));
    } else {
      ids = (await readdir(localDir()).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
    }
  } catch {
    return [];
  }
  const recent = ids.filter((id) => ID_RE.test(id)).sort().reverse().slice(0, limit);
  const docs = await Promise.all(recent.map((id) => getTailored(id).catch(() => null)));
  return docs
    .filter((d): d is TailoredDoc => d !== null)
    .map((d) => ({ id: d.id, createdAt: d.createdAt, company: d.job.company, position: d.job.position }));
}
