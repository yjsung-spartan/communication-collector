const { createClient } = require('redis');
const axios = require('axios');
require('dotenv').config();

async function collectAllData() {
  console.log('🚀 Starting full data collection...');
  
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  
  const allRequests = [];
  
  // Fanlight 수집
  if (process.env.CONFLUENCE_API_TOKEN) {
    console.log('📊 Collecting Fanlight data...');
    const fanlightData = await collectFromDomain(
      process.env.CONFLUENCE_DOMAIN || 'fanlight-weplanet.atlassian.net',
      process.env.CONFLUENCE_EMAIL,
      process.env.CONFLUENCE_API_TOKEN,
      'Fanlight'
    );
    allRequests.push(...fanlightData);
    console.log(`✅ Fanlight: ${fanlightData.length} items collected`);
  }
  
  // Momgleedu 수집
  if (process.env.CONFLUENCE_API_TOKEN) {
    console.log('📊 Collecting Momgleedu data...');
    const momgleeduData = await collectFromDomain(
      process.env.MOMGLEEDU_CONFLUENCE_DOMAIN || 'momgle-edu.atlassian.net',
      process.env.CONFLUENCE_EMAIL,
      process.env.CONFLUENCE_API_TOKEN,
      'Momgleedu'
    );
    allRequests.push(...momgleeduData);
    console.log(`✅ Momgleedu: ${momgleeduData.length} items collected`);
  }
  
  // Redis에 저장
  const data = {
    success: true,
    timestamp: new Date().toISOString(),
    total: allRequests.length,
    data: {
      total: allRequests.length,
      requests: allRequests
    },
    sources: {
      confluence: allRequests.length,
      figma: 0,
      slack: 0
    }
  };
  
  // 다양한 필터로 캐싱
  await redis.setEx('requests:all:30', 86400, JSON.stringify(data)); // 24시간
  await redis.setEx('requests:all:7', 86400, JSON.stringify({
    ...data,
    data: {
      ...data.data,
      requests: allRequests.filter(r => {
        const days = Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / (1000 * 60 * 60 * 24));
        return days <= 7;
      })
    }
  }));
  
  // 프로젝트별 캐싱
  const fanlightOnly = allRequests.filter(r => r.channelName === 'Fanlight');
  const momgleeduOnly = allRequests.filter(r => r.channelName === 'Momgleedu');
  
  await redis.setEx('requests:fanlight:30', 86400, JSON.stringify({
    ...data,
    total: fanlightOnly.length,
    data: { total: fanlightOnly.length, requests: fanlightOnly }
  }));
  
  await redis.setEx('requests:momgleedu:30', 86400, JSON.stringify({
    ...data,
    total: momgleeduOnly.length,
    data: { total: momgleeduOnly.length, requests: momgleeduOnly }
  }));
  
  await redis.disconnect();
  
  console.log(`\n🎉 Collection complete!`);
  console.log(`📊 Total: ${allRequests.length} items`);
  console.log(`   - Fanlight: ${fanlightOnly.length}`);
  console.log(`   - Momgleedu: ${momgleeduOnly.length}`);
  console.log(`   - Pages: ${allRequests.filter(r => r.category === 'documentation').length}`);
  console.log(`   - Comments: ${allRequests.filter(r => r.category === 'comment').length}`);
}

async function collectFromDomain(domain, email, token, projectName) {
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const allData = [];
  
  try {
    // 모든 페이지 가져오기 (페이지네이션)
    let start = 0;
    let hasMore = true;
    const limit = 50;
    
    while (hasMore) {
      console.log(`  Fetching pages ${start} to ${start + limit}...`);
      const pagesUrl = `https://${domain}/wiki/rest/api/content?type=page&start=${start}&limit=${limit}&expand=version`;
      
      const response = await axios.get(pagesUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });
      
      const data = response.data;
      
      // 페이지 추가
      for (const page of data.results || []) {
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
      
      // 다음 페이지 확인
      hasMore = data._links?.next !== undefined;
      start += limit;
      
      if (!hasMore || start >= 200) break; // 최대 200개
    }
    
    console.log(`  Found ${allData.length} pages, fetching comments...`);
    
    // 각 페이지의 댓글 수집
    let commentCount = 0;
    for (let i = 0; i < allData.length && i < 100; i++) { // 최대 100개 페이지의 댓글
      const page = allData[i];
      const pageId = page.id.replace('PAGE-', '');
      
      try {
        const commentsUrl = `https://${domain}/wiki/rest/api/content/${pageId}/child/comment?expand=body.view,version&limit=50`;
        const commentsResponse = await axios.get(commentsUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        });
        
        for (const comment of commentsResponse.data.results || []) {
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
            originalUrl: page.originalUrl,
            daysElapsed: Math.floor((Date.now() - new Date(comment.version?.when || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
          });
          commentCount++;
        }
      } catch (error) {
        // 댓글 수집 실패 무시
      }
      
      // Progress 표시
      if (i % 10 === 0) {
        console.log(`  Processed ${i}/${allData.length} pages, found ${commentCount} comments so far...`);
      }
    }
    
    console.log(`  Total comments found: ${commentCount}`);
    
  } catch (error) {
    console.error(`Error fetching from ${domain}:`, error.message);
  }
  
  return allData;
}

// 실행
collectAllData().catch(console.error);