# Communication Collector

고객 요청 수집 및 커뮤니케이션 통합 API 서버

## 🚀 주요 기능

- **자동 수집**: Slack 채널에서 고객 요청 자동 감지
- **일일 리포트**: 매일 오전 9시 전날 요청 요약 리포트
- **CR 번호 관리**: 체계적인 Change Request 번호 부여 (CR-YYYYMMDD-001)
- **우선순위 자동 분류**: 긴급/높음/보통/낮음
- **카테고리 분류**: 버그/개선/신규기능/문의/기타

## 📋 설치 방법

### 1. 프로젝트 클론 및 의존성 설치

```bash
git clone [repository-url]
cd communication-collector
npm install
```

### 2. 환경 변수 설정

`.env.example`을 `.env`로 복사하고 값을 입력:

```bash
cp .env.example .env
```

필수 환경 변수:
- `SLACK_BOT_TOKEN`: xoxb-로 시작하는 봇 토큰
- `SLACK_APP_TOKEN`: xapp-로 시작하는 앱 토큰  
- `SLACK_SIGNING_SECRET`: 앱 서명 시크릿
- `MONITOR_CHANNELS`: 모니터링할 채널 ID (콤마 구분)
- `REPORT_CHANNEL`: 리포트를 게시할 채널 ID

### 3. Slack 앱 설정

1. [api.slack.com](https://api.slack.com) 에서 새 앱 생성
2. Socket Mode 활성화
3. 필요한 권한 추가:
   - `channels:history` - 채널 메시지 읽기
   - `channels:read` - 채널 정보 읽기
   - `chat:write` - 메시지 전송
   - `reactions:write` - 이모지 리액션 추가
   - `users:read` - 사용자 정보 읽기
   - `users:read.email` - 사용자 이메일 읽기
4. 슬래시 커맨드 추가: `/cr`
5. Event Subscriptions 설정:
   - `message.channels` - 채널 메시지 이벤트
6. 워크스페이스에 앱 설치

### 4. 실행

개발 모드:
```bash
npm run dev
```

프로덕션 모드:
```bash
npm run build
npm run start:prod
```

## 💬 Slack 명령어

- `/cr setup` - 현재 설정 확인
- `/cr status` - 오늘 수집 현황
- `/cr report` - 수동 리포트 생성
- `/cr list` - 오늘 요청 목록
- `/cr detail [CR번호]` - 요청 상세 정보
- `/cr assign [CR번호] [@담당자]` - 담당자 지정
- `/cr update [CR번호] [상태]` - 상태 업데이트
- `/cr help` - 도움말

## 🔧 설정

### 고객 요청 감지 키워드

기본 키워드 (`.env`에서 수정 가능):
- 요청, 문의, 개선, 오류, 버그, 에러, 불편, 안됨, 안돼, 추가, 변경

### 우선순위 키워드

- **긴급**: 긴급, 급함, ASAP, 장애, 다운, 먹통
- **높음**: 중요, 우선, 빠른, 시급
- **낮음**: 검토, 고려, 제안, 아이디어

## 📊 일일 리포트 형식

매일 오전 9시에 자동으로 생성되는 리포트:

```
📊 일일 고객 요청 리포트
날짜: 2024년 12월 27일

📈 요약
• 총 요청: 23건
• 긴급: 2건 | 높음: 5건 | 보통: 12건 | 낮음: 4건

🔴 긴급 요청 (2건)
[CR-20241227-001] 결제 오류 발생
요청자: 김고객 | 채널: #customer-support
"결제 진행시 500 에러가 발생합니다..."

📊 카테고리별 분포
• 🐛 버그: 8건
• 🔧 개선: 7건
• ✨ 신규기능: 5건
• ❓ 문의: 3건
```

## 🗄️ 데이터 저장

### 개발 환경
- In-memory 저장소 사용 (재시작시 초기화)

### 프로덕션 환경
- PostgreSQL 데이터베이스 사용
- `DATABASE_URL` 환경 변수 설정 필요

## 📁 프로젝트 구조

```
src/
├── index.ts                 # 메인 진입점
├── types/                   # TypeScript 타입 정의
│   └── index.ts
├── services/               # 비즈니스 로직
│   ├── databaseService.ts  # DB 연동
│   ├── dailyReportService.ts # 리포트 생성
│   └── schedulerService.ts  # 스케줄러
├── handlers/               # 이벤트 핸들러
│   └── customerRequestHandler.ts
└── utils/                  # 유틸리티 함수
```

## 🚀 배포

### Vercel 배포

```bash
vercel deploy
```

### Docker 배포

```bash
docker build -t customer-request-bot .
docker run -d --env-file .env customer-request-bot
```

## 📝 라이센스

MIT

## 🤝 기여

Issues와 Pull Request는 언제나 환영합니다!