# 일일 고객 요청 수집 봇 PRD
Product Requirements Document - Daily Customer Request Collector

## 1. 제품 개요

### 1.1 제품명
**Customer Request Bot** - 고객 요청 자동 수집 및 Change Request Log 관리 시스템

### 1.2 목적
Slack, Figma, Confluence에서 발생하는 고객 요청사항을 자동으로 수집하여 매일 아침 요약 리포트를 제공하고, Change Request Log로 체계적으로 관리하는 슬랙 봇

### 1.3 핵심 가치
- **자동 수집**: 여러 채널의 고객 요청을 자동으로 수집
- **일일 요약**: 매일 아침 9시 전날 요청사항 정리 리포트
- **체계적 관리**: 모든 요청을 Change Request Log로 문서화
- **추적 가능**: 요청의 처리 상태와 히스토리 관리

## 2. 사용자 스토리

### 2.1 PM/CS팀
- "매일 아침 어제 들어온 고객 요청을 한눈에 보고 싶다"
- "고객 요청을 Change Request로 정리해서 관리하고 싶다"
- "요청의 우선순위와 처리 상태를 추적하고 싶다"
- "반복되는 요청 패턴을 파악하고 싶다"

### 2.2 개발팀
- "고객 요청 중 개발 관련 사항만 필터링해서 보고 싶다"
- "긴급 요청은 즉시 알림 받고 싶다"
- "Change Request의 구현 상태를 업데이트하고 싶다"

### 2.3 경영진
- "주간/월간 고객 요청 트렌드를 파악하고 싶다"
- "처리율과 소요 시간 통계를 보고 싶다"
- "VIP 고객 요청을 별도로 관리하고 싶다"

## 3. 기능 요구사항

### 3.1 Phase 1: 고객 요청 수집 (1주)
#### 요청 수집 기능
- [ ] 지정된 Slack 채널 모니터링 (고객 지원 채널)
- [ ] 고객 요청 키워드 자동 감지 ("요청", "문의", "개선", "오류", "버그" 등)
- [ ] 요청자 정보 및 시간 기록
- [ ] 요청 내용 자동 분류 (버그/개선/신규기능/문의)

#### 데이터 저장
- [ ] 고객 요청 데이터베이스 저장
- [ ] 첨부 파일/스크린샷 보관
- [ ] 스레드 대화 전체 수집

### 3.2 Phase 2: 일일 리포트 및 CR Log (1주)
#### 일일 리포트
- [ ] 매일 오전 9시 자동 리포트 생성
- [ ] 전날 수집된 요청 요약 (카테고리별 분류)
- [ ] 우선순위 자동 지정 (긴급/높음/보통/낮음)
- [ ] 지정 채널에 리포트 게시

#### Change Request Log
- [ ] CR 번호 자동 생성 (CR-YYYYMMDD-001)
- [ ] 구조화된 CR 문서 생성
  - 요청자 정보
  - 요청 일시
  - 요청 내용
  - 카테고리
  - 우선순위
  - 처리 상태
  - 담당자 지정
- [ ] CSV/Excel 내보내기
- [ ] Confluence 자동 문서화 (선택)

### 3.3 Phase 3: 외부 채널 통합 (2주)
#### Figma 코멘트 수집
- [ ] 지정 Figma 파일의 코멘트 모니터링
- [ ] 고객 관련 코멘트 필터링
- [ ] 디자인 요청사항 CR Log 연동

#### Confluence 코멘트 수집  
- [ ] 고객 요구사항 문서 코멘트 추적
- [ ] 스펙 변경 요청 자동 감지
- [ ] CR Log와 자동 연결

## 4. 기술 요구사항

### 4.1 기술 스택
```
Backend:
- Node.js + TypeScript
- Express.js (간단한 API 서버)
- Slack Bolt SDK (슬랙 봇 프레임워크)
- PostgreSQL (메시지 저장)
- Redis (캐싱, 실시간 상태 관리)

Frontend (관리 대시보드):
- Next.js (선택사항)
- Tailwind CSS

배포:
- Vercel 또는 Railway (서버리스)
- Supabase (PostgreSQL + 실시간 기능)
```

