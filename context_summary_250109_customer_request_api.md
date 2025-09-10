# 대화 컨텍스트 요약 - Customer Request Collection API
## 날짜: 2025-01-09
## 프로젝트 개요
Slack, Confluence, Figma에서 고객 요청을 수집하여 일일 리포트를 생성하는 시스템에 API 레이어 추가

## 완료된 작업
1. **경과 일수 표시 기능 추가**
   - MD 리포트에 각 요청별 경과 일수 표시
   - "오늘", "3일 전", "1주 전", "4개월 전" 등 읽기 쉬운 형식
   - 7일 이상 미해결 요청에 ⚠️ 표시
   - 요약 섹션에 미해결 통계 추가

2. **API 서버 구현** (`src/api-server.ts`)
   - Express 기반 REST API 서버
   - 엔드포인트:
     - `/api/requests` - 모든 요청 조회
     - `/api/summary` - 통계 요약
     - `/api/requests/llm` - LLM 최적화 포맷 (해결/미해결 분리)
     - `/api/collect` - 수동 수집 트리거
     - `/openapi.json` - GPTs Actions용 OpenAPI 스키마

3. **해결/미해결 분리 로직**
   - 내부 개발자(iOS, Android, DANIEL, LUCY, LILY)가 응답한 건은 resolved로 분류
   - 클라이언트(heather) 요청은 unresolved로 유지
   - 우선순위별 그룹화 (urgent, high, medium, low)

## 진행 중인 작업
- Vercel 배포 설정
- GPTs Actions 구성

## 다음 단계
1. Vercel 배포 완료
2. GPTs에서 Actions 설정하여 API 연동
3. LLM을 통한 요청 종합/충돌 검토/태스크화

## 주요 파일 및 변경사항
- `src/services/mdExportService.ts` - 경과 일수 계산 및 표시 기능 추가
- `src/api-server.ts` - 새로운 API 서버 (신규)
- `api/index.ts` - Vercel 배포용 엔트리포인트 (신규)
- `vercel.json` - Vercel 배포 설정 (신규)
- `package.json` - `npm run api` 스크립트 추가

## 중요 의사결정 사항
1. **해결/미해결 분리**: 내부 개발자 응답 여부로 간단히 구분 (향후 스레드 기반 추적으로 개선 가능)
2. **API 설계**: RESTful 패턴 + LLM 특화 엔드포인트 제공
3. **배포 전략**: Vercel 서버리스 함수로 배포하여 관리 최소화

## 참조할 코드/설정
```bash
# API 서버 로컬 실행
npm run api

# 수집 실행
npm run collect

# Vercel 배포
vercel
```

## 환경 변수
- `CONFLUENCE_DOMAIN=fanlight-weplanet.atlassian.net`
- `CONFLUENCE_EMAIL=project.manager@weplanet.co.kr`
- `FIGMA_FILE_KEYS=O99LlTEvqCRtqUIAXLEgpw`
- `CLIENT_AUTHORS=heather,client,customer`
- `INTERNAL_AUTHORS=iOS,Android,DANIEL,LUCY,LILY`