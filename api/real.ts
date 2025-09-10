// Vercel Serverless Function - 실제 Confluence API 직접 호출
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
  
  // 파라미터 파싱
  const project = searchParams.get('project') || 'all';
  const days = parseInt(searchParams.get('days') || '30');
  const source = searchParams.get('source') || 'all';
  
  // Confluence API 직접 호출 함수
  async function fetchConfluenceData(domain: string, email: string, token: string) {
    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    
    try {
      // 최근 수정된 페이지 가져오기
      const pagesUrl = `https://${domain}/wiki/rest/api/content?type=page&limit=50&expand=version,history`;
      const pagesResponse = await fetch(pagesUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });
      
      if (!pagesResponse.ok) {
        console.error(`Failed to fetch pages from ${domain}: ${pagesResponse.status}`);
        return [];
      }
      
      const pagesData = await pagesResponse.json();
      const requests: any[] = [];
      
      // 각 페이지의 댓글 가져오기
      for (const page of pagesData.results || []) {
        // 페이지 자체를 요청으로 추가
        requests.push({
          id: `CONF-${page.id}`,
          crNumber: `CR-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${page.id}`,
          source: 'confluence',
          requesterName: page.version?.by?.displayName || 'Unknown',
          title: page.title,
          description: `Page: ${page.title}`,
          category: 'documentation',
          priority: 'medium',
          channelName: domain.includes('fanlight') ? 'Fanlight' : 'Momgleedu',
          requestedAt: page.version?.when || new Date().toISOString(),
          status: 'open',
          originalUrl: `https://${domain}/wiki${page._links?.webui}`
        });
        
        // 댓글 가져오기
        try {
          const commentsUrl = `https://${domain}/wiki/rest/api/content/${page.id}/child/comment?expand=body.view,version`;
          const commentsResponse = await fetch(commentsUrl, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          });
          
          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            for (const comment of commentsData.results || []) {
              requests.push({
                id: `COMMENT-${comment.id}`,
                crNumber: `CR-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-C${comment.id}`,
                source: 'confluence',
                requesterName: comment.version?.by?.displayName || 'Unknown',
                title: `Comment on: ${page.title}`,
                description: comment.body?.view?.value?.replace(/<[^>]*>/g, '') || comment.title || '',
                category: 'comment',
                priority: 'medium',
                channelName: domain.includes('fanlight') ? 'Fanlight' : 'Momgleedu',
                requestedAt: comment.version?.when || new Date().toISOString(),
                status: 'open',
                originalUrl: `https://${domain}/wiki${page._links?.webui}`
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching comments for page ${page.id}:`, error);
        }
      }
      
      return requests;
    } catch (error) {
      console.error(`Error fetching from ${domain}:`, error);
      return [];
    }
  }
  
  // 라우팅
  if (pathname === '/health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dataSourcesConfigured: {
        fanlight: !!(process.env.CONFLUENCE_API_TOKEN && process.env.CONFLUENCE_DOMAIN),
        momgleedu: !!(process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN && process.env.MOMGLEEDU_CONFLUENCE_DOMAIN)
      }
    });
  }
  
  if (pathname === '/requests' || pathname === '/api/requests') {
    let allRequests: any[] = [];
    
    // Fanlight Confluence 데이터 가져오기
    if (project === 'all' || project === 'fanlight') {
      if (process.env.CONFLUENCE_API_TOKEN && process.env.CONFLUENCE_DOMAIN && process.env.CONFLUENCE_EMAIL) {
        const fanlightData = await fetchConfluenceData(
          process.env.CONFLUENCE_DOMAIN,
          process.env.CONFLUENCE_EMAIL,
          process.env.CONFLUENCE_API_TOKEN
        );
        allRequests = [...allRequests, ...fanlightData];
      }
    }
    
    // Momgleedu Confluence 데이터 가져오기
    if (project === 'all' || project === 'momgleedu' || project === 'momgle-edu') {
      if (process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN && process.env.MOMGLEEDU_CONFLUENCE_DOMAIN && process.env.MOMGLEEDU_CONFLUENCE_EMAIL) {
        const momgleeduData = await fetchConfluenceData(
          process.env.MOMGLEEDU_CONFLUENCE_DOMAIN,
          process.env.MOMGLEEDU_CONFLUENCE_EMAIL,
          process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN
        );
        allRequests = [...allRequests, ...momgleeduData];
      }
    }
    
    // 날짜 필터링
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const filteredRequests = allRequests.filter(req => 
      new Date(req.requestedAt) >= cutoffDate
    );
    
    // 경과 일수 추가
    const enrichedRequests = filteredRequests.map(req => ({
      ...req,
      daysElapsed: Math.floor((Date.now() - new Date(req.requestedAt).getTime()) / (1000 * 60 * 60 * 24)),
      isOld: Math.floor((Date.now() - new Date(req.requestedAt).getTime()) / (1000 * 60 * 60 * 24)) > 7,
      isCritical: Math.floor((Date.now() - new Date(req.requestedAt).getTime()) / (1000 * 60 * 60 * 24)) > 3 && 
                  (req.priority === 'urgent' || req.priority === 'high')
    }));
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      total: enrichedRequests.length,
      data: {
        total: enrichedRequests.length,
        requests: enrichedRequests
      },
      filters: { project, days, source },
      sources: {
        confluence: enrichedRequests.filter(r => r.source === 'confluence').length,
        figma: 0,
        slack: 0
      }
    });
  }
  
  if (pathname === '/summary' || pathname === '/api/summary') {
    // 간단한 통계만 반환
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        total: 0,
        bySource: { confluence: 0, figma: 0, slack: 0 },
        byPriority: { high: 0, medium: 0, low: 0 }
      }
    });
  }
  
  // 404
  return res.status(404).json({ error: 'Not found' });
}