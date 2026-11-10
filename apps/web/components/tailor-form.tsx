"use client";

import { useMemo, useState } from "react";
import { buildTailorPrompt, matchJobKeywords, type TailorMaterial } from "@careersync/core/tailor";
import type { ActionState } from "@/lib/action-state";
import { ActionForm } from "./action-form";
import { CopyButton } from "./copy-button";
import { Badge, Button, Card, CardTitle, Field } from "./ui";

/**
 * 공고 입력 폼.
 * 입력하는 동안 (AI 없이) 공고 ↔ 내 기술 키워드 매칭을 바로 보여주고,
 * - "AI 로 맞춤 이력서 만들기" → 서버에서 Claude 호출 후 회사별 버전 저장
 * - "프롬프트 복사" → resume-ai-toolkit Step 3 처럼 Claude.ai / ChatGPT 에 직접 붙여넣기
 */
export function TailorForm({
  material,
  originResume,
  action,
}: {
  material: TailorMaterial;
  originResume: string;
  action: (fd: FormData) => Promise<ActionState>;
}) {
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [jd, setJd] = useState("");
  const [focus, setFocus] = useState("");

  const match = useMemo(() => (jd.trim() ? matchJobKeywords(jd, material) : null), [jd, material]);
  const prompt = useMemo(
    () => buildTailorPrompt({ job: { company, position, text: jd, focus }, material, originResume }),
    [company, position, jd, focus, material, originResume],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardTitle>채용공고</CardTitle>
        <ActionForm action={action} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="회사">
              <input name="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="예: 토스" />
            </Field>
            <Field label="포지션">
              <input name="position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="예: Server Developer" />
            </Field>
          </div>
          <Field label="공고 전문" hint="주요업무 · 자격요건 · 우대사항을 그대로 붙여넣으세요.">
            <textarea name="jd" value={jd} onChange={(e) => setJd(e.target.value)} rows={14} required />
          </Field>
          <Field label="강조하고 싶은 포인트 (선택)">
            <input name="focus" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="예: 대용량 트래픽 경험, 성능 개선 수치" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button>AI 로 맞춤 이력서 만들기</Button>
            <CopyButton text={prompt} label="프롬프트 복사 (AI 직접 사용)" />
          </div>
          <p className="text-xs text-muted">
            AI 생성은 1~2분 걸려요. 근거에 없는 숫자·기술은 자동으로 걸러지고, 원본 이력서는 바뀌지 않아요.
          </p>
        </ActionForm>
      </Card>

      <Card>
        <CardTitle>공고 ↔ 내 기록 (AI 없이)</CardTitle>
        {!match ? (
          <p className="text-sm text-muted">공고를 붙여넣으면 겹치는 기술과 관련 프로젝트를 바로 보여줘요.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="mb-1.5 text-xs font-semibold text-muted">겹치는 기술 ({match.matched.length})</h3>
              <div className="flex flex-wrap gap-1">
                {match.matched.length ? match.matched.map((s) => <Badge key={s} tone="good">{s}</Badge>) : <span className="text-muted">없음</span>}
              </div>
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-semibold text-muted">공고에만 있는 키워드 ({match.missing.length})</h3>
              <div className="flex flex-wrap gap-1">
                {match.missing.length ? match.missing.slice(0, 24).map((s) => <Badge key={s} tone="warn">{s}</Badge>) : <span className="text-muted">없음</span>}
              </div>
              <p className="mt-1 text-xs text-muted">영문 단어 기준 추정이에요. 실제 부족 항목은 AI 분석에서 요건별로 확인하세요.</p>
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-semibold text-muted">관련 프로젝트</h3>
              <ul className="space-y-1">
                {match.projects.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-xs text-muted">{p.score ? `${p.score}개 겹침` : "-"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          근거 {material.sources.length}개 · 프로젝트 {material.projects.length}개 · 기술 {material.skills.length}개 (DENYLIST 마스킹 적용)
        </p>
      </Card>
    </div>
  );
}
