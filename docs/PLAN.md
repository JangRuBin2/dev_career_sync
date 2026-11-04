# CareerSync 기획서

> 회사에서 일하며 남긴 기록을 **성과 데이터 → 이력서 / 포트폴리오 / 블로그 초안** 으로 자동 파생시키는 개인 커리어 관리 시스템

- 작성일: 2026-11-04
- 상태: v1 기획 확정, Phase 0~3 코드 완료 (블로그는 2026-11-04 결정으로 "초안 작성까지만 자동화")

---

## 1. 배경과 목표

### 문제
- 이직 시점에 "작년에 뭐 했지?"를 기억에 의존해 복원해야 한다.
- 성과 수치·문제 해결 과정이 시간이 지나면 흐려지고, 근거를 대기 어렵다.
- 블로그·이력서·포트폴리오를 각각 따로 관리 → 같은 내용을 세 번 작성한다.

### 목표
1. **기록은 한 번**: 매일 2분 이내 기록만 하면 나머지는 파생된다.
2. **근거 보존**: 작업 정리·핵심 성과·정량 지표를 불변 저장소에 쌓아 언제든 확인할 수 있다.
3. **사람이 최종 결정**: 이력서 반영·프로젝트 배정·외부 발행은 반드시 확인 후 진행한다.
4. **보안 우선**: 회사 기밀은 외부로 나가지 않는다.

### 비목표
- 회사 시스템(사내 Jira/Slack/GitHub) 직접 연동 — 회사 계정·인프라와 분리 원칙 때문에 v1에서는 제외.
- 다중 사용자 지원 — 본인 1인 전용.

---

## 2. 전체 아키텍처

```
                     ┌──────────────── 개인 GitHub (monorepo) ─────────────────┐
                     │                                                          │
  GitHub Actions ────┤  weekly-digest · draft-posts · sync-rss                  │
        │            └──────────────────────────────────────────────────────────┘
        │ Notion API / Claude API / velog                       ▲ push → 자동 배포
        ▼                                                       │
  ┌────────────┐    읽기/쓰기 (서버 전용)    ┌───────────────────────────────────┐
  │   Notion    │ ◀──────────────────────▶ │  Vercel App (Next.js)              │
  │ (원본 DB 7개)│      webhook ─────────▶  │  대시보드 · Inbox · 업로드 · 이력서   │
  └────────────┘                           └───────────────────────────────────┘
        │                                           │ put / get
        │                                           ▼
        │                              ┌─────────────────────────────┐
        │                              │ Vercel Blob                  │
        │                              │  - private store: 원본 캡처    │
        │                              │  - public store : 공개 이미지   │
        │                              └─────────────────────────────┘
        ▼
  Notion 이력서 페이지              블로그 초안 → (직접 복사·발행) velog · 티스토리 · 네이버 …
```

| 구성 요소 | 역할 | 선택 이유 |
|---|---|---|
| **Notion** | 데이터 원본(Source of Truth), 이력서 문서 | 모바일 기록이 편하고, 직접 열어봐도 읽히는 형태 |
| **Vercel App** | 한눈에 보는 대시보드, 확인·승인 UI, 이미지 업로드 | Notion UI만으로는 "배정 확인·미리보기·일괄 처리"가 불편 |
| **Vercel Blob** | 캡처 이미지 저장 | 앱과 같은 플랫폼, private store 지원 (아래 결정 참고) |
| **GitHub Actions** | LLM 배치·초안 생성·RSS 동기화 | 실행 시간 제한이 넉넉하고 Secrets 관리 내장 |
| **Claude API** | 요약, 성과/지표 추출, 프로젝트 매칭, 초안 작성 | 구조화 출력(JSON) 품질 |

### 결정 기록 (ADR)

