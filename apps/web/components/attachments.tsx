import { ActionForm } from "@/components/action-form";
import type { Attachment } from "@careersync/core/notion";
import { addLinkAction, demoteAttachmentAction, promoteAttachmentAction, setCoverImageAction } from "@/app/dashboard/actions";
import { Badge, Button, Empty, Field, attachmentSrc } from "./ui";

export function AttachmentGallery({ items, projectId }: { items: Attachment[]; projectId?: string }) {
  const images = items.filter((a) => a.kind === "이미지");
  const links = items.filter((a) => a.kind === "링크");
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-xs font-semibold text-muted">캡처 이미지 ({images.length})</h3>
        {images.length === 0 ? (
          <Empty>캡처가 없어요.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {images.map((a) => (
              <figure key={a.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                <a href={attachmentSrc(a)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachmentSrc(a)} alt={a.caption || a.name} className="aspect-video w-full object-cover" loading="lazy" />
                </a>
                <figcaption className="space-y-2 p-2 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{a.caption || a.name}</span>
                    <Badge tone={a.visibility === "공개가능" ? "accent" : "neutral"}>{a.visibility ?? "비공개"}</Badge>
                  </div>
                  {a.visibility === "공개가능" ? (
                    <div className="flex flex-wrap gap-1">
                      <ActionForm action={demoteAttachmentAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <Button variant="secondary">비공개로</Button>
                      </ActionForm>
                      {projectId && a.publicUrl && (
                        <ActionForm action={setCoverImageAction}>
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="url" value={a.publicUrl} />
                          <Button variant="secondary">대표 이미지</Button>
                        </ActionForm>
                      )}
                      {a.publicUrl && <code className="block w-full truncate text-[10px] text-muted">{`![${a.caption || "image"}](${a.publicUrl})`}</code>}
                    </div>
                  ) : (
                    <ActionForm action={promoteAttachmentAction} className="space-y-1">
                      <input type="hidden" name="id" value={a.id} />
                      <label className="flex items-center gap-1">
                        <input type="checkbox" name="maskChecked" required /> 민감정보 마스킹 확인
                      </label>
                      <Button variant="secondary">공개 가능으로 전환</Button>
                    </ActionForm>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold text-muted">링크 ({links.length})</h3>
        {links.length === 0 ? (
          <Empty>첨부된 링크가 없어요.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {links.map((l) => (
              <a key={l.id} href={l.linkUrl ?? "#"} target="_blank" rel="noreferrer" className="flex gap-3 overflow-hidden rounded-lg border border-line bg-surface hover:border-accent">
                {l.ogImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.ogImage} alt="" className="h-20 w-28 shrink-0 object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-20 w-28 shrink-0 items-center justify-center bg-surface-2">🔗</div>
                )}
                <div className="min-w-0 py-2 pr-3">
                  <div className="truncate text-sm font-medium">{l.name}</div>
                  <div className="truncate text-xs text-muted">{l.linkUrl}</div>
                  {l.caption && <div className="mt-1 line-clamp-2 text-xs">{l.caption}</div>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LinkForm({ projectId, recordId }: { projectId?: string; recordId?: string }) {
  return (
    <ActionForm action={addLinkAction} showOk className="space-y-2">
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {recordId && <input type="hidden" name="recordId" value={recordId} />}
      <Field label="링크 URL" hint="공개 사이트·발표자료·기사 등. 사내 주소는 차단돼요.">
        <input name="url" type="url" required placeholder="https://" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="이름 (비우면 페이지 제목)">
          <input name="name" />
        </Field>
        <Field label="설명">
          <input name="caption" />
        </Field>
      </div>
      <Button variant="secondary">링크 첨부</Button>
    </ActionForm>
  );
}
