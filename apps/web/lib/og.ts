import "server-only";

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$)/i;

/** 공개 링크의 OG 메타데이터 (제목/썸네일). 실패하면 null 값으로 돌려준다 */
export async function fetchOg(rawUrl: string): Promise<{ url: string; title: string | null; image: string | null }> {
  const url = new URL(rawUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error("http(s) 링크만 첨부할 수 있어요");
  if (PRIVATE_HOST.test(url.hostname) || /\.(internal|corp|local|intra)$/i.test(url.hostname)) {
    throw new Error("사내/내부 주소는 첨부할 수 없어요");
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "careersync-og/1.0", Accept: "text/html" },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    const html = (await res.text()).slice(0, 200_000);
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1] ??
      null;
    const title = meta("og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
    const image = meta("og:image");
    return { url: url.toString(), title, image: image ? new URL(image, url).toString() : null };
  } catch {
    return { url: url.toString(), title: null, image: null };
  }
}
