# 대화 컨텍스트 요약 - GitHub Actions 설정
## 날짜: 2025-01-10
## 프로젝트: Communication Collector

## 핵심 요구사항
- Vercel 타임아웃 문제 해결 위해 GitHub Actions 사용
- 모든 댓글 수집 후 저장, Vercel은 읽기만

## 완료된 작업
1. ✅ GitHub Actions 워크플로우 생성 (.github/workflows/collect-data.yml)
2. ✅ 데이터 수집 스크립트 작성 (scripts/collect-all-data.js)  
3. ✅ API 서버 수정 (저장된 JSON 읽기)
4. ✅ GitHub 저장소 연결 및 푸시

## GitHub Secrets 설정 (최종)
**콤마로 구분된 리스트 형식 사용:**
- `CONFLUENCE_DOMAINS`: fanlight-weplanet.atlassian.net,momgle-edu.atlassian.net
- `CONFLUENCE_EMAIL`: project.manager@weplanet.co.kr
- `CONFLUENCE_API_TOKEN`: [동일 토큰]
- `CONFLUENCE_SPACES`: DOCS,DEV,PM
- `FIGMA_ACCESS_TOKEN`: [토큰]
- `FIGMA_FILE_KEYS`: O99LlTEvqCRtqUIAXLEgpw

## 중요 원칙
1. **확장성**: 새 프로젝트 추가 시 CONFLUENCE_DOMAINS에 추가만 하면 됨
2. **공통 사용**: 이메일과 API 토큰은 모든 도메인에서 공용
3. **리스트 형식**: 콤마로 구분된 문자열로 여러 값 관리

## 다음 단계
- GitHub Secrets 추가 완료
- Actions 탭에서 워크플로우 실행 확인
- 하루 4번 자동 실행 (6시, 12시, 18시, 24시)