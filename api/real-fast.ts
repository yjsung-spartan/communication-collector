// Vercel Serverless Function - 실제 Confluence 페이지만 빠르게 가져오기 (댓글 제외)
export default async function handler(req: any, res: any) {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 파라미터 파싱
  const project = searchParams.get('project') || 'all';
  const days = parseInt(searchParams.get('days') || '30');
  
  // Confluence API 호출 - 댓글 중심으로 수집
  async function fetchConfluencePages(domain: string, email: string, token: string) {
    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    
    try {
      // 페이지 가져오기 (많은 페이지 확인)
      const searchUrl = `https://${domain}/wiki/rest/api/content?type=page&limit=50&expand=version`;
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch from ${domain}: ${response.status} - ${errorText}`);
        return [];
      }
      
      const data = await response.json();
      const projectName = domain.includes('fanlight') ? 'Fanlight' : 'Momgleedu';
      const allRequests: any[] = [];
      
      // 페이지 자체도 추가 (최대 10개)
      for (const page of (data.results || []).slice(0, 10)) {
        allRequests.push({
          id: `PAGE-${page.id}`,
          crNumber: `CR-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${page.id}`,
          source: 'confluence',
          requesterName: page.version?.by?.displayName || 'Unknown',
          title: page.title || 'Untitled',
          description: `Page: ${page.title}`,
          category: 'documentation',
          priority: 'medium',
          channelName: projectName,
          requestedAt: page.version?.when || new Date().toISOString(),
          status: 'open',
          originalUrl: `https://${domain}/wiki${page._links?.webui || `/spaces/${page.space?.key}/pages/${page.id}`}`,
          daysElapsed: Math.floor((Date.now() - new Date(page.version?.when || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
        });
      }
      
      // 각 페이지의 댓글 수집 (timeout 방지를 위해 3개 페이지만)
      let pagesChecked = 0;
      for (const page of data.results || []) {
        if (pagesChecked >= 3) break;
        pagesChecked++;
        
        try {
          const commentsUrl = `https://${domain}/wiki/rest/api/content/${page.id}/child/comment?expand=body.view,version&limit=20`;
          const commentsResponse = await fetch(commentsUrl, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          });
          
          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            for (const comment of commentsData.results || []) {
              allRequests.push({
                id: `COMMENT-${comment.id}`,
                crNumber: `CR-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-C${comment.id}`,
                source: 'confluence',
                requesterName: comment.version?.by?.displayName || 'Unknown',
                title: `Comment on: ${page.title}`,
                description: comment.body?.view?.value?.replace(/<[^>]*>/g, '').substring(0, 500) || comment.title || '',
                category: 'comment',
                priority: 'medium',
                channelName: projectName,
                requestedAt: comment.version?.when || new Date().toISOString(),
                status: 'open',
                originalUrl: `https://${domain}/wiki${page._links?.webui || `/spaces/${page.space?.key}/pages/${page.id}`}`,
                daysElapsed: Math.floor((Date.now() - new Date(comment.version?.when || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching comments for page ${page.id}:`, error);
        }
      }
      
      return allRequests;
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
      },
      envCheck: {
        fanlight: {
          hasToken: !!process.env.CONFLUENCE_API_TOKEN,
          hasDomain: !!process.env.CONFLUENCE_DOMAIN,
          hasEmail: !!process.env.CONFLUENCE_EMAIL,
          domain: process.env.CONFLUENCE_DOMAIN || 'not set',
          email: process.env.CONFLUENCE_EMAIL || 'not set'
        },
        momgleedu: {
          hasToken: !!process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN,
          hasDomain: !!process.env.MOMGLEEDU_CONFLUENCE_DOMAIN,
          hasEmail: !!process.env.MOMGLEEDU_CONFLUENCE_EMAIL,
          domain: process.env.MOMGLEEDU_CONFLUENCE_DOMAIN || 'not set',
          email: process.env.MOMGLEEDU_CONFLUENCE_EMAIL || 'not set'
        }
      }
    });
  }
  
  if (pathname === '/requests' || pathname === '/api/requests') {
    let allRequests: any[] = [];
    const debugInfo: any = {
      fanlight: { attempted: false, success: false, count: 0, error: null, hasEnv: false },
      momgleedu: { attempted: false, success: false, count: 0, error: null, hasEnv: false }
    };
    
    try {
      // Fanlight 데이터
      if ((project === 'all' || project === 'fanlight')) {
        debugInfo.fanlight.attempted = true;
        if (process.env.CONFLUENCE_API_TOKEN && 
            process.env.CONFLUENCE_DOMAIN && 
            process.env.CONFLUENCE_EMAIL) {
          try {
            const fanlightPages = await fetchConfluencePages(
              process.env.CONFLUENCE_DOMAIN,
              process.env.CONFLUENCE_EMAIL,
              process.env.CONFLUENCE_API_TOKEN
            );
            allRequests = [...allRequests, ...fanlightPages];
            debugInfo.fanlight.success = true;
            debugInfo.fanlight.count = fanlightPages.length;
          } catch (e: any) {
            debugInfo.fanlight.error = e.message;
          }
        } else {
          debugInfo.fanlight.error = 'Missing environment variables';
        }
      }
      
      // Momgleedu 데이터 (같은 이메일과 토큰 사용!)
      if ((project === 'all' || project === 'momgleedu' || project === 'momgle-edu')) {
        debugInfo.momgleedu.attempted = true;
        if (process.env.CONFLUENCE_API_TOKEN && 
            process.env.MOMGLEEDU_CONFLUENCE_DOMAIN && 
            process.env.CONFLUENCE_EMAIL) {
          try {
            const momgleeduPages = await fetchConfluencePages(
              process.env.MOMGLEEDU_CONFLUENCE_DOMAIN,
              process.env.CONFLUENCE_EMAIL,
              process.env.CONFLUENCE_API_TOKEN
            );
            allRequests = [...allRequests, ...momgleeduPages];
            debugInfo.momgleedu.success = true;
            debugInfo.momgleedu.count = momgleeduPages.length;
          } catch (e: any) {
            debugInfo.momgleedu.error = e.message;
          }
        } else {
          debugInfo.momgleedu.error = 'Missing environment variables';
        }
      }
    } catch (error: any) {
      console.error('Error collecting data:', error);
    }
    
    // 날짜별 정렬
    allRequests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      total: allRequests.length,
      data: {
        total: allRequests.length,
        requests: allRequests
      },
      filters: { project, days },
      sources: {
        confluence: allRequests.length,
        figma: 0,
        slack: 0
      }
    });
  }
  
  if (pathname === '/summary' || pathname === '/api/summary') {
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
  
  return res.status(404).json({ error: 'Not found' });
}