**ADR-1. 이미지 저장소: Vercel Blob (R2 대신)**
- Notion File Upload API로 올리면 API가 돌려주는 파일 URL이 **1시간 뒤 만료**되어 대시보드·velog에 직접 걸 수 없다 → 외부 저장소 필요.
- Vercel Blob은 **private store**를 지원한다. private 파일은 공개 URL로 접근할 수 없고, 앱의 인증된 Route Handler에서 `get(pathname, { access: 'private' })`로만 읽어 응답한다.
- velog 본문에 넣을 이미지는 영구 공개 URL이 필요하므로 **public store를 별도로** 둔다. "공개 가능"으로 승격된(마스킹 확인된) 이미지만 public store에 복사한다.
- 결과: 별도 클라우드 계정 없이 Vercel 하나로 앱 + 저장소를 운영.

**ADR-2. 배치는 GitHub Actions, UI는 Vercel**
- LLM 호출이 여러 건 이어지는 주간 배치는 서버리스 함수 시간 제한에 걸릴 수 있다.
- 사용자 액션(승인/업로드)은 Vercel Route Handler / Server Action에서 즉시 처리.

**ADR-3. 블로그는 "초안 작성까지만 자동화", 발행은 직접 (2026-11-04 결정)**
- 배경: velog는 공식 API가 없고(비공식 GraphQL만 가능), 블로그마다 API를 연동하는 건 유지비가 크다.
- 결정: 글 작성(소재 선정 → 초안 → 마스킹·점검)까지 자동화하고, 발행은 대시보드에서 **플랫폼별 형식으로 복사**해 직접 올린다.
  - Markdown → velog · Hashnode · GitHub
  - 서식 있는 텍스트 / HTML → 티스토리 · 네이버 블로그 · 워드프레스
  - Markdown + front matter → dev.to · 정적 블로그
- 발행 기록: velog는 RSS(`v2.velog.io/rss/{username}`)로 자동, 그 외는 대시보드 "발행 완료 기록"(발행처 + URL).
- 보존: velog 비공식 GraphQL 자동 발행 코드(`core/velog/client.ts`, `policy.ts`, `jobs/publish-scheduler.ts`)는 **삭제하지 않고 비활성화**.
  `AUTO_PUBLISH=1` + 워크플로 schedule 주석 해제로 다시 켤 수 있다.
- 다음 후보: 정적 블로그(GitHub Pages/Astro)를 원본으로 두고 git push = 발행, 다른 플랫폼은 canonical 링크로 옮겨 싣기.

**ADR-4. 인증: GitHub OAuth, 본인 계정 ID만 허용**
- 1인 전용. `ALLOWED_GITHUB_ID` 와 일치하지 않으면 로그인 거부.
- 세션은 서명된 HttpOnly 쿠키(JWT, HS256).

---

## 3. 데이터 모델 (Notion DB 7개)

```
Work Log ──N:1──▶ Projects ◀──N:1── Records ──1:N──▶ Metrics
   │                 ▲  ▲               │
   │                 │  └── Achievements┘ (Records에서 파생)
   │                 │
   └──── Attachments ┴── Posts
```

### 3.1 Work Log (매일, 날것의 기록)
| 속성 | 타입 | 비고 |
|---|---|---|
| 제목 | title | |
| 날짜 | date | |
| 내용 | rich_text | 오늘 한 일 / 막힌 점 / 숫자 |
| 유형 | select | 기능개발 · 트러블슈팅 · 성능개선 · 협업 · 운영 |
| 기술태그 | multi_select | |
| 프로젝트 | relation → Projects | 비워둬도 됨 (배치가 추천) |
| 공개가능 | checkbox | |
| 블로그소재 | checkbox | |
| 처리됨 | checkbox | 주간 배치가 Records로 묶으면 체크 |
| 첨부 | relation → Attachments | |

### 3.2 Projects
| 속성 | 타입 | 비고 |
|---|---|---|
| 이름 | title | |
| 기간 | date (범위) | |
| 역할 | rich_text | |
| 기술스택 | multi_select | |
| 팀 규모 | number | |
| 요약 | rich_text | 한 줄 |
| 상태 | select | 진행중 · 완료 · 보류 |
| 공개 URL | url | 공개 사이트면 링크 |
| 저장소 URL | url | 공개 레포면 |
| 대표 이미지 | url | public Blob URL |
| 이력서 노출 순서 | number | 낮을수록 위 |
| 이력서 노출 | checkbox | |

