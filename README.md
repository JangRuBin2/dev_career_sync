# CareerSync

회사에서 일하며 남긴 기록을 **성과 데이터 → 이력서 / 포트폴리오 / 블로그 초안** 으로 이어주는 개인 커리어 관리 시스템.

- 📝 **기록은 한 번** — Notion Work Log 또는 대시보드 "빠른 기록"
- 📦 **근거 보존** — 작업 정리·핵심 성과(Records)와 수치 데이터(Metrics)를 append-only 로 저장
- 📥 **확인 후 반영** — 성과를 어느 프로젝트에 넣을지(기존/새 프로젝트) 고르고, 이력서 Before→After 미리보기 후 적용
- ✍️ **블로그 초안 자동 작성** — 주기마다 초안 작성 → 검토 → Markdown / 서식 있는 텍스트 / HTML 로 복사해 velog·티스토리·네이버 등에 **직접** 발행
- 🖼️ **캡처·링크 첨부** — 브라우저에서 모자이크 후 비공개 Blob 에 저장, 마스킹 확인 시에만 공개 승격
- 🔒 **보안 우선** — 금지어 마스킹 → LLM 검토 → 사람 승인

기획 문서: [docs/PLAN.md](docs/PLAN.md)

## 구조

```
apps/web        Next.js 16 대시보드 (Vercel 배포, Root Directory = apps/web)
packages/core   Notion 스키마·리포지토리, 마스킹, 지표, 이력서 렌더, velog, LLM
jobs            GitHub Actions 에서 도는 배치 (주간 다이제스트, 초안 작성, RSS)
.github         CI + 스케줄 워크플로
```

## 빠른 시작 (Notion 없이 화면 보기)

```bash
pnpm install
```

```bash
pnpm mock:notion
```

다른 터미널에서 (mock 이 출력한 환경변수를 사용):

```bash
cd apps/web && NOTION_BASE_URL=http://localhost:4010 NOTION_TOKEN=mock NOTION_RESUME_PAGE_ID=resume-page NOTION_DS_WORK_LOG=ds-workLog NOTION_DS_PROJECTS=ds-projects NOTION_DS_RECORDS=ds-records NOTION_DS_METRICS=ds-metrics NOTION_DS_ACHIEVEMENTS=ds-achievements NOTION_DS_POSTS=ds-posts NOTION_DS_ATTACHMENTS=ds-attachments DEV_BYPASS_AUTH=1 pnpm dev
```

http://localhost:3000/dashboard 에서 샘플 데이터로 대시보드를 볼 수 있어요. (이미지 업로드는 Blob 토큰이 있어야 동작)

## 실제 셋업

### 1. Notion
1. **개인** 워크스페이스에 빈 페이지(예: `CareerSync`)를 만든다.
2. https://www.notion.so/profile/integrations 에서 Internal integration 생성 → 토큰 복사.
3. 1번 페이지 `···` → 연결(Connections) → 방금 만든 통합 추가.
4. `.env` 에 `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID` 입력 후:
   ```bash
   pnpm setup:notion
   ```
   DB 7개 + relation + 개선율 수식 + 이력서 페이지가 생성되고, `NOTION_DS_*` / `NOTION_RESUME_PAGE_ID` 값이 출력된다.
5. 출력된 값을 `.env` 에 넣고 점검:
   ```bash
   pnpm verify:notion --write
   ```
   DB 접근, 속성·relation·역방향 속성·수식, 이력서 페이지, 쓰기/조회를 확인한다 (테스트 행은 휴지통으로 이동).

### 2. Vercel
1. 이 레포를 Import, **Root Directory = `apps/web`**.
2. Storage → Blob 에서 store 2개 생성: `careersync-private` (**Private**), `careersync-public` (Public).
   각 store 의 read-write 토큰을 `BLOB_PRIVATE_READ_WRITE_TOKEN`, `BLOB_PUBLIC_READ_WRITE_TOKEN` 으로 등록.
