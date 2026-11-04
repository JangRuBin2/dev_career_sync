/**
 * 블로그 내보내기.
 * 플랫폼별 API 연동 없이, 글 하나(Markdown)를 각 플랫폼 편집기에 붙여넣기 좋은 형식으로 변환한다.
 *  - Markdown: velog · dev.to · Hashnode · GitHub
 *  - HTML / 서식 있는 텍스트: 티스토리 · 네이버 블로그 · 워드프레스
 */
import { Marked } from "marked";
import { findLeaks, type DenyRule } from "../sanitize";

const marked = new Marked({ gfm: true, breaks: false });

export function markdownToHtml(markdown: string): string {
  return marked.parse(stripComments(markdown), { async: false }) as string;
}

/** 초안의 작성자용 메모(<!-- 이미지: ... -->)는 내보낼 때 제거 */
export function stripComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->\n?/g, "");
}

export interface ExportBundle {
  title: string;
  tags: string;
  markdown: string;
  html: string;
  /** dev.to / 정적 블로그용 front matter 포함 Markdown */
  markdownWithFrontMatter: string;
}

export function buildExport(post: { title: string; tags: string[] }, markdown: string): ExportBundle {
  const body = stripComments(markdown).trim() + "\n";
  const frontMatter = ["---", `title: "${post.title.replace(/"/g, '\\"')}"`, `tags: [${post.tags.map((t) => `"${t}"`).join(", ")}]`, "published: false", "---", ""].join("\n");
  return {
    title: post.title,
    tags: post.tags.join(", "),
    markdown: body,
    html: markdownToHtml(body),
    markdownWithFrontMatter: `${frontMatter}\n${body}`,
  };
}

/** 본문 이미지 중 공개 저장소가 아닌 것 (비공개 캡처 유출 방지) */
export function findNonPublicImages(markdown: string, allowedHosts: string[]): string[] {
  const urls = [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g), ...markdown.matchAll(/<img[^>]+src=["']([^"']+)["']/g)].map((m) => m[1] ?? "");
  return urls.filter((u) => {
    try {
      const host = new URL(u).host;
      return !allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
      return true; // 상대경로 등은 외부에서 깨진다
    }
  });
}

export interface PrePublishCheck {
  ok: boolean;
  leaks: string[];
  nonPublicImages: string[];
  todos: string[];
}

/** 복사 전 점검: 금지어 · 비공개 이미지 · 남은 TODO */
export function prePublishCheck(post: { title: string }, markdown: string, rules: DenyRule[], publicHosts: string[]): PrePublishCheck {
  const leaks = findLeaks(`${post.title}\n${markdown}`, rules);
  const nonPublicImages = findNonPublicImages(markdown, publicHosts);
  const todos = [...markdown.matchAll(/^.*TODO:?(.*)$/gm)].map((m) => (m[1] ?? "").trim() || "TODO");
  return { ok: !leaks.length && !nonPublicImages.length && !todos.length, leaks, nonPublicImages, todos };
}