### 3.3 Records 📦 (저장용 — 작업 정리 + 핵심 성과)
| 속성 | 타입 | 비고 |
|---|---|---|
| 제목 | title | `2026-W45 결제 API 개선` |
| 기간 | date (범위) | |
| 주기 | select | 주간 · 월간 · 프로젝트 종료 |
| 작업 요약 | rich_text | |
| 핵심 성과 | rich_text | 3줄 이내 |
| 역할 | rich_text | 내 기여 범위 |
| 기여도 | number (%) | |
| 사용 기술 | multi_select | |
| 프로젝트 | relation → Projects | |
| 원본 로그 | relation → Work Log | |
| 첨부 | relation → Attachments | |
| 상태 | select | 초안 · 확정 |
| 확정일 | date | |
| 생성 방식 | select | 자동 · 수동 |

### 3.4 Metrics 📊 (저장용 — 성과 수치 데이터)
| 속성 | 타입 | 비고 |
|---|---|---|
| 지표명 | title | API p95 응답시간 |
| 카테고리 | select | 성능 · 비용 · 품질 · 생산성 · 사용자 |
| Before / After | number | |
| 단위 | select | ms · % · 건 · 시간 · 원 · 회 |
| 방향 | select | 낮을수록 좋음 · 높을수록 좋음 |
| 개선율 | formula | 방향 반영 자동 계산 |
| 측정 방법 | rich_text | **면접 대비 핵심** |
| 측정 기간 | date (범위) | |
| 신뢰도 | select | 직접 측정 · 추정 · 팀 공유 |
| 근거 메모 | rich_text | 대시보드명·티켓번호 수준 |
| 기록 | relation → Records | |
| 상태 | select | 초안 · 확정 |

개선율 수식:
```
if(prop("방향") == "낮을수록 좋음",
   round((prop("Before") - prop("After")) / prop("Before") * 1000) / 10,
   round((prop("After") - prop("Before")) / prop("Before") * 1000) / 10)
```

### 3.5 Achievements (이력서 문장 — 가공된 결과물)
| 속성 | 타입 | 비고 |
|---|---|---|
| 문장 | title | 이력서 bullet |
| 프로젝트 | relation → Projects | |
| 근거 기록 | relation → Records | |
| 배정 상태 | select | 추천됨 · 확인됨 · 새 프로젝트 · 보류 · 반려 |
| 추천 프로젝트 | rich_text | LLM 추천명 |
| 추천 신뢰도 | number | 0~1 |
| 노출 | multi_select | 이력서 · 포트폴리오 |
| 정렬 | number | |

### 3.6 Posts (블로그 초안)
| 속성 | 타입 | 비고 |
|---|---|---|
| 제목 | title | |
| 상태 | select | 소재 · 초안 · 검토대기 · 검토완료 · 발행됨 (임시저장됨·실패는 자동 발행용) |
| 예약일시 | date | 발행 **목표일** (주기 계산·리마인드용) |
| 검토완료 | checkbox | |
| 본문 | (페이지 본문, Markdown) | |
| 태그 | multi_select | |
| 발행처 | multi_select | velog · 티스토리 · 네이버 블로그 · dev.to · 기타 |
| URL / 발행일 | url / date | 직접 올린 글 주소 (velog 는 RSS 로 자동) |
| 발행 모드 · velog ID · 실패 사유 | select / rich_text | 자동 발행(비활성화) 전용 — 보존 |
| 프로젝트 | relation → Projects | |
| 첨부 | relation → Attachments | |

### 3.7 Attachments 🆕 (이미지 · 링크)
| 속성 | 타입 | 비고 |
|---|---|---|
| 이름 | title | |
| 유형 | select | 이미지 · 링크 |
| 저장 경로 | rich_text | private Blob pathname |
| 공개 URL | url | public store URL (공개 승격 시) |
| 링크 URL | url | 유형=링크 |
| OG 썸네일 | url | 링크 미리보기 |
| 공개범위 | select | 비공개 · 공개가능 |
| 마스킹 확인 | checkbox | 공개가능 전환 조건 |
| 캡션 | rich_text | |
| 프로젝트 / 기록 / 포스트 | relation | |