3. GitHub OAuth App 생성 (Callback: `https://<app>.vercel.app/api/auth/callback`) → `GITHUB_CLIENT_ID/SECRET`.
4. 나머지 환경변수는 [.env.example](.env.example) 참고 (`ALLOWED_GITHUB_ID`, `SESSION_SECRET`, `NOTION_*`, `REVALIDATE_SECRET`, `DENYLIST` …).

### 3. GitHub Actions (개인 레포)
Settings → Secrets and variables → Actions

| 종류 | 이름 |
|---|---|
| Secrets | `NOTION_TOKEN`, `NOTION_DS_*`(7개), `NOTION_RESUME_PAGE_ID`, `ANTHROPIC_API_KEY`, `DENYLIST`, `REVALIDATE_SECRET`, `NOTIFY_WEBHOOK_URL` |
| Variables | `WEB_URL`, `VELOG_USERNAME`, (선택) `POST_INTERVAL_DAYS`, `POST_LEAD_DAYS`, `PUBLIC_IMAGE_HOSTS` |

| 워크플로 | 일정 (KST) | 하는 일 |
|---|---|---|
| `weekly-digest` | 금 18:00 | 미처리 Work Log → 마스킹 → Claude 정리 → Records/Metrics(초안), 성과 후보(추천됨), 글감 |
| `draft-posts` | 매일 10:17 | 포스팅 주기가 됐으면 가장 오래된 글감으로 초안 작성 → 목표일 설정 → 알림 |
| `publish` | ⏸ 비활성화 | velog 자동 발행(비공식 API). 코드는 보존, 수동 실행 + `AUTO_PUBLISH=1` 일 때만 동작 |
| `sync-rss` | 매일 23:41 | velog RSS 로 발행 URL 기록, 직접 쓴 글도 Posts 에 추가 |

모든 배치는 `workflow_dispatch` 로 수동 실행 가능하고, 로컬에서는 `--dry-run` 으로 Notion 에 쓰지 않고 결과만 볼 수 있어요.

```bash
pnpm job:weekly -- --dry-run
```

## 이력서 업데이트 흐름

```
주간 배치 → 성과 후보 (추천 프로젝트 + 신뢰도)
  → 📥 Inbox: 추천 프로젝트 / 다른 기존 프로젝트 / 새 프로젝트 / 보류 / 반려
  → 미리보기 (이력서 섹션 Before → After diff)
  → 적용: 성과·근거 기록 확정 + Notion 이력서 페이지 재렌더 + 스냅샷(비공개 Blob)
```

## 블로그 발행 방식
글 **작성**까지만 자동화하고 **발행은 직접** 해요 (블로그마다 API 를 연동하지 않기 위해).

1. 대시보드 → 포스팅 → `검토 · 복사`
2. 본문을 다듬고, 복사 전 점검(금지어 · 비공개 이미지 · TODO) 확인
3. 올릴 곳에 맞게 복사
   - **Markdown** → velog · Hashnode · GitHub
   - **서식 있는 텍스트** → 티스토리 · 네이버 블로그 편집기에 그대로 붙여넣기
   - **HTML 소스** → 티스토리 HTML 모드 · 워드프레스
   - **Markdown + front matter** → dev.to · 정적 블로그
4. 발행 후 `발행 완료 기록` (velog 는 RSS 로 매일 자동 기록)

> velog 비공식 GraphQL 자동 발행 코드는 삭제하지 않고 꺼 두었어요. 다시 쓰려면 `publish.yml` 의 schedule 주석을 풀고
> Variables `AUTO_PUBLISH=1`, Secrets `VELOG_ACCESS_TOKEN` / `VELOG_REFRESH_TOKEN` 을 등록하세요 (비공식이라 언제든 깨질 수 있음).

## 보안 체크리스트
- 회사 기기·계정·네트워크와 분리된 **개인** Notion / GitHub / Vercel 만 사용
- `DENYLIST` 는 Secrets 로만 관리 (레포 커밋 금지)
- 캡처는 기본 비공개, 공개 전환은 "마스킹 확인" 체크 필수
- 외부로 나가는 것(블로그 발행, 이력서)은 모두 사람이 직접 / 확인 후

## 개발

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm build
```
