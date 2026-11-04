import { describe, expect, it } from "vitest";
import { decidePublish, findNonPublicImages, parseVelogRss, slugify } from "../src/velog";
import { post } from "./fixtures";

const now = new Date("2026-11-04T00:00:00Z");

describe("decidePublish", () => {
  it("예약 시각 전이면 skip", () => {
    expect(decidePublish(post({ scheduledAt: "2026-12-01T00:00:00Z" }), now).action).toBe("skip");
  });
  it("검토 미완료면 공개 요청이어도 임시저장으로 강등", () => {
    const d = decidePublish(post({ reviewed: false, mode: "공개" }), now);
    expect(d).toMatchObject({ action: "publish", mode: "임시저장", downgraded: true });
  });
  it("검토 완료면 지정 모드로 발행", () => {
    expect(decidePublish(post({ reviewed: true, mode: "비공개", status: "검토완료" }), now)).toMatchObject({ action: "publish", mode: "비공개", downgraded: false, edit: false });
  });
  it("임시저장된 글이 검토 완료되면 기존 글 수정으로 공개 전환", () => {
    const d = decidePublish(post({ status: "임시저장됨", reviewed: true, mode: "공개", velogId: "v1" }), now);
    expect(d).toMatchObject({ action: "publish", mode: "공개", edit: true });
  });
  it("발행됨/소재는 skip", () => {
    expect(decidePublish(post({ status: "발행됨" }), now).action).toBe("skip");
    expect(decidePublish(post({ status: "소재" }), now).action).toBe("skip");
  });
});

describe("findNonPublicImages", () => {
  it("공개 저장소 외 이미지·상대경로를 찾는다", () => {
    const md = "![a](https://abc.public.blob.vercel-storage.com/x.png)\n![b](https://abc.private.blob.vercel-storage.com/y.png)\n![c](./local.png)";
    expect(findNonPublicImages(md, ["public.blob.vercel-storage.com"])).toEqual([
      "https://abc.private.blob.vercel-storage.com/y.png",
      "./local.png",
    ]);
  });
});

describe("parseVelogRss", () => {
  it("item 을 파싱한다 (단일/복수)", () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>t</title>
      <item><title>첫 글</title><link>https://velog.io/@me/first</link><guid>g1</guid><pubDate>Mon, 02 Nov 2026 01:00:00 GMT</pubDate></item>
      <item><title>둘째 글</title><link>https://velog.io/@me/second</link><guid>g2</guid></item>
    </channel></rss>`;
    const items = parseVelogRss(xml);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "첫 글", guid: "g1", publishedAt: "2026-11-02T01:00:00.000Z" });
    expect(items[1]?.publishedAt).toBeNull();
  });
});

describe("slugify", () => {
  it("한글 유지, 특수문자 제거", () => expect(slugify("N+1 쿼리, 이렇게 잡았다!")).toBe("n1-쿼리-이렇게-잡았다"));
});
