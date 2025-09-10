import { CustomerRequest } from '../types';

export class DummyDataService {
  generateDummyRequests(): CustomerRequest[] {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 다양한 샘플 데이터 생성
    const dummyRequests: CustomerRequest[] = [
      // Slack 긴급 버그
      {
        id: '1',
        crNumber: this.generateCRNumber(1),
        source: 'slack',
        sourceId: 'msg_001',
        requesterId: 'U123456',
        requesterName: '김철수',
        requesterEmail: 'chulsoo.kim@company.com',
        customerCompany: 'ABC Corp',
        title: '결제 페이지에서 500 에러 발생',
        description: '긴급! 결제 진행 중 카드 정보 입력 후 "결제하기" 버튼 클릭시 500 에러가 발생합니다. 여러 고객이 동일한 문제를 겪고 있습니다.',
        category: 'bug',
        priority: 'urgent',
        channelId: 'C123456',
        channelName: 'customer-support',
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 10 * 3600000), // 어제 10시
        collectedAt: now,
        updatedAt: now,
      },
      
      // Confluence 기능 개선
      {
        id: '2',
        crNumber: this.generateCRNumber(2),
        source: 'confluence',
        sourceId: 'comment_001',
        requesterId: 'conf_user_001',
        requesterName: '이영희',
        requesterEmail: 'younghee.lee@company.com',
        customerCompany: 'XYZ Inc',
        title: '대시보드에 Excel 내보내기 기능 추가 요청',
        description: '고객사에서 월별 리포트를 Excel로 다운로드할 수 있는 기능을 요청했습니다. 현재는 PDF만 지원되고 있어 데이터 가공이 어렵다고 합니다.',
        category: 'improvement',
        priority: 'high',
        channelName: 'Confluence: PRD - 신규 기능',
        originalUrl: 'https://company.atlassian.net/wiki/spaces/PRD/pages/123456',
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 11 * 3600000), // 어제 11시
        collectedAt: now,
        updatedAt: now,
      },
      
