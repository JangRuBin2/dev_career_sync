# CareerSync

회사에서 일하며 남긴 기록을 **성과 데이터 → 이력서 / 포트폴리오 / 블로그 초안** 으로 이어주는 개인 커리어 관리 시스템.

- 📝 **기록은 한 번** — Notion Work Log 또는 대시보드 "빠른 기록"
- 📦 **근거 보존** — 작업 정리·핵심 성과(Records)와 수치 데이터(Metrics)를 append-only 로 저장
- 📥 **확인 후 반영** — 성과를 어느 프로젝트에 넣을지(기존/새 프로젝트) 고르고, 이력서 Before→After 미리보기 후 적용
- 🎯 **공고 맞춤 이력서** — 채용공고를 붙여넣으면 원본은 그대로 두고 회사별 버전을 생성 (요건 매핑 · 부족 항목 · PDF). [resume-ai-toolkit](https://github.com/JangRuBin2/resume-ai-toolkit) 워크플로우와 호환
- ✍️ **블로그 초안 자동 작성** — 주기마다 초안 작성 → 검토 → Markdown / 서식 있는 텍스트 / HTML 로 복사해 velog·티스토리·네이버 등에 **직접** 발행
- 🖼️ **캡처·링크 첨부** — 브라우저에서 모자이크 후 비공개 Blob 에 저장, 마스킹 확인 시에만 공개 승격
- 🔒 **보안 우선** — 금지어 마스킹 → LLM 검토 → 사람 승인

기획 문서: [docs/PLAN.md](docs/PLAN.md)

## 구조

```
apps/web        Next.js 16 대시보드 (Vercel 배포, Root Directory = apps/web) — 가입·Notion OAuth·설정·cron, Neon Postgres
packages/core   Notion 스키마·리포지토리·셋업, 마스킹, 지표, 이력서 렌더·공고 맞춤, 배치 본체, velog, LLM
jobs            로컬 CLI 배치 (배포 환경에서는 대시보드의 Vercel Cron 이 사용자별로 실행)
.github         CI
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

> 대시보드(`pnpm dev`)도 **루트 `.env`** 를 읽어요. `DATABASE_URL` 없이 `DEV_BYPASS_AUTH=1` 이면 위처럼 .env 의 Notion 으로 1인용처럼 동작해요 (개발 모드에서만).
>
> 여러 사용자 흐름(가입 → Notion OAuth → 온보딩 → 설정)을 로컬에서 보려면 Postgres 를 띄우고 `DATABASE_URL`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `NOTION_OAUTH_CLIENT_ID=mock`, `NOTION_OAUTH_CLIENT_SECRET=mock`, `NOTION_BASE_URL=http://localhost:4010`, `DEV_BYPASS_AUTH=1` 로 실행하세요. mock 서버가 OAuth 를 바로 승인하고, 첫 토큰을 일부러 만료시켜 자동 갱신까지 확인할 수 있어요.

## 배포 (운영자 셋업)
CareerSync 는 **여러 사람이 각자 GitHub 로 가입하고, 자기 Notion 을 버튼으로 연결해서** 쓰는 서비스예요.
기록·이력서 본문은 각 사용자의 Notion 에 저장되고, 서버(Neon)에는 계정·연결 토큰(암호화)·설정·사용량만 저장해요.

### 1. Vercel 프로젝트
1. 이 레포를 Import, **Root Directory = `apps/web`**.
2. **Storage → Neon (Postgres)** 연결 → `DATABASE_URL` 자동 등록. 표는 첫 요청 때 자동으로 만들어져요.
3. **Storage → Blob** 에서 store 2개: `careersync-private` (**Private**), `careersync-public` (Public) → 토큰을 `BLOB_PRIVATE_READ_WRITE_TOKEN`, `BLOB_PUBLIC_READ_WRITE_TOKEN` 으로.
4. Fluid compute 켜기 (새 프로젝트는 기본). AI 생성·Notion 셋업 페이지는 최대 300초를 써요.

### 2. GitHub OAuth App (로그인)
Callback URL `https://<앱>.vercel.app/api/auth/callback` → `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.

### 3. Notion 공개 통합 (사용자별 "Notion 연결")
https://www.notion.so/profile/integrations → **Public** integration 생성
- Redirect URI: `https://<앱>.vercel.app/api/notion/callback`
- 개인정보처리방침 `…/privacy`, 이용약관 `…/terms`, 회사·웹사이트 정보 입력
- 권한: 콘텐츠 읽기·수정·삽입
- 발급된 OAuth client ID / secret → `NOTION_OAUTH_CLIENT_ID`, `NOTION_OAUTH_CLIENT_SECRET`
- (선택) Webhooks 탭에서 URL `…/api/notion-webhook` 구독 → 처음 오는 verification token 을 `NOTION_WEBHOOK_TOKEN` 으로 (사용자 Notion 수정이 대시보드에 바로 반영)

### 4. 나머지 환경변수
| 이름 | 설명 |
|---|---|
| `SESSION_SECRET`, `ENCRYPTION_KEY` | 32자 이상 랜덤 문자열 각각 (`openssl rand -base64 48`). **ENCRYPTION_KEY 를 바꾸면 저장된 Notion 토큰을 못 읽어요** |
| `ANTHROPIC_API_KEY` | AI 기능 (운영자 부담) |
| `AI_MONTHLY_LIMIT` | 사용자당 월 AI 호출 수 (기본 30) |
| `ADMIN_GITHUB_IDS` | 관리자 GitHub 숫자 ID (AI 무제한, 1인용 시절 캡처 열람) |
| `CRON_SECRET` | Vercel Cron 인증 (자동 작업) |
| `CONTACT_EMAIL` | (선택) 약관·방침의 문의처. 없으면 GitHub Issues |

전체 목록과 설명: [.env.example](.env.example)

### 5. 자동 작업 (Vercel Cron)
`apps/web/vercel.json` 이 매일 사용자별로 실행해요 (GitHub Actions 불필요).

| 경로 | 시각 (KST) | 하는 일 |
|---|---|---|
| `/api/cron/weekly-digest` | 매일 18:00 확인 → 사용자별 7일마다 (처음은 금요일) | 미처리 Work Log → 마스킹 → Claude 정리 → Records/Metrics(초안), 성과 후보, 글감 |
| `/api/cron/draft-posts` | 매일 10:17 | 포스팅 주기가 된 사용자만 초안 작성 → 목표일 → 알림 |
| `/api/cron/sync-rss` | 매일 23:41 | velog 아이디를 등록한 사용자의 RSS → 발행 URL 기록 |

- Notion API 한도를 지키려고 사용자를 순서대로 처리하고, 시간 안에 못 끝낸 사용자는 다음 실행에서 이어서 해요.
- 사용자는 설정 화면에서 "지금 실행" 할 수 있어요 (AI 한도는 그대로 적용).
- AI 한도를 다 쓰면 그 주기는 건너뛰고 알림을 보내요.

### 1인용에서 옮겨 오기 (기존 데이터 유지)
1. 위 셋업 후 본인 GitHub 로 로그인 → **Notion 연결** 에서 기존 CareerSync 상위 페이지를 선택 → **"기존 CareerSync DB 를 찾아서 연결했어요"** (DB 7개 + 이력서 페이지를 제목으로 찾아 재사용)
2. 설정 화면에 이름·한 줄 소개·금지어(DENYLIST)·velog·알림 웹훅을 옮겨 적기
3. `ADMIN_GITHUB_IDS` 에 본인 ID → 예전 캡처(`captures/…`) 계속 열람 가능
4. 이제 필요 없는 Vercel 환경변수: `ALLOWED_GITHUB_ID`, `NOTION_TOKEN`, `NOTION_DS_*`, `NOTION_RESUME_PAGE_ID`, `DENYLIST`, `RESUME_NAME`, `RESUME_HEADLINE`
5. GitHub Actions 의 weekly-digest / draft-posts / sync-rss 워크플로는 삭제됐어요 (Vercel Cron 으로 대체). 레포 Secrets 는 정리해도 돼요.

## 사용자: 시작하기
1. `GitHub 로 시작하기` → 가입
2. Notion 에 빈 페이지(예: `CareerSync`) 만들기 → `Notion 연결하기` → 그 페이지 선택
3. `이 페이지에 준비하기` → DB 7개 + 이력서 페이지 자동 생성 (1분 정도)
4. 설정에서 이름·금지어·알림 웹훅 입력 → Notion Work Log 에 기록 시작

## Claude 인증 (로컬 CLI)
대시보드(Vercel)는 `ANTHROPIC_API_KEY` 를 써요. 로컬 CLI(`pnpm job:*`)는 `ant auth login` 으로 키 없이 실행할 수 있어요.

```bash
pnpm check:claude
```

## 이력서 업데이트 흐름

```
주간 배치 → 성과 후보 (추천 프로젝트 + 신뢰도)
  → 📥 Inbox: 추천 프로젝트 / 다른 기존 프로젝트 / 새 프로젝트 / 보류 / 반려
  → 미리보기 (이력서 섹션 Before → After diff)
  → 적용: 성과·근거 기록 확정 + Notion 이력서 페이지 재렌더 + 스냅샷(비공개 Blob)
```

## 공고 맞춤 이력서
[resume-ai-toolkit](https://github.com/JangRuBin2/resume-ai-toolkit) 의 "원본 보존 + 회사별 맞춤본" 방식을 대시보드에 넣었어요.

1. 대시보드 → 이력서 → `공고 맞춤 이력서`
2. 회사 · 포지션 · 공고 전문(+ 강조 포인트)을 붙여넣으면, AI 없이도 바로 **겹치는 기술 / 공고에만 있는 키워드 / 관련 프로젝트**를 보여줘요.
3. 둘 중 하나로 만들기
   - `AI 로 맞춤 이력서 만들기` — Claude 가 필수/우대 요건을 내 근거(성과·기록·지표)에 매핑하고 맞춤본을 써요. 근거에 없는 숫자·기술은 자동으로 걸러지고, 미확정 근거로 쓴 문장은 "제출 전 확인"에 떠요.
   - `프롬프트 복사` — toolkit Step 3 프롬프트(공고 + 원본 이력서 + 프로젝트 레퍼런스 + 조건)를 Claude.ai · ChatGPT 에 직접 붙여넣기
4. 회사별 버전 화면에서 제출용 Markdown / 서식 있는 텍스트 복사, `PDF 저장`(브라우저 인쇄), 변경 포인트 메모 확인

| toolkit 파일 | CareerSync 에서 |
|---|---|
| `origin/이력서.md` | 이력서 화면 `Markdown 복사` |
| `reference/<프로젝트>.md` | 프로젝트 화면 `toolkit 레퍼런스 복사` |
| `companies/<회사>/이력서.md` | 맞춤본 화면 `메모 포함 복사` |

> 맞춤본은 사용자별 비공개 Blob(`users/<id>/resume-tailored/`)에 저장돼요 (로컬 개발에선 `.careersync/`). AI 생성은 월 한도(`AI_MONTHLY_LIMIT`)에 포함돼요.

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
