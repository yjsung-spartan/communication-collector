// 실제 Confluence/Figma 데이터 수집 함수
import fetch from 'node-fetch';

interface ConfluenceComment {
  id: string;
  body: {
    storage: {
      value: string;
    };
  };
  version: {
    by: {
      displayName: string;
      email: string;
    };
    when: string;
  };
}

interface FigmaComment {
  id: string;
  message: string;
  user: {
    handle: string;
    img_url: string;
  };
  created_at: string;
  resolved_at: string | null;
}

export async function collectFromConfluence() {
  const domain = process.env.CONFLUENCE_DOMAIN || 'fanlight-weplanet.atlassian.net';
  const email = process.env.CONFLUENCE_EMAIL || 'project.manager@weplanet.co.kr';
  const token = process.env.CONFLUENCE_API_TOKEN;
  
  if (!token) {
    console.log('Confluence API token not configured');
    return [];
  }
  
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const requests: any[] = [];
  
  try {
    // 최근 업데이트된 페이지 가져오기
    const pagesResponse = await fetch(
      `https://${domain}/wiki/rest/api/content?type=page&limit=10&orderby=-modified&expand=version,body.storage`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!pagesResponse.ok) {
      console.error('Confluence API error:', pagesResponse.status);
      return [];
    }
    
    const pagesData = await pagesResponse.json() as any;
    
    // 각 페이지의 댓글 확인
    for (const page of pagesData.results || []) {
      const commentsResponse = await fetch(
        `https://${domain}/wiki/rest/api/content/${page.id}/child/comment?expand=body.storage,version`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        }
      );
      
      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json() as any;
        
        for (const comment of commentsData.results || []) {
          const text = comment.body?.storage?.value || '';
          const keywords = ['요청', '문의', '개선', '버그', '오류', '필요'];
          
          if (keywords.some(keyword => text.includes(keyword))) {
            requests.push({
              id: `CONF-${comment.id}`,
              crNumber: `CR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${requests.length + 1}`,
              source: 'confluence',
              requesterName: comment.version?.by?.displayName || 'Unknown',
              requesterEmail: comment.version?.by?.email || '',
              title: `${page.title} - 댓글`,
              description: text.replace(/<[^>]*>/g, '').substring(0, 200),
              category: text.includes('버그') || text.includes('오류') ? 'bug' : 'improvement',
              priority: text.includes('긴급') || text.includes('급함') ? 'urgent' : 'medium',
              status: 'open',
              channelName: domain.includes('fanlight') ? 'Fanlight' : 'Momgle',
              pageTitle: page.title,
              pageUrl: `https://${domain}/wiki${page._links.webui}`,
              requestedAt: new Date(comment.version?.when || Date.now()),
              lastUpdatedAt: new Date(comment.version?.when || Date.now()),
              metadata: {
                confluencePageId: page.id,
                commentId: comment.id
              }
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error collecting from Confluence:', error);
  }
  
  return requests;
}

export async function collectFromFigma() {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  const fileKeys = process.env.FIGMA_FILE_KEYS?.split(',') || [];
  
  if (!token || fileKeys.length === 0) {
    console.log('Figma not configured');
    return [];
  }
  
  const requests: any[] = [];
  
  try {
    for (const fileKey of fileKeys) {
      const response = await fetch(
        `https://api.figma.com/v1/files/${fileKey.trim()}/comments`,
        {
          headers: {
            'X-Figma-Token': token
          }
        }
      );
      
      if (!response.ok) {
        console.error('Figma API error:', response.status);
        continue;
      }
      
      const data = await response.json() as any;
      
      for (const comment of data.comments || []) {
        if (!comment.resolved_at) {  // 미해결 댓글만
          const keywords = ['요청', '수정', '변경', '개선', '검토'];
          const message = comment.message || '';
          
          if (keywords.some(keyword => message.includes(keyword))) {
            requests.push({
              id: `FIGMA-${comment.id}`,
              crNumber: `CR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${1000 + requests.length}`,
              source: 'figma',
              requesterName: comment.user?.handle || 'Unknown',
              requesterEmail: '',
              title: `Figma 디자인 피드백`,
              description: message.substring(0, 200),
              category: 'design',
              priority: message.includes('긴급') ? 'high' : 'medium',
              status: comment.resolved_at ? 'resolved' : 'open',
              channelName: 'Design',
              pageTitle: `File ${fileKey}`,
              pageUrl: `https://www.figma.com/file/${fileKey}`,
              requestedAt: new Date(comment.created_at),
              lastUpdatedAt: new Date(comment.created_at),
              metadata: {
                figmaFileKey: fileKey,
                commentId: comment.id
              }
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error collecting from Figma:', error);
  }
  
  return requests;
}

export async function collectAllRealData() {
  console.log('Collecting real data from Confluence and Figma...');
  
  const [confluenceData, figmaData] = await Promise.all([
    collectFromConfluence(),
    collectFromFigma()
  ]);
  
  const allData = [...confluenceData, ...figmaData];
  
  console.log(`Collected ${allData.length} requests (Confluence: ${confluenceData.length}, Figma: ${figmaData.length})`);
  
  return allData;
}