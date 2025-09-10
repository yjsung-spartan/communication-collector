# 대화 컨텍스트 요약 - Communication Collector API
## 날짜: 2025-09-10
## 프로젝트 개요
고객 요청 수집 시스템을 Request Analyzer GPTs와 연동하여 실제 Confluence 데이터를 제공하는 API 구축

## 완료된 작업
### 1. 문제 진단 및 해결
- GPTs Actions에서 API 접근 실패 문제 해결
- 경로 문제 수정: `/api/requests` → `/requests`
- 응답 구조 수정: GPTs가 기대하는 `data: { total, requests }` 형식으로 변경

### 2. 실제 데이터 수집 구현
- 로컬 테스트: 242개 데이터 수집 성공 (Fanlight 150개 + Momgleedu 92개)
- Vercel 배포 문제 해결:
  - 환경변수 수정: `MOMGLEEDU_CONFLUENCE_API_TOKEN` → `CONFLUENCE_API_TOKEN` (공통 사용)
  - Vercel 10초 timeout 제한으로 인한 데이터 수집 제한

### 3. 다양한 캐싱 전략 구현
1. **SQLite DB 캐싱** (현재 작동 중)
   - Build time에 DB 생성
   - 92개 데이터 제공 중
   
2. **Vercel KV 캐싱** (준비 완료)
   - 실시간 데이터 갱신 가능
   - 1시간 TTL 설정
   - `/refresh` 엔드포인트로 강제 갱신
   
3. **GitHub Actions 자동화**
   - 매일 자동 DB 업데이트
   - `.github/workflows/daily-update.yml` 설정

## 주요 파일 및 변경사항
### API 엔드포인트 파일들
- `api/index-vercel.ts`: 초기 mock 데이터 버전
- `api/real.ts`: 전체 댓글 수집 (timeout 문제)
- `api/real-fast.ts`: 페이지만 수집 (20개)
- `api/db-cached.ts`: SQLite DB 읽기
- `api/kv-cached.ts`: Vercel KV 캐싱 구현

### 설정 파일
- `vercel.json`: API 라우팅 설정
- `package.json`: vercel-build 스크립트 추가
- `scripts/build-db.js`: Build time DB 생성

### 데이터 수집
- `test-direct.ts`: 로컬 테스트용 (242개 수집)
- `create-db.ts`: SQLite DB 생성
- `src/services/confluencePageCollectorService.ts`: 핵심 수집 로직

## 중요 의사결정 사항
1. **환경변수 통합**: Momgleedu도 Fanlight와 동일한 API 토큰 사용
2. **Vercel timeout 대응**: 댓글 수집 제한하여 10초 내 완료
3. **캐싱 전략**: KV가 가장 효율적이나, 현재는 Build time DB 사용

## 현재 상태
- **URL**: `https://communication-collector.vercel.app/requests`
- **데이터**: 실제 Confluence 데이터 92개 제공 중
- **GPTs 연동**: 정상 작동
- **프로젝트 필터**: `?project=fanlight` 또는 `?project=momgleedu`
- **날짜 필터**: `?days=30`

## 다음 단계 (권장)
1. Vercel KV Store 생성 및 연결
2. GitHub Actions secrets 설정하여 자동 업데이트 활성화
3. 댓글 수집량 최적화 (timeout 내 최대한 수집)

## 참조할 코드/설정
### 환경변수 (필수)
```
CONFLUENCE_API_TOKEN=xxx
CONFLUENCE_EMAIL=project.manager@weplanet.co.kr
CONFLUENCE_DOMAIN=fanlight-weplanet.atlassian.net
MOMGLEEDU_CONFLUENCE_DOMAIN=momgle-edu.atlassian.net
```

### GPTs Actions Schema
```json
{
  "servers": [
    {
      "url": "https://communication-collector.vercel.app"
    }
  ],
  "paths": {
    "/requests": {
      "get": {
        "parameters": [
          {"name": "project", "in": "query"},
          {"name": "days", "in": "query"}
        ]
      }
    }
  }
}
```

## 문제 해결 기록
- **문제**: GPTs에서 "조회된 데이터가 없습니다" 오류
- **원인**: 경로 문제 (`/api/requests` vs `/requests`)
- **해결**: vercel.json rewrites 설정으로 모든 경로를 API로 라우팅

- **문제**: Momgleedu 데이터 0개
- **원인**: 잘못된 환경변수 사용 (`MOMGLEEDU_CONFLUENCE_API_TOKEN`)
- **해결**: `CONFLUENCE_API_TOKEN` 공통 사용

- **문제**: Vercel timeout (10초 제한)
- **원인**: 댓글 API 호출이 너무 많음
- **해결**: 페이지 수 제한, 댓글 수집 최소화