      // Figma 디자인 버그
      {
        id: '3',
        crNumber: this.generateCRNumber(3),
        source: 'figma',
        sourceId: 'figma_comment_001',
        requesterId: 'figma_designer_001',
        requesterName: '박디자인',
        requesterEmail: 'design.park@company.com',
        title: '모바일 화면에서 버튼이 잘림',
        description: 'iPhone SE 크기에서 하단 CTA 버튼이 화면 밖으로 나가는 문제가 있습니다. 반응형 수정이 필요합니다.',
        category: 'bug',
        priority: 'high',
        channelName: 'Figma: Mobile App Design v2.0',
        originalUrl: 'https://www.figma.com/file/abc123/Mobile-App?node-id=456',
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 13 * 3600000), // 어제 13시
        collectedAt: now,
        updatedAt: now,
      },
      
      // Slack 일반 문의
      {
        id: '4',
        crNumber: this.generateCRNumber(4),
        source: 'slack',
        sourceId: 'msg_002',
        requesterId: 'U789012',
        requesterName: '최민수',
        requesterEmail: 'minsoo.choi@customer.com',
        customerCompany: 'Customer Ltd',
        title: '비밀번호 재설정 메일이 오지 않습니다',
        description: '비밀번호 재설정을 요청했는데 이메일이 도착하지 않습니다. 스팸함도 확인했습니다.',
        category: 'inquiry',
        priority: 'medium',
        channelId: 'C123456',
        channelName: 'customer-support',
        threadTs: '1234567890.123456',
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 14 * 3600000), // 어제 14시
        collectedAt: now,
        updatedAt: now,
      },
      
      // Confluence 신규 기능
      {
        id: '5',
        crNumber: this.generateCRNumber(5),
        source: 'confluence',
        sourceId: 'comment_002',
        requesterId: 'conf_user_002',
        requesterName: '정과장',
        requesterEmail: 'manager.jung@company.com',
        title: '다크모드 지원 추가 요청',
        description: '야간 작업이 많은 사용자들을 위해 다크모드 기능 추가를 요청드립니다. 최근 경쟁사 제품들은 모두 지원하고 있습니다.',
        category: 'new_feature',
        priority: 'medium',
        channelName: 'Confluence: 제품 개선 요청',
        originalUrl: 'https://company.atlassian.net/wiki/spaces/PROD/pages/789012',
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 15 * 3600000), // 어제 15시
        collectedAt: now,
        updatedAt: now,
      },
      
      // Slack 개선 요청
      {
        id: '6',
        crNumber: this.generateCRNumber(6),
        source: 'slack',
        sourceId: 'msg_003',
        requesterId: 'U345678',
        requesterName: '강대리',
        requesterEmail: 'daelee.kang@customer.com',
        title: '검색 필터 기능 개선 요청',
        description: '현재 검색 필터가 너무 단순합니다. 날짜 범위, 카테고리별 필터링 기능을 추가해주세요.',
        category: 'improvement',
        priority: 'low',
        channelId: 'C789012',
        channelName: 'product-feedback',
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 16 * 3600000), // 어제 16시
        collectedAt: now,
        updatedAt: now,
      },
      
      // Figma 개선 제안
      {
        id: '7',
        crNumber: this.generateCRNumber(7),
        source: 'figma',
        sourceId: 'figma_comment_002',
        requesterId: 'figma_pm_001',
        requesterName: '송PM',
        requesterEmail: 'pm.song@company.com',
        title: '온보딩 플로우 개선 제안',
        description: '신규 사용자 온보딩 과정이 너무 복잡합니다. 단계를 줄이고 핵심 기능만 먼저 소개하는 방식으로 개선하면 좋겠습니다.',
        category: 'improvement',
        priority: 'medium',
        channelName: 'Figma: Onboarding Flow Design',
        originalUrl: 'https://www.figma.com/file/def456/Onboarding?node-id=789',
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 17 * 3600000), // 어제 17시
        collectedAt: now,
        updatedAt: now,
      },
      
      // Slack 긴급 장애
      {
        id: '8',
        crNumber: this.generateCRNumber(8),
        source: 'slack',
        sourceId: 'msg_004',
        requesterId: 'U901234',
        requesterName: '윤부장',
        requesterEmail: 'manager.yoon@vip.com',
        customerCompany: 'VIP Customer Corp',
        title: 'API 응답 속도가 매우 느림',
        description: 'ASAP! API 응답이 평소보다 10배 이상 느립니다. 전체 서비스가 영향받고 있습니다. 긴급 확인 부탁드립니다.',
        category: 'bug',
        priority: 'urgent',
        channelId: 'C123456',
        channelName: 'customer-support',
        attachments: ['performance_report.pdf'],
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 18 * 3600000), // 어제 18시
        collectedAt: now,
        updatedAt: now,
      },
      
      // Confluence 문의
      {
        id: '9',
        crNumber: this.generateCRNumber(9),
        source: 'confluence',
        sourceId: 'comment_003',
        requesterId: 'conf_user_003',
        requesterName: '한사원',
        requesterEmail: 'sawon.han@company.com',
        title: 'API 문서 업데이트 요청',
        description: '최근 변경된 API 엔드포인트가 문서에 반영되지 않았습니다. 문서 업데이트를 요청합니다.',
        category: 'inquiry',
        priority: 'low',
        channelName: 'Confluence: API Documentation',
        originalUrl: 'https://company.atlassian.net/wiki/spaces/API/pages/345678',
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 19 * 3600000), // 어제 19시
        collectedAt: now,
        updatedAt: now,
      },
      
      // Figma 신규 기능
      {
        id: '10',
        crNumber: this.generateCRNumber(10),
        source: 'figma',
        sourceId: 'figma_comment_003',
        requesterId: 'figma_designer_002',
        requesterName: '조디자이너',
        requesterEmail: 'designer.cho@company.com',
        title: '협업 코멘트 기능 추가',
        description: '디자인 리뷰 시 특정 영역에 코멘트를 남길 수 있는 기능이 필요합니다. Figma처럼 핀을 꽂는 방식이면 좋겠습니다.',
        category: 'new_feature',
        priority: 'medium',
        channelName: 'Figma: Collaboration Features',
        originalUrl: 'https://www.figma.com/file/ghi789/Collaboration?node-id=123',
        status: 'new',
        requestedAt: new Date(yesterday.getTime() + 20 * 3600000), // 어제 20시
        collectedAt: now,
        updatedAt: now,
      }
    ];
    
    return dummyRequests;
  }
  
  private generateCRNumber(index: number): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const number = String(index).padStart(3, '0');
    return `CR-${year}${month}${day}-${number}`;
  }
}