import { describe, expect, it } from "vitest";
import { buildExport, findNonPublicImages, markdownToHtml, prePublishCheck } from "../src/publish";
import { parseDenylist } from "../src/sanitize";

describe("buildExport", () => {
  const md = "## 문제\n느렸다\n\n<!-- 이미지: 실행 계획 -->\n- 인덱스 추가\n\n```sql\nSELECT 1;\n```\n";
  const out = buildExport({ title: 'N+1 "쿼리"', tags: ["db", "성능"] }, md);

  it("작성자 메모 주석을 제거한다", () => {
    expect(out.markdown).not.toContain("<!--");
    expect(out.html).not.toContain("<!--");
  });
  it("HTML 로 변환한다 (제목·목록·코드블록)", () => {
    expect(out.html).toContain("<h2>문제</h2>");
    expect(out.html).toContain("<li>인덱스 추가</li>");
    expect(out.html).toContain('<code class="language-sql">');
  });
  it("front matter 는 따옴표를 이스케이프하고 published: false", () => {
    expect(out.markdownWithFrontMatter).toContain('title: "N+1 \\"쿼리\\""');
    expect(out.markdownWithFrontMatter).toContain('tags: ["db", "성능"]');
    expect(out.markdownWithFrontMatter).toContain("published: false");
  });
  it("태그는 쉼표로", () => expect(out.tags).toBe("db, 성능"));
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

describe("prePublishCheck", () => {
  const rules = parseDenylist("ACME=A사");
  const hosts = ["public.blob.vercel-storage.com"];
  it("금지어 · TODO 를 잡는다", () => {
    const r = prePublishCheck({ title: "ACME 회고" }, "본문\nTODO: 그래프 캡처", rules, hosts);
    expect(r.ok).toBe(false);
    expect(r.leaks).toContain("ACME");
    expect(r.todos).toEqual(["그래프 캡처"]);
  });
  it("문제 없으면 ok", () => {
    expect(prePublishCheck({ title: "회고" }, "본문", rules, hosts).ok).toBe(true);
  });
  it("markdownToHtml 단독 사용", () => expect(markdownToHtml("**굵게**")).toContain("<strong>굵게</strong>"));
});