### 4.2 API 통합
- Slack Web API & Events API
- Figma REST API
- Confluence REST API
- OpenAI API (요약 기능용)

### 4.3 보안 요구사항
- OAuth 2.0 인증
- API 키 암호화 저장
- Rate limiting
- 민감 정보 필터링

## 5. 비기능 요구사항

### 5.1 성능
- 요청 수집 누락률 < 1%
- 일일 리포트 생성 시간 < 30초
- 최대 일일 처리 요청 수: 1,000건

### 5.2 정확성
- 고객 요청 감지 정확도 > 95%
- 자동 분류 정확도 > 80%
- 중복 제거 기능

### 5.3 가용성
- 매일 오전 9시 리포트 100% 전송
- 실시간 수집 중단 시 자동 복구
- 누락 데이터 백필 기능

## 6. 데이터 모델

### 6.1 핵심 엔티티
```typescript
// 고객 요청
interface CustomerRequest {
  id: string;
  crNumber: string; // CR-20241228-001
  source: 'slack' | 'figma' | 'confluence';
  sourceId: string; // 원본 메시지/코멘트 ID
  
  // 요청자 정보
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  customerCompany?: string;
  
  // 요청 내용
  title: string; // 자동 생성 또는 수동 입력
  description: string;
  category: 'bug' | 'improvement' | 'new_feature' | 'inquiry' | 'other';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  
  // 메타데이터
  channelId?: string;
  channelName?: string;
  threadTs?: string;
  attachments?: string[]; // 파일 URL 목록
  originalUrl?: string; // Slack/Figma/Confluence 링크
  
  // 상태 관리
  status: 'new' | 'reviewing' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  assignee?: string;
  
  // 타임스탬프
  requestedAt: Date;
  collectedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Change Request Log
interface ChangeRequestLog {
  id: string;
  crNumber: string;
  requestId: string; // CustomerRequest ID 참조
  
  // 상세 정보
  businessImpact: string;
  technicalRequirements: string;
  estimatedEffort?: string; // 예: "3 man-days"
  targetRelease?: string;
  
  // 처리 이력
  history: ChangeHistory[];
  comments: Comment[];
  
  // 결과
  resolution?: string;
  implementationNotes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// 변경 이력
interface ChangeHistory {
  id: string;
  crNumber: string;
  action: 'status_change' | 'assign' | 'comment' | 'priority_change';
  fromValue?: string;
  toValue?: string;
  userId: string;
  userName: string;
  timestamp: Date;
  note?: string;
}

// 일일 리포트
interface DailyReport {
  id: string;
  reportDate: Date;
  
  // 요약 통계
  totalRequests: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  bySource: Record<string, number>;
  
  // 요청 목록
  requests: string[]; // CR Numbers
  
  // 리포트 메타데이터
  generatedAt: Date;
  postedChannelId?: string;
  postedMessageTs?: string;
  exportedFileUrl?: string; // CSV/Excel 파일 URL
}
```

## 7. 주요 화면 및 인터랙션

### 7.1 슬랙 명령어
```
/cr setup - 초기 설정 (모니터링 채널 지정)
/cr status - 오늘 수집된 요청 현황
/cr list [date] - 특정 날짜 요청 목록
/cr detail [CR번호] - 특정 CR 상세 조회
/cr assign [CR번호] [@담당자] - 담당자 지정
/cr update [CR번호] [status] - 상태 업데이트
/cr report - 수동으로 일일 리포트 생성
/cr export [date_range] - CSV 내보내기
```