> files 속성 대신 별도 DB로 둔 이유: 파일 단위로 공개범위·마스킹 여부 같은 메타데이터를 달아야 하기 때문.

### 저장소(Records/Metrics) 운영 규칙
1. **Append-only**: 배치는 새 행만 만든다. `확정` 행은 절대 덮어쓰지 않는다.
2. 확정 시 Notion 페이지 잠금 권장.
3. 매월 1일 월간 Record 롤업 생성.
4. 외부 비노출: 포트폴리오/velog는 Records·Metrics를 직접 조회하지 않는다(확정된 Achievements만 사용).

---

## 4. 핵심 플로우

### 4.1 매일 기록
- Notion 템플릿 버튼(모바일/데스크톱) 또는 대시보드 "빠른 기록".
- 캡처는 대시보드에서 업로드 → Attachments에 연결.

### 4.2 주간 배치 (금 18:00 KST, GitHub Actions)
1. `처리됨=false` 인 Work Log 조회
2. **보안 마스킹** — 금지어 사전 치환 (회사명·고객사·내부 시스템명 → 일반 명칭)
3. Claude 호출 → 구조화 JSON
   - Record 초안 (작업 요약, 핵심 성과, 사용 기술)
   - Metric 후보 (Before/After/단위/방향/측정 방법 추정)
   - Achievement 문장 후보 + **추천 프로젝트(기존 이름 or 신규 제안) + 신뢰도**
   - 블로그 소재 후보
4. Notion에 `초안`/`추천됨` 상태로 저장, Work Log `처리됨` 체크
5. 대시보드 재검증(revalidate) 호출 + 알림

### 4.3 이력서 업데이트 (프로젝트 배정 확인)
```
Achievement 후보 (추천됨)
   ▼
📥 Inbox 카드
   ○ 추천 프로젝트에 추가
   ○ 다른 기존 프로젝트 선택 ▾
   ○ 새 프로젝트로 생성 (이름/기간/역할 — LLM 초안 제공)
   ○ 보류   ○ 반려
   ▼ 선택
이력서 미리보기 (해당 프로젝트 섹션 Before → After)
   ▼ [적용]
Notion 이력서 페이지의 해당 프로젝트 섹션만 재렌더 + 변경 이력 저장
```
- 확인 없이 이력서가 바뀌는 경로는 없다.

### 4.4 블로그 주기 포스팅 (초안 자동 작성, 발행은 직접)
```
소재(주간 배치가 추천) → [draft-posts: 주기마다] 초안 자동 작성 → 검토대기
  → 대시보드에서 다듬기 + 점검(금지어·비공개 이미지·TODO)
  → 플랫폼별 형식 복사 → 직접 발행 → 발행 완료 기록 (velog 는 RSS 자동)
```
- 주기 설정: `POST_INTERVAL_DAYS`(기본 14일), 목표일 D-`POST_LEAD_DAYS`(기본 3일)에 초안 작성 → 알림.
- 본문 이미지는 public store URL만 권장 (비공개 캡처는 외부에서 보이지 않음 → 점검에서 경고).
- 작성자 메모(`<!-- 이미지: … -->`)는 내보낼 때 자동 제거.

### 4.5 이미지 업로드 / 공개 승격
```
드래그·붙여넣기 → (브라우저) 블러/모자이크 + EXIF 제거
   → private store 저장 → Attachments(비공개) 생성
   → [공개 가능으로 전환] 마스킹 확인 체크 필수
   → public store로 복사 → 공개 URL 기록
```
- 비공개 이미지는 `/api/files/[...path]` 인증 라우트로만 열람.
- (Phase 4) Claude Vision으로 로고·이메일·개인정보 노출 경고.

---

## 5. Vercel 대시보드 화면

