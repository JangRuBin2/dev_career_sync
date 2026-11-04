/**
 * 예약 발행 (매시 실행)
 * 검토완료 X → 임시저장만 / 검토완료 O → 지정 모드
 * 비공개 이미지·금지어가 남아 있으면 발행 차단
 */
import { findLeaks, notify } from "@careersync/core";
import { VelogApiError, VelogClient, decidePublish, findNonPublicImages } from "@careersync/core/velog";
import { denylist, isDryRun, makeRepo, required, revalidateWeb, run } from "./env";

run(async () => {
  const repo = makeRepo();
  const rules = denylist();
  const publicHosts = (process.env.PUBLIC_IMAGE_HOSTS ?? "public.blob.vercel-storage.com").split(",").map((s) => s.trim());
  const now = new Date();
  const candidates = await repo.listPosts({ statuses: ["검토대기", "검토완료", "실패", "임시저장됨"] });

  let client: VelogClient | null = null;
  for (const post of candidates) {
    const decision = decidePublish(post, now);
    if (decision.action === "skip") continue;
    console.log(`▶ ${post.title}: ${decision.reason} → ${decision.mode}${decision.edit ? " (수정)" : ""}`);

    const markdown = await repo.getPageMarkdown(post.id);
    const badImages = findNonPublicImages(markdown, publicHosts);
    const leaks = findLeaks(`${post.title}\n${markdown}`, rules);
    if (badImages.length || leaks.length) {
      const error = [badImages.length && `비공개/외부 이미지: ${badImages.join(", ")}`, leaks.length && `금지어: ${leaks.join(", ")}`].filter(Boolean).join(" | ");
      await repo.updatePost(post.id, { status: "실패", error });
      await notify(`⛔ "${post.title}" 발행 차단 — ${error}`);
      continue;
    }
    if (isDryRun()) continue;

    client ??= new VelogClient({ accessToken: required("VELOG_ACCESS_TOKEN"), refreshToken: process.env.VELOG_REFRESH_TOKEN });
    const input = {
      title: post.title,
      body: markdown,
      tags: post.tags,
      isTemp: decision.mode === "임시저장",
      isPrivate: decision.mode === "비공개",
    };
    try {
      const result = decision.edit ? await client.editPost(post.velogId, input) : await client.writePost(input);
      const published = decision.mode !== "임시저장";
      await repo.updatePost(post.id, {
        status: published ? "발행됨" : "임시저장됨",
        velogId: result.id,
        velogUrl: result.url,
        ...(published ? { publishedAt: now.toISOString() } : {}),
        error: decision.downgraded ? "검토완료 전이라 임시저장으로 강등됨" : "",
      });
      await notify(`${published ? "🚀 발행" : "💾 임시저장"}: "${post.title}" ${published ? result.url : "(velog 임시글함 확인)"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await repo.updatePost(post.id, { status: "실패", error: msg });
      const hint = err instanceof VelogApiError && err.kind === "auth" ? " 토큰을 갱신하거나" : "";
      await notify(`❌ "${post.title}" 발행 실패: ${msg}\n${hint} 대시보드의 '수동 발행 패키지'로 직접 올릴 수 있어요.`);
    }
  }
  await revalidateWeb(["posts"]);
});
