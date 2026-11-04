"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";

/**
 * Server Action 결과({ ok } | { error })를 폼 아래에 보여주는 폼.
 * 프로덕션에서는 throw 된 에러 메시지가 클라이언트에 숨겨지므로, 사용자 오류는 값으로 돌려받는다.
 */
export function ActionForm({
  action,
  children,
  className,
  showOk = false,
}: {
  action: (fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  showOk?: boolean;
}) {
  const [state, formAction, pending] = useActionState(async (_prev: ActionState, fd: FormData) => action(fd), null);
  return (
    <form action={formAction} className={className} aria-busy={pending}>
      {children}
      {pending && <p className="mt-2 text-xs text-muted">처리 중…</p>}
      {!pending && state?.error && <p className="mt-2 rounded-md bg-bad-soft px-2 py-1 text-xs text-bad">{state.error}</p>}
      {!pending && showOk && state?.ok && <p className="mt-2 text-xs text-good">✓ {state.ok}</p>}
    </form>
  );
}
