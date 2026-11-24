import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, CardTitle, Field, PageHeader, formatDateTime } from "@/components/ui";
import { aiUsageSummary } from "@/lib/ai";
import { getUserContext } from "@/lib/context";
import { recentJobRuns } from "@/lib/db/store";
import { JOB_LABEL } from "@/lib/jobs";
import { deleteAccountAction, disconnectNotionAction, runJobNowAction, saveSettingsAction } from "./actions";

// "지금 실행"(AI 호출)이 이 페이지에서 돈다
export const maxDuration = 300;

const STATUS_TONE = { ok: "good", skipped: "neutral", error: "bad" } as const;

export default async function SettingsPage() {
  const ctx = await getUserContext();
  const s = ctx.settings;
  const envMode = ctx.mode === "env";
  const [usage, runs] = await Promise.all([aiUsageSummary(ctx), envMode ? Promise.resolve([]) : recentJobRuns(ctx.userId, 8)]);
  const conn = ctx.connection;

  return (
    <>
      <PageHeader title="설정" description={envMode ? "로컬 env 모드예요. 설정은 .env 로 관리돼요." : `${ctx.login} 계정`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>내 정보 · 자동화</CardTitle>
          <ActionForm action={saveSettingsAction} showOk preserve className="space-y-4">
            <fieldset disabled={envMode} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="이력서 이름">
                  <input name="resumeName" defaultValue={s.resumeName} placeholder="홍길동" />
                </Field>
                <Field label="한 줄 소개">
                  <input name="resumeHeadline" defaultValue={s.resumeHeadline} placeholder="결제 도메인 백엔드 개발자" />
                </Field>
              </div>
              <Field label="금지어 (마스킹)" hint="원래단어=치환어 를 쉼표나 줄바꿈으로 구분. AI·블로그·이력서로 나가기 전에 바뀌어요. 암호화해서 저장해요.">
                <textarea name="denylist" defaultValue={s.denylist} rows={3} placeholder={"회사명=A사\n고객사명=B사"} className="font-mono text-xs" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="velog 아이디" hint="발행한 글을 매일 자동 기록">
                  <input name="velogUsername" defaultValue={s.velogUsername} placeholder="my_id" />
                </Field>
                <Field label="포스팅 주기 (일)">
                  <input name="postIntervalDays" type="number" min={3} max={90} defaultValue={s.postIntervalDays} />
                </Field>
                <Field label="초안 미리 만들기 (일 전)">
                  <input name="postLeadDays" type="number" min={0} max={14} defaultValue={s.postLeadDays} />
                </Field>
              </div>
              <Field label="알림 웹훅 (선택)" hint="Slack Incoming Webhook 또는 Discord Webhook URL. 주간 정리·초안 알림을 받아요.">
                <input name="notifyWebhookUrl" type="url" defaultValue={s.notifyWebhookUrl} placeholder="https://hooks.slack.com/services/…" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="autoDigest" defaultChecked={s.autoDigest} />
                매주 금요일 18시에 Work Log 자동 정리
              </label>
              <Button>저장</Button>
            </fieldset>
          </ActionForm>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>AI 사용량 (이번 달)</CardTitle>
            <p className="text-2xl font-bold tabular-nums">
              {usage.used}
              <span className="text-base font-normal text-muted"> / {usage.limit ?? "무제한"}회</span>
            </p>
            {usage.limit !== null && (
              <div className="mt-2 h-1.5 rounded-full bg-surface-2">
                <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.min(100, (usage.used / Math.max(1, usage.limit)) * 100)}%` }} />
              </div>
            )}
            <p className="mt-2 text-xs text-muted">주간 정리 · 블로그 초안 · 공고 맞춤 이력서가 1회씩 써요. 매달 1일 초기화.</p>
          </Card>

          <Card>
            <CardTitle>Notion</CardTitle>
            {envMode ? (
              <p className="text-sm text-muted">.env 의 NOTION_TOKEN 으로 연결돼 있어요.</p>
            ) : conn ? (
              <div className="space-y-3 text-sm">
                <p>
                  <b>{conn.workspaceName ?? "워크스페이스"}</b>
                  {conn.parentPageId && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={`https://www.notion.so/${conn.parentPageId.replace(/-/g, "")}`} target="_blank" rel="noreferrer" className="text-accent">
                        CareerSync 페이지
                      </a>
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href="/api/notion/connect" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
                    다시 연결
                  </a>
                  <ActionForm action={disconnectNotionAction}>
                    <Button variant="danger">연결 해제</Button>
                  </ActionForm>
                </div>
                <p className="text-xs text-muted">연결을 해제해도 Notion 에 있는 기록·이력서는 그대로 남아요.</p>
              </div>
            ) : (
              <a href="/onboarding" className="text-sm text-accent">
                Notion 연결하기
              </a>
            )}
          </Card>
        </div>
      </div>

      {!envMode && (
        <Card className="mt-4">
          <CardTitle>자동 작업</CardTitle>
          <div className="flex flex-wrap gap-2">
            {(["weekly-digest", "draft-posts", "sync-rss"] as const).map((job) => (
              <ActionForm key={job} action={runJobNowAction} showOk>
                <input type="hidden" name="job" value={job} />
                <Button variant="secondary">{JOB_LABEL[job]} 지금 실행</Button>
              </ActionForm>
            ))}
          </div>
          {runs.length > 0 && (
            <ul className="mt-4 divide-y divide-line text-sm">
              {runs.map((r) => (
                <li key={`${r.job}-${r.started_at.toISOString()}`} className="flex items-start justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-start gap-2">
                    <Badge tone={STATUS_TONE[r.status]}>{r.status === "ok" ? "완료" : r.status === "error" ? "실패" : "건너뜀"}</Badge>
                    <span className="min-w-0">
                      {JOB_LABEL[r.job]} <span className="text-muted">· {r.message}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{formatDateTime(r.started_at.toISOString())}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {!envMode && (
        <Card className="mt-4 border-bad/40">
          <CardTitle>계정 삭제</CardTitle>
          <p className="text-sm text-muted">
            CareerSync 계정·설정·업로드한 캡처·이력서 스냅샷·맞춤 이력서가 모두 삭제되고 Notion 연결이 해제돼요. 내 Notion 에 있는 기록은 남아요. 되돌릴 수 없어요.
          </p>
          <ActionForm action={deleteAccountAction} className="mt-3 flex flex-wrap items-end gap-2">
            <Field label={`확인: GitHub 아이디(${ctx.login}) 입력`}>
              <input name="confirm" autoComplete="off" />
            </Field>
            <Button variant="danger">계정 삭제</Button>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
