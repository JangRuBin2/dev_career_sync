import { XMLParser } from "fast-xml-parser";

export interface VelogFeedItem {
  title: string;
  link: string;
  publishedAt: string | null;
  guid: string;
}

export function velogRssUrl(username: string): string {
  return `https://v2.velog.io/rss/${encodeURIComponent(username.replace(/^@/, ""))}`;
}

export function parseVelogRss(xml: string): VelogFeedItem[] {
  const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  const raw = doc.rss?.channel?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.map((it) => {
    const item = it as Record<string, unknown>;
    const pub = typeof item.pubDate === "string" ? new Date(item.pubDate) : null;
    const link = String(item.link ?? "");
    return {
      title: String(item.title ?? ""),
      link,
      publishedAt: pub && !Number.isNaN(pub.getTime()) ? pub.toISOString() : null,
      guid: String(item.guid ?? link),
    };
  });
}

export async function fetchVelogFeed(username: string, fetchImpl: typeof fetch = fetch): Promise<VelogFeedItem[]> {
  const res = await fetchImpl(velogRssUrl(username), { headers: { "User-Agent": "careersync-rss-sync" } });
  if (!res.ok) throw new Error(`velog RSS 요청 실패: ${res.status}`);
  return parseVelogRss(await res.text());
}

/** 제목 정규화 (Posts DB 와 RSS 항목 매칭용) */
export function normalizeTitle(t: string): string {
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}