| 경로 | 화면 | 내용 |
|---|---|---|
| `/` | 공개 랜딩 | (선택) 공개 포트폴리오 |
| `/login` | 로그인 | GitHub OAuth |
| `/dashboard` | 홈 | 이번 주 기록 수, 확인 대기, 지표 Top 5, 다음 발행, 이력서 최종 업데이트, 프로젝트 타임라인 |
| `/dashboard/inbox` | Inbox | 성과 후보 프로젝트 배정, Record/Metric 확정 |
| `/dashboard/projects` | 프로젝트 목록 | 카드 (대표 이미지·기간·스택·공개 링크 뱃지) |
| `/dashboard/projects/[id]` | 프로젝트 상세 | 개요, Records 타임라인, 지표 표, 캡처 갤러리, 링크 카드, 관련 글 |
| `/dashboard/records/[id]` | Record 상세 | 요약, 핵심 성과, 지표, 이미지, 원본 로그 |
| `/dashboard/posts` | 포스팅 | 소재 큐, 상태별 목록, 목표일·검토, 플랫폼별 복사, 발행 완료 기록 |
| `/dashboard/resume` | 이력서 | 미리보기, Markdown 내보내기 |
| `/dashboard/upload` | 업로드 | 이미지(블러 도구) / 링크 첨부 |

---

## 6. 보안 원칙
1. 개인 Notion 워크스페이스 · 개인 GitHub · 개인 Vercel만 사용. 회사 기기/계정과 분리.
2. 3단계 필터: 금지어 사전 → LLM 검토 → **사람 승인**.
3. 외부 노출(블로그 발행, 포트폴리오)은 사람이 직접·승인된 것만.
4. 캡처는 기본 비공개. 공개 전환은 마스킹 확인 후에만.
5. 절대 수치 대신 상대값(%) 권장.
6. 금지어 사전(`DENYLIST`)은 레포에 커밋하지 않고 Secrets/환경변수로 주입.
7. 모든 Notion·Blob·Claude 토큰은 서버 전용(클라이언트 번들 노출 금지).

---

## 7. 기술 스택
| 영역 | 선택 |
|---|---|
| 언어 | TypeScript (strict) |
| 패키지 | pnpm workspace (monorepo) |
| 웹 | Next.js 16 (App Router, Server Actions), Tailwind CSS 4 |
| Notion | `@notionhq/client` v5 (API 2025-09-03, data source 기반) |
| 이미지 | `@vercel/blob` (private + public store) |
| LLM | `@anthropic-ai/sdk` |
| 인증 | GitHub OAuth + `jose` (JWT 쿠키) |
| 검증 | `zod` |
| 테스트 | `vitest` |
| 배치 | GitHub Actions + `tsx` |

## 8. 레포 구조
```
careersync/
├─ apps/web/                # Next.js (Vercel 배포 대상, Root Directory = apps/web)
│  ├─ app/login, app/dashboard/**, app/api/**
│  ├─ lib/                  # auth, blob, notion 캐시
│  └─ proxy.ts              # /dashboard 보호
├─ packages/core/           # 웹·배치 공용 도메인 로직
│  └─ src/
│     ├─ notion/            # 스키마, 클라이언트, 리포지토리, 셋업
│     ├─ sanitize/          # 금지어 마스킹
│     ├─ metrics/           # 개선율 계산
│     ├─ llm/               # 주간 다이제스트 프롬프트·파싱
│     ├─ publish/           # 플랫폼별 내보내기(Markdown/HTML), 발행 전 점검
│     ├─ velog/             # RSS (+ 보존: 비공식 GraphQL 자동 발행, 비활성화)
│     └─ resume/            # 이력서 렌더(Markdown/Notion 블록)
├─ jobs/                    # weekly-digest, draft-posts, sync-rss, setup-notion (publish-scheduler 는 비활성화)
├─ docs/                    # 기획·셋업 문서
└─ .github/workflows/       # ci, weekly-digest, draft-posts, sync-rss (publish 는 수동 실행만)
```

