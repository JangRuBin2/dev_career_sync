import type { Post } from "../notion/types";
import type { PostMode } from "../notion/schema";

export type PublishDecision =
  | { action: "skip"; reason: string }
  | { action: "publish"; mode: PostMode; downgraded: boolean; edit: boolean; reason: string };

/**
 * 예약 발행 정책.
 * - 예약 시각이 지나지 않았으면 skip
 * - 검토완료 체크가 없으면 지정 모드와 상관없이 "임시저장" 으로 강등 (공개 금지)
 * - 이미 임시저장된 글이 나중에 검토완료 + 공개/비공개로 바뀌면 기존 글을 수정(edit)
 */
export function decidePublish(post: Post, now: Date): PublishDecision {
  if (!post.scheduledAt) return { action: "skip", reason: "예약일시 없음" };
  if (new Date(post.scheduledAt).getTime() > now.getTime()) return { action: "skip", reason: "예약 시각 전" };

  const wanted: PostMode = post.mode ?? "임시저장";

  if (post.status === "발행됨") return { action: "skip", reason: "이미 발행됨" };
  if (post.status === "소재" || post.status === "초안") return { action: "skip", reason: "초안이 아직 검토 단계에 오지 않음" };

  if (post.status === "임시저장됨") {
    if (post.reviewed && wanted !== "임시저장" && post.velogId) {
      return { action: "publish", mode: wanted, downgraded: false, edit: true, reason: "임시저장 글을 검토 후 전환" };
    }
    return { action: "skip", reason: "이미 임시저장됨" };
  }

  // 검토대기 · 검토완료 · 실패(재시도)
  if (!post.reviewed) {
    return { action: "publish", mode: "임시저장", downgraded: wanted !== "임시저장", edit: Boolean(post.velogId), reason: "검토 미완료 → 임시저장만" };
  }
  return { action: "publish", mode: wanted, downgraded: false, edit: Boolean(post.velogId), reason: "검토 완료" };
}

/** 본문 이미지 중 공개 저장소가 아닌 것을 찾는다 (비공개 캡처 유출 방지) */
export function findNonPublicImages(markdown: string, allowedHosts: string[]): string[] {
  const urls = [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g), ...markdown.matchAll(/<img[^>]+src=["']([^"']+)["']/g)].map((m) => m[1] ?? "");
  return urls.filter((u) => {
    try {
      const host = new URL(u).host;
      return !allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
      return true; // 상대경로 등은 외부에서 깨지므로 차단
    }
  });
}

/** API 실패 시 대시보드에서 복사할 수동 발행 패키지 */
export function manualPackage(post: { title: string; tags: string[] }, markdown: string): string {
  return [`# ${post.title}`, "", `태그: ${post.tags.join(", ")}`, "", "---", "", markdown].join("\n");
}
