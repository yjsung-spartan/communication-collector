// Vercel Serverless Function용 간단한 핸들러
export default async function handler(req: any, res: any) {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 실제같은 데이터 생성 - 프로젝트별로 더 많은 데이터
  const now = new Date();
  const generateRequests = (project: string) => {
    const baseData = {
      fanlight: [
        { requesterName: 'heather', title: '로그인 화면 개선 요청', description: '소셜 로그인 버튼이 너무 작아서 터치가 어렵습니다.' },
        { requesterName: '김PM', title: '결제 프로세스 오류', description: '쿠폰 적용시 할인이 반영되지 않습니다.' },
        { requesterName: 'Lucy', title: 'UI 색상 변경 요청', description: '다크모드에서 텍스트 가독성이 떨어집니다.' },
        { requesterName: 'client_01', title: '알림 기능 개선', description: '푸시 알림이 늦게 도착합니다.' },
        { requesterName: 'heather', title: '검색 필터 추가', description: '날짜별 필터링 기능이 필요합니다.' }
      ],
      momgleedu: [
        { requesterName: '최지선', title: '비디오 재생 오류', description: '특정 영상이 재생되지 않습니다.' },
        { requesterName: 'PM_Lee', title: '회원가입 프로세스', description: '이메일 인증이 작동하지 않습니다.' },
        { requesterName: 'client_02', title: '콘텐츠 정렬 문제', description: '최신순 정렬이 제대로 안됩니다.' },
        { requesterName: '박고객', title: '결제 오류 신고', description: '카드 결제가 진행되지 않습니다.' },
        { requesterName: 'Lucy', title: '관리자 페이지 접근', description: '권한이 있는데도 접근이 안됩니다.' }
      ]
    };
    
    const projectData = project === 'momgleedu' ? baseData.momgleedu : baseData.fanlight;
    return projectData.map((item, index) => ({
      id: `${project.toUpperCase()}-${index + 1}`,
      crNumber: `CR-${now.toISOString().split('T')[0].replace(/-/g, '')}-${project.substring(0, 3).toUpperCase()}${index + 1}`,
      source: 'confluence',
      requesterName: item.requesterName,
      title: item.title,
      description: item.description,
      category: 'feature_request',
      priority: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
      channelName: project === 'momgleedu' ? 'Momgleedu' : 'Fanlight',
      requestedAt: new Date(now.getTime() - (index * 86400000)).toISOString(),
      daysElapsed: index,
      status: 'open',
      originalUrl: `https://${project === 'momgleedu' ? 'momgle-edu' : 'fanlight-weplanet'}.atlassian.net/wiki/spaces/DOCS/pages/${1000 + index}`
    }));
  };
  
  const mockData = [...generateRequests('fanlight'), ...generateRequests('momgleedu')];
  
  // 라우팅
  if (pathname === '/health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }
  
  if (pathname === '/api/requests' || pathname === '/requests') {
    // 파라미터 파싱
    const project = searchParams.get('project') || 'all';
    const days = parseInt(searchParams.get('days') || '30');
    
    // 프로젝트 필터링
    let filteredData = mockData;
    if (project !== 'all') {
      filteredData = mockData.filter(req => {
        if (project === 'fanlight') {
          return req.originalUrl.includes('fanlight-weplanet');
        } else if (project === 'momgleedu' || project === 'momgle-edu') {
          return req.originalUrl.includes('momgle-edu');
        }
        return false;
      });
    }
    
    // 날짜 필터링
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    filteredData = filteredData.filter(req => 
      new Date(req.requestedAt) >= cutoffDate
    );
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      total: filteredData.length,
      data: {
        total: filteredData.length,
        requests: filteredData
      },
      filters: { project, days },
      sources: {
        confluence: filteredData.filter(r => r.source === 'confluence').length,
        figma: 0,
        slack: 0
      }
    });
  }
  
  if (pathname === '/api/summary' || pathname === '/summary') {
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        total: mockData.length,
        bySource: { confluence: 1, figma: 0, slack: 0 },
        byPriority: { high: 1, medium: 0, low: 0 }
      }
    });
  }
  
  // 404
  return res.status(404).json({ error: 'Not found' });
}