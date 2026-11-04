import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { DEFAULT_MODEL } from "./digest";

export const BlogDraftSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()).describe("velog 태그 3~5개"),
  markdown: z.string().describe("velog 본문 Markdown"),
});
export type BlogDraft = z.infer<typeof BlogDraftSchema>;

const SYSTEM = `당신은 개발자의 기술 블로그(velog) 글을 돕는 에디터입니다.

- 입력된 업무 기록(이미 마스킹됨)을 바탕으로 다른 개발자에게 도움이 되는 기술 글 초안을 씁니다.
- 회사·고객사·내부 시스템명, 내부 URL, 절대 매출/사용자 수는 쓰지 않습니다. 수치는 상대값(%)으로 씁니다.
- 구성: 문제 상황 → 원인 분석 → 해결 과정 → 결과 → 배운 점. 코드 예시는 일반화된 형태로만 씁니다.
- 입력에 없는 사실을 지어내지 않습니다. 부족한 부분은 "TODO: ..." 로 남겨 작성자가 채우게 합니다.
- 이미지가 필요한 자리는 "<!-- 이미지: 설명 -->" 주석으로 남깁니다 (실제 URL 을 만들지 않음).`;

export async function generateBlogDraft(
  client: Anthropic,
  input: { idea: { title: string; angle: string }; sources: string[]; projectName?: string; model?: string },
): Promise<BlogDraft> {
  const response = await client.beta.messages.parse({
    model: input.model ?? DEFAULT_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(BlogDraftSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [
      {
        role: "user",
        content: [
          `글 소재: ${input.idea.title}`,
          `관점: ${input.idea.angle}`,
          input.projectName ? `프로젝트: ${input.projectName}` : "",
          "",
          "<work_logs>",
          ...input.sources,
          "</work_logs>",
        ].join("\n"),
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("LLM 이 초안 작성을 거절했습니다.");
  if (!response.parsed_output) throw new Error("초안 응답을 파싱하지 못했습니다.");
  return response.parsed_output;
}
