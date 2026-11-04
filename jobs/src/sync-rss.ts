/**
 * velog RSS 동기화 (매일)
 * - Posts 와 URL/제목으로 매칭 → 발행됨 + URL 기록
 * - DB 에 없는 글(velog 에서 직접 쓴 글)은 발행됨으로 추가
 */
import { fetchVelogFeed, normalizeTitle } from "@careersync/core/velog";
import { isDryRun, makeRepo, required, revalidateWeb, run } from "./env";

run(async () => {
  const repo = makeRepo();
  const feed = await fetchVelogFeed(required("VELOG_USERNAME"));
  const posts = await repo.listPosts();
  const byUrl = new Map(posts.filter((p) => p.velogUrl).map((p) => [decodeURI(p.velogUrl!), p]));
  const byTitle = new Map(posts.map((p) => [normalizeTitle(p.title), p]));

  let updated = 0;
  let created = 0;
  for (const item of feed) {
    const match = byUrl.get(decodeURI(item.link)) ?? byTitle.get(normalizeTitle(item.title));
    if (isDryRun()) {
      console.log(`${match ? "match" : "new"}: ${item.title}`);
      continue;
    }
    if (!match) {
      await repo.createPublishedPost({ title: item.title, url: item.link, publishedAt: item.publishedAt });
      created++;
    } else if (match.status !== "발행됨" || !match.velogUrl) {
      await repo.updatePost(match.id, { status: "발행됨", velogUrl: item.link, ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}) });
      updated++;
    }
  }
  console.log(`RSS ${feed.length}건 · 갱신 ${updated} · 신규 ${created}`);
  if (updated || created) await revalidateWeb(["posts"]);
});
