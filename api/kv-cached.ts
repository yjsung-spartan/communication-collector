let kv: any;
try {
  const kvModule = require('@vercel/kv');
  kv = kvModule.kv;
} catch (e) {
  console.log('KV not available, using direct API calls');
}

// Vercel Serverless Function - KV Cache 사용
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
  
  // 라우팅
  if (pathname === '/health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dataSource: 'Vercel KV Cache'
    });
  }
  
  if (pathname === '/requests' || pathname === '/api/requests') {
    try {
      let data;
      
      // KV가 설정되어 있으면 캐시 사용
      if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const cacheKey = `requests:${project}:${days}`;
        data = await kv.get(cacheKey);
        
        if (!data) {
          data = await fetchConfluenceData(project, days);
          await kv.set(cacheKey, data, { ex: 3600 });
        }
      } else {
        // KV가 없으면 직접 API 호출
        data = await fetchConfluenceData(project, days);
      }
      
      return res.status(200).json(data);
      
    } catch (error: any) {
      console.error('Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  if (pathname === '/refresh') {
    // 캐시 강제 새로고침
    try {
      const data = await fetchConfluenceData('all', 30);
      await kv.set('requests:all:30', data, { ex: 3600 });
      
      return res.status(200).json({
        success: true,
        message: 'Cache refreshed',
        total: data.total
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  return res.status(404).json({ error: 'Not found' });
}

async function fetchConfluenceData(project: string, days: number) {
  const allRequests: any[] = [];
  
  // Fanlight 데이터
  if (project === 'all' || project === 'fanlight') {
    if (process.env.CONFLUENCE_API_TOKEN) {
      const fanlightData = await fetchFromDomain(
        process.env.CONFLUENCE_DOMAIN || 'fanlight-weplanet.atlassian.net',
        process.env.CONFLUENCE_EMAIL!,
        process.env.CONFLUENCE_API_TOKEN
      );
      allRequests.push(...fanlightData);
    }
  }
  
  // Momgleedu 데이터 (같은 토큰 사용)
  if (project === 'all' || project === 'momgleedu' || project === 'momgle-edu') {
    if (process.env.CONFLUENCE_API_TOKEN) {
      const momgleeduData = await fetchFromDomain(
        process.env.MOMGLEEDU_CONFLUENCE_DOMAIN || 'momgle-edu.atlassian.net',
        process.env.CONFLUENCE_EMAIL!,
        process.env.CONFLUENCE_API_TOKEN
      );
      allRequests.push(...momgleeduData);
    }
  }
  
  // 날짜 필터링
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const filteredRequests = allRequests.filter(req => 
    new Date(req.requestedAt) >= cutoffDate
  );
  
  // 소스별 카운트
  const sourceCount = {
    confluence: filteredRequests.length,
    figma: 0,
    slack: 0
  };
  
  return {
    success: true,
    timestamp: new Date().toISOString(),
    total: filteredRequests.length,
    data: {
      total: filteredRequests.length,
      requests: filteredRequests
    },
    filters: { project, days },
    sources: sourceCount
  };
}

async function fetchFromDomain(domain: string, email: string, token: string) {
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const allData: any[] = [];
  
  try {
    // 페이지 가져오기
    const pagesUrl = `https://${domain}/wiki/rest/api/content?type=page&limit=30&expand=version`;
    const response = await fetch(pagesUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch from ${domain}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const projectName = domain.includes('fanlight') ? 'Fanlight' : 'Momgleedu';
    
    // 페이지 추가
    for (const page of (data.results || []).slice(0, 20)) {
      allData.push({
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
        originalUrl: `https://${domain}/wiki${page._links?.webui || ''}`,
        daysElapsed: Math.floor((Date.now() - new Date(page.version?.when || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
      });
    }
    
    // 댓글 수집 (처음 5개 페이지만, timeout 방지)
    for (const page of (data.results || []).slice(0, 5)) {
      try {
        const commentsUrl = `https://${domain}/wiki/rest/api/content/${page.id}/child/comment?expand=body.view,version&limit=5`;
        const commentsResponse = await fetch(commentsUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        });
        
        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          for (const comment of commentsData.results || []) {
            allData.push({
              id: `COMMENT-${comment.id}`,
              crNumber: `CR-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-C${comment.id}`,
              source: 'confluence',
              requesterName: comment.version?.by?.displayName || 'Unknown',
              title: `Comment on: ${page.title}`,
              description: comment.body?.view?.value?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
              category: 'comment',
              priority: 'medium',
              channelName: projectName,
              requestedAt: comment.version?.when || new Date().toISOString(),
              status: 'open',
              originalUrl: `https://${domain}/wiki${page._links?.webui || ''}`,
              daysElapsed: Math.floor((Date.now() - new Date(comment.version?.when || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching comments for page ${page.id}:`, error);
      }
    }
    
  } catch (error) {
    console.error(`Error fetching from ${domain}:`, error);
  }
  
  return allData;
}