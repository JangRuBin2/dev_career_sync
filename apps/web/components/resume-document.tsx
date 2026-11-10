import { markdownToHtml } from "@careersync/core/publish";

/**
 * 이력서 Markdown 을 문서 형태로 렌더 (화면 미리보기 + 인쇄/PDF 공용).
 * print=true 인 문서 하나만 "PDF 저장" 때 출력된다.
 * 입력은 우리가 렌더한 Markdown(마스킹된 Notion 데이터)이라 HTML 로 그대로 넣는다.
 */
export function ResumeDocument({ markdown, print = false }: { markdown: string; print?: boolean }) {
  return <article className={`resume-doc${print ? " print-area" : ""}`} dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }} />;
}
