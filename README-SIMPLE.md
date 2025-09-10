# Customer Request Collector (MD Export Version)

Slack, Confluence, Figma에서 고객 요청을 수집하여 Markdown 파일로 저장하는 도구

## 🎯 주요 기능

- **Slack 메시지 수집**: 지정 채널에서 고객 요청 키워드 감지
- **Confluence 댓글 수집**: 페이지 댓글에서 고객 요청 추출
- **Figma 댓글 수집**: 디자인 파일 댓글에서 요청사항 추출
- **통합 MD 리포트**: 모든 요청을 하나의 Markdown 파일로 정리
- **자동 실행**: 매일 오전 9시 자동 수집 (전일 9시~당일 9시)

## 📦 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집하여 필요한 토큰 입력
```

## ⚙️ 환경 변수 설정

```env
# Slack (선택사항)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
MONITOR_CHANNELS=C1234567890,C0987654321

# Figma (선택사항)
FIGMA_ACCESS_TOKEN=figd_...
FIGMA_FILE_KEYS=filekey1,filekey2

# Confluence (선택사항)
CONFLUENCE_DOMAIN=yourcompany.atlassian.net
CONFLUENCE_EMAIL=your.email@company.com
CONFLUENCE_API_TOKEN=...
CONFLUENCE_SPACES=SPACE1,SPACE2  # 비워두면 모든 스페이스

# 출력 설정
OUTPUT_DIR=./exports

# 요청 감지 키워드
REQUEST_KEYWORDS=요청,문의,개선,오류,버그,에러,불편,안됨,안돼,추가,변경
URGENT_KEYWORDS=긴급,급함,ASAP,장애,다운,먹통
```

## 🚀 실행 방법

### 1. 즉시 수집 (수동 실행)
```bash
npm run collect
```
어제 9시부터 오늘 9시까지의 데이터를 즉시 수집하고 MD 파일로 저장

### 2. 자동 스케줄 실행
```bash
npm run collect:watch
```
매일 오전 9시에 자동으로 수집 실행

## 📄 출력 형식

생성되는 파일: `exports/customer_requests_YYYYMMDD.md`

```markdown
# 일일 고객 요청 리포트

**수집 일시**: 2024-12-28 09:00
**수집 범위**: 전일 09:00 ~ 당일 09:00 (24시간)

## 📊 요약
- **총 요청 수**: 15건
- **채널별**:
  - Slack: 10건
  - Confluence: 3건
  - Figma: 2건
- **우선순위별**:
  - 🔴 긴급: 2건
  - 🟡 높음: 5건
  - 🟢 보통: 8건

## 🔴 긴급 요청

### [CR-20241228-001] 결제 오류 발생
- **요청자**: 김고객 (kim@customer.com)
- **출처**: 💬 Slack - #customer-support
- **시간**: 2024-12-27 14:30
- **카테고리**: 🐛 버그

**내용**:
```
결제 진행시 500 에러가 발생합니다...
```

...
```

## 🔧 필요한 권한

### Slack
1. [api.slack.com](https://api.slack.com) 에서 앱 생성
2. OAuth & Permissions에서 Bot Token Scopes 추가:
   - `channels:history`
   - `channels:read`
   - `users:read`
   - `users:read.email`
3. Install to Workspace

### Figma
1. [Figma Settings](https://www.figma.com/settings) > Personal Access Tokens
2. Generate new token
3. 파일 키는 Figma URL에서 추출: `figma.com/file/{FILE_KEY}/...`

### Confluence
1. [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Create API token
3. Space key는 Confluence URL에서 확인: `.../wiki/spaces/{SPACE_KEY}/...`

## 📊 데이터 구조

수집되는 데이터:
- CR 번호 (CR-YYYYMMDD-001 형식)
- 요청자 정보 (이름, 이메일)
- 요청 내용
- 카테고리 (버그/개선/신규기능/문의/기타)
- 우선순위 (긴급/높음/보통/낮음)
- 출처 및 원본 링크

## 🚨 주의사항

- 첫 실행 시 이전 데이터가 없어 비어있을 수 있음
- API Rate Limit 주의 (특히 Slack)
- 민감한 정보가 포함될 수 있으니 MD 파일 관리 주의

## 📝 라이센스

MIT