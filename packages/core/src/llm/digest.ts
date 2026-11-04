import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { OPT } from "../notion/schema";
import type { Project, WorkLog } from "../notion/types";
import { numbersAppearIn } from "../metrics";

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

// ---------- 출력 스키마 ----------

const MetricSchema = z.object({
  name: z.string().describe("지표 이름. 예: API p95 응답시간"),
  category: z.enum(OPT.metricCategory),
  before: z.number(),
  after: z.number(),
  unit: z.enum(OPT.unit),
  direction: z.enum(OPT.direction),
  method: z.string().describe("원문에 근거한 측정 방법. 원문에 없으면 '원문에 측정 방법 없음 — 확인 필요'"),
  confidence: z.enum(OPT.confidence),
  sourceQuote: z.string().describe("숫자가 나온 원문 구절을 그대로 인용"),
});

const ProjectMatchSchema = z.object({
  projectId: z.string().nullable().describe("기존 프로젝트에 속하면 그 ID, 아니면 null"),
  newProjectName: z.string().nullable().describe("기존 프로젝트와 맞지 않을 때 제안할 새 프로젝트 이름"),
  confidence: z.number().describe("0~1"),
  reason: z.string(),
});

const RecordDraftSchema = z.object({
  title: z.string().describe("짧은 제목. 예: 결제 API 응답속도 개선"),
  summary: z.string().describe("작업 내용 정리 (3~6문장)"),
  highlights: z.array(z.string()).describe("핵심 성과 최대 3개"),
  role: z.string().describe("내 역할/기여 범위"),
  tech: z.array(z.string()),
  logIds: z.array(z.string()).describe("이 기록이 근거로 삼는 Work Log ID 들"),
  projectMatch: ProjectMatchSchema,
  metrics: z.array(MetricSchema),
  achievements: z.array(z.string()).describe("이력서 bullet 후보. '무엇을 해서 → 어떤 결과' 형식, 1문장"),
});

const BlogIdeaSchema = z.object({
  title: z.string(),
  angle: z.string().describe("글의 관점/핵심 메시지"),
  logIds: z.array(z.string()),
});

export const DigestSchema = z.object({
  records: z.array(RecordDraftSchema),
  blogIdeas: z.array(BlogIdeaSchema),
  securityNotes: z.array(z.string()).describe("마스킹 후에도 기밀로 보이는 표현이 있으면 지적"),
});

export type Digest = z.infer<typeof DigestSchema>;
export type RecordDraft = z.infer<typeof RecordDraftSchema>;

// ---------- 프롬프트 ----------

const SYSTEM = `당신은 개발자의 업무 기록을 이력서·포트폴리오용 성과 데이터로 정리하는 커리어 코치입니다.

원칙:
- 업무 로그에 실제로 적힌 사실만 사용합니다. 숫자를 만들거나 추정해서 채우지 않습니다.
- 지표(metrics)는 원문에 Before 와 After 숫자가 모두 있을 때만 만들고, 그 구절을 sourceQuote 로 그대로 인용합니다.
- 같은 목표의 로그들은 하나의 record 로 묶습니다. 사소한 잡무만 있는 로그는 묶지 않아도 됩니다.
- 프로젝트 매칭: 제공된 기존 프로젝트 목록에서 기간·기술·주제가 맞으면 projectId 를 쓰고, 맞는 것이 없으면 projectId=null, newProjectName 을 제안합니다. 확신이 낮으면 confidence 를 낮게 줍니다.
- 이력서 문장은 "행동 → 결과" 구조의 한 문장, 과장 없이, 회사·고객사·내부 시스템 이름 없이 씁니다.
- 블로그 소재는 트러블슈팅·성능 개선처럼 일반화해서 공유할 가치가 있는 것만 고릅니다.
- 입력은 이미 마스킹되어 있습니다. [비공개], [이메일] 같은 표시는 그대로 두고 복원하려 하지 마세요.`;

export function buildDigestPrompt(logs: WorkLog[], projects: Project[], period: { start: string; end: string }): string {
  const projectLines = projects.map((p) =>
    JSON.stringify({ id: p.id, name: p.name, period: p.period, stack: p.stack, summary: p.summary, status: p.status }),
  );
  const logLines = logs.map((l) =>
    JSON.stringify({ id: l.id, date: l.date, title: l.title, type: l.type, tags: l.tags, projectIds: l.projectIds, content: l.content }),
  );
  return [
    `기간: ${period.start} ~ ${period.end}`,
    "",
    "<projects>",
    ...projectLines,
    "</projects>",
    "",
    "<work_logs>",
    ...logLines,
    "</work_logs>",
    "",
    "위 업무 로그를 records / blogIdeas / securityNotes 로 정리하세요.",
  ].join("\n");
}

// ---------- 실행 ----------

export async function runWeeklyDigest(
  client: Anthropic,
  input: { logs: WorkLog[]; projects: Project[]; period: { start: string; end: string }; model?: string },
): Promise<Digest> {
  if (input.logs.length === 0) return { records: [], blogIdeas: [], securityNotes: [] };

  const response = await client.beta.messages.parse({
    model: input.model ?? DEFAULT_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(DigestSchema) },
    // 안전 분류기가 거절하면 서버에서 다른 모델로 자동 재시도
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: buildDigestPrompt(input.logs, input.projects, input.period) }],
  });

  if (response.stop_reason === "refusal") throw new Error("LLM 이 요청을 거절했습니다. 로그 내용을 확인하세요.");
  if (response.stop_reason === "max_tokens") throw new Error("LLM 응답이 잘렸습니다. 기간을 나눠서 실행하세요.");
  if (!response.parsed_output) throw new Error("LLM 응답을 파싱하지 못했습니다.");

  return validateDigest(response.parsed_output, input.logs, input.projects);
}

/**
 * 환각 방지 검증.
 * - 존재하지 않는 logId / projectId 제거
 * - before/after 숫자가 근거 로그 원문에 없으면 지표 제거
 */
export function validateDigest(digest: Digest, logs: WorkLog[], projects: Project[]): Digest {
  const logById = new Map(logs.map((l) => [l.id, l]));
  const projectIds = new Set(projects.map((p) => p.id));

  const records = digest.records
    .map((rec) => {
      const logIds = rec.logIds.filter((id) => logById.has(id));
      const source = logIds.map((id) => `${logById.get(id)!.title}\n${logById.get(id)!.content}`).join("\n");
      const metrics = rec.metrics.filter((mt) => numbersAppearIn(source, mt.before, mt.after));
      const match = rec.projectMatch;
      const projectId = match.projectId && projectIds.has(match.projectId) ? match.projectId : null;
      return {
        ...rec,
        logIds,
        metrics,
        highlights: rec.highlights.slice(0, 3),
        projectMatch: {
          ...match,
          projectId,
          newProjectName: projectId ? null : (match.newProjectName ?? rec.title),
          confidence: Math.max(0, Math.min(1, match.confidence)),
        },
      };
    })
    .filter((rec) => rec.logIds.length > 0);

  const blogIdeas = digest.blogIdeas
    .map((b) => ({ ...b, logIds: b.logIds.filter((id) => logById.has(id)) }))
    .filter((b) => b.logIds.length > 0);

  return { records, blogIdeas, securityNotes: digest.securityNotes };
}