## 9. 환경변수
| 이름 | 사용처 | 설명 |
|---|---|---|
| `NOTION_TOKEN` | web, jobs | 개인 워크스페이스 내부 통합 토큰 |
| `NOTION_PARENT_PAGE_ID` | setup | DB를 생성할 상위 페이지 |
| `NOTION_DS_*` | web, jobs | 각 DB의 data source ID (setup 결과) |
| `NOTION_RESUME_PAGE_ID` | web, jobs | 이력서 페이지 |
| `ANTHROPIC_API_KEY` | jobs | 대안. 권장은 로컬 `ant auth login`, Actions 는 WIF (`ANTHROPIC_FEDERATION_RULE_ID` 등, 자동 갱신) |
| `BLOB_PRIVATE_READ_WRITE_TOKEN` / `BLOB_PUBLIC_READ_WRITE_TOKEN` | web | 두 store 토큰 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `ALLOWED_GITHUB_ID` | web | OAuth |
| `SESSION_SECRET` | web | 32자 이상 |
| `REVALIDATE_SECRET` | web, jobs | 배치 → 캐시 갱신 |
| `VELOG_USERNAME` | jobs | RSS 동기화 |
| `AUTO_PUBLISH` / `VELOG_ACCESS_TOKEN` / `VELOG_REFRESH_TOKEN` | jobs | 자동 발행(비활성화) 다시 켤 때만 |
| `DENYLIST` | jobs | `회사명=A사,고객사=B사` 형식 |
| `NOTIFY_WEBHOOK_URL` | jobs | Slack/Discord 알림 (선택) |

## 10. 로드맵
| Phase | 기간 | 범위 | 상태 |
|---|---|---|---|
| **0** | 1주 | monorepo, Notion DB 셋업 스크립트, Vercel 배포, GitHub 로그인 | ✅ 코드 완료 · 실계정 연결 필요 |
| **1** | 2주 | 대시보드 읽기(홈/프로젝트/상세), 이미지·링크 첨부(Blob, 모자이크) | ✅ 코드 완료 · mock 으로 E2E 확인 |
| **2** | 2주 | 주간 배치, Inbox 프로젝트 배정 확인, 이력서 섹션 렌더·변경 이력 | ✅ 코드 완료 · mock 으로 E2E 확인 |
| **3** | 2주 | 블로그 초안 자동 작성, 플랫폼별 복사(Markdown/HTML), 발행 기록, velog RSS 동기화 | ✅ 코드 완료 · mock 으로 E2E 확인 |
| **4** | 이후 | 지표 차트, PDF, JD 맞춤 이력서, 공개 포트폴리오, Vision 검사 | ⏳ |

### 검증 현황 (2026-11-04)
- 단위 테스트 36개 (마스킹, 개선율, 이력서 렌더/미리보기, 내보내기·발행 전 점검, 발행 정책(보존), RSS 파싱, LLM 결과 검증, 세션)
- `pnpm mock:notion` (가짜 Notion API) 위에서 프로덕션 빌드로 E2E 확인:
  빠른 기록 → Inbox 배정(기존/새 프로젝트) → 미리보기 → 적용(성과·기록 확정 + 이력서 재렌더), 포스팅 검토·목표일, 플랫폼별 복사, 발행 완료 기록, 링크 첨부·사내 주소 차단, 인증 차단(307/401/403), 모바일 390px
- **아직 실제 서비스로 검증하지 않은 부분**: Notion 실 API(특히 `setup:notion` 의 dual relation·수식 생성), Vercel Blob 업로드/공개 승격, Claude 주간 다이제스트 품질

## 11. 리스크
| 리스크 | 영향 | 대응 |
|---|---|---|
| 직접 발행을 미루게 됨 | 글이 쌓이기만 함 | 목표일 알림, 대시보드 "검토 · 발행 대기" 목록 |
| (자동 발행을 다시 켤 경우) velog 비공식 API 변경/토큰 만료 | 발행 실패 | 실패 알림 + 복사 발행, 읽기는 RSS |
| Notion rate limit (평균 3 req/s) | 배치 지연 | 재시도·백오프, 요청 직렬화 |
| LLM 환각 (없는 수치 생성) | 잘못된 성과 기록 | 원문에 있는 숫자만 허용(검증), 모두 `초안` 상태로 저장 후 사람 확정 |
| 기밀 유출 | 치명적 | 3단계 필터, 비공개 기본값, 공개 승격 조건 |
| 기록 습관 실패 | 시스템 무용 | 기록 마찰 최소화, 주간 알림에 "이번 주 기록 0건" 경고 |