### 7.2 일일 리포트 형식
```
📊 일일 고객 요청 리포트
날짜: 2024년 12월 27일

📈 요약
• 총 요청: 23건
• 긴급: 2건 | 높음: 5건 | 보통: 12건 | 낮음: 4건

🔴 긴급 요청 (2건)
1. [CR-20241227-001] 결제 오류 발생 - @customer_a
   "결제 진행 시 500 에러 발생합니다"
   
2. [CR-20241227-008] 데이터 조회 불가 - @customer_b  
   "대시보드에서 데이터가 표시되지 않습니다"

🟡 주요 개선 요청 (5건)
3. [CR-20241227-003] 엑셀 내보내기 기능 추가 요청
4. [CR-20241227-005] 다크모드 지원 요청
...

📎 첨부: daily_report_20241227.csv
[상세 CR Log 보기] [Confluence에서 보기]
```

### 7.3 CR 상세 정보 카드
```
📋 CR-20241227-001

요청자: 김고객 (ABC社)
채널: #customer-support
시간: 2024-12-27 14:23

📝 요청 내용:
"결제 페이지에서 카드 정보 입력 후 
결제하기 버튼 클릭 시 500 에러 발생"

카테고리: 🐛 버그
우선순위: 🔴 긴급
상태: 🔄 검토중
담당자: @dev_team

[Slack 원본] [스레드 보기] [상태 변경]
```

## 8. 개발 로드맵

### Week 1: 핵심 기능
- [ ] 프로젝트 셋업 (Node.js + TypeScript)
- [ ] Slack 봇 기본 구현 (Bolt SDK)
- [ ] 고객 요청 감지 로직
- [ ] PostgreSQL 데이터베이스 구축
- [ ] CR 번호 생성 및 저장

### Week 2: 리포트 시스템
- [ ] 일일 리포트 생성 로직
- [ ] 스케줄러 구현 (매일 오전 9시)
- [ ] CSV 내보내기 기능
- [ ] Slack 명령어 구현
- [ ] Change Request Log 관리

### Week 3-4: 확장 기능
- [ ] Figma API 연동 (코멘트 수집)
- [ ] Confluence API 연동 (코멘트 수집)
- [ ] AI 요약 기능 (OpenAI API)
- [ ] 대시보드 UI (선택)
- [ ] 테스트 및 배포

## 9. 성공 지표

### 9.1 효율성
- 고객 요청 누락률 < 5%
- CR Log 작성 시간 80% 감소
- 일일 리포트 확인율 > 90%

### 9.2 정확성
- 자동 분류 정확도 > 80%
- 우선순위 판단 정확도 > 75%
- 중복 요청 감지율 > 90%

### 9.3 비즈니스 가치
- 평균 요청 처리 시간 30% 단축
- 고객 만족도 20% 향상
- 반복 요청 50% 감소

## 10. 리스크 및 대응

### 10.1 기술적 리스크
- **Slack Rate Limit**: 큐잉 시스템 도입
- **대용량 데이터**: 아카이빙 정책 수립
- **API 변경**: 버전 관리 및 폴백

### 10.2 보안 리스크
- **토큰 유출**: Vault 도입 고려
- **민감 정보**: 컨텐츠 필터링
- **권한 관리**: RBAC 구현

## 11. 향후 확장 계획

### 추가 연동 후보
- GitHub/GitLab
- Jira
- Notion
- Google Workspace
- Linear

### AI 기능 확장
- 자동 요약
- 감정 분석
- 중요도 예측
- 자동 분류

### 엔터프라이즈 기능
- SSO 지원
- 감사 로그
- 컴플라이언스
- SLA 보장

## 12. 참고 자료

### API 문서
- [Slack API](https://api.slack.com)
- [Figma API](https://www.figma.com/developers/api)
- [Confluence API](https://developer.atlassian.com/cloud/confluence/rest)

### 유사 서비스
- Zapier
- IFTTT
- Slack Workflow Builder
- Microsoft Power Automate

---

**문서 버전**: 1.0.0  
**작성일**: 2024-12-28  
**작성자**: WeplaNet Team