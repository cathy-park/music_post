# 우리의 작은 세계 — 100일 음악일기

소연이 관리자 화면에서 노래 파일, 가사, 짧은 코멘트를 등록하고, 용민은 전달받은 비공개 링크로 읽고 들을 수 있는 모바일 우선 웹앱입니다.

## 화면

- `/v/:shareToken` : 상대방용 읽기 전용 뷰어
- `/admin` : 소연용 관리자 화면
- Supabase가 연결되지 않으면 자동으로 로컬 데모 모드로 실행됩니다.

## 핵심 기능

- 100일 선물용 커버 화면
- 음악일기 타임라인
- 음원 재생
- 가사 / 그날의 코멘트 탭
- 관리자용 곡 추가·수정·삭제
- 음원 업로드
- 곡별 공개/비공개
- 추측하기 어려운 공유 토큰 링크
- 모바일/데스크톱 반응형 UI

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 다음 주소를 엽니다.

- 뷰어: `http://localhost:5173/v/demo-100days`
- 관리자: `http://localhost:5173/admin`

로컬 데모 모드에서는 텍스트 데이터가 같은 브라우저의 localStorage에 저장됩니다. 실제로 다른 기기에서 링크를 열어 보려면 아래 Supabase 연결이 필요합니다.

## 실제 공유 서비스로 연결하기

### 1. Supabase 프로젝트 생성

Supabase에서 새 프로젝트를 만든 뒤 `supabase/schema.sql`을 SQL Editor에서 실행합니다.

### 2. 관리자 인증

Authentication에서 이메일 로그인을 활성화합니다. 관리자 이메일로 `/admin`에서 매직 링크를 받습니다.

### 3. 기본 음악책 생성

로그인한 사용자 UUID를 확인한 뒤 SQL Editor에서 실행합니다.

```sql
insert into public.diary_books (
  owner_id,
  title,
  subtitle,
  recipient_name,
  sender_name,
  day_count,
  cover_message,
  published
) values (
  '여기에-auth-user-uuid',
  '우리의 작은 세계',
  '말로 다 못한 날들을 노래로 남겼어',
  '용민 오빠',
  '소연',
  100,
  '오빠와 함께한 날들을 돌아보니, 기억하고 싶은 순간마다 노래가 하나씩 생겼어.',
  true
);
```

### 4. 음원 저장소 생성

Storage에서 `music-diary-audio` 버킷을 만들고 Public으로 설정합니다. 이 버전은 링크 기반 선물용으로 단순화한 구조입니다. 의료·금융·민감정보 수준의 강한 보안이 필요하다면 private bucket + Edge Function으로 signed URL을 발급하는 구조로 바꾸는 것이 맞습니다.

### 5. 환경변수 설정

`.env.example`을 `.env`로 복사하고 값을 넣습니다.

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_OWNER_EMAIL=...
```

### 6. 배포

Vercel, Netlify 등 Vite 정적 배포를 지원하는 서비스에 연결합니다. SPA 라우팅을 위해 모든 경로를 `index.html`로 보내는 rewrite 설정이 필요합니다.

Vercel 예시 `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

## 추천 콘텐츠 구조

1. `별이 많아진 밤` — 우리 처음 만난 날
2. `쉬어갈 세계` — 오빠가 스스로에게 지치고 실망했던 밤
3. 이후의 곡 — 사건을 직접 설명하기보다 그날의 정서가 떠오르는 짧은 부제

코멘트는 설명문보다 2~4문장 정도가 가장 좋습니다. 노래가 감정을 담당하고, 코멘트는 그 노래가 태어난 이유만 알려주는 구조가 부담이 적습니다.
