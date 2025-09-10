import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testConfluencePages() {
  const domain = process.env.CONFLUENCE_DOMAIN!;
  const email = process.env.CONFLUENCE_EMAIL!;
  const apiToken = process.env.CONFLUENCE_API_TOKEN!;
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  
  console.log('🔍 Confluence 페이지 검색 테스트...\n');
  
  try {
    // 1. 최근 수정된 페이지 검색
    console.log('1️⃣ 최근 수정된 페이지 조회...');
    const recentPages = await axios.get(
      `https://${domain}/wiki/rest/api/content/search`,
      {
        params: {
          cql: 'type=page and lastmodified >= now("-30d")',
          limit: 10,
          expand: 'body.view,history.lastUpdated'
        },
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log(`✅ 최근 30일 내 수정된 페이지: ${recentPages.data.results.length}개\n`);
    
    if (recentPages.data.results.length > 0) {
      console.log('📄 샘플 페이지:');
      recentPages.data.results.slice(0, 5).forEach((page: any) => {
        console.log(`   - [${page.id}] ${page.title}`);
        console.log(`     Space: ${page._expandable?.space?.split('/').pop() || 'Unknown'}`);
        console.log(`     수정일: ${page.history?.lastUpdated?.when || 'Unknown'}`);
        console.log(`     작성자: ${page.history?.lastUpdated?.by?.displayName || 'Unknown'}\n`);
      });
    }
    
    // 2. 특정 키워드로 페이지 검색
    const keywords = ['요청', '문의', '버그', '개선', '이슈'];
    console.log(`2️⃣ 키워드로 페이지 검색: ${keywords.join(', ')}`);
    
    for (const keyword of keywords) {
      const searchResult = await axios.get(
        `https://${domain}/wiki/rest/api/content/search`,
        {
          params: {
            cql: `type=page and text ~ "${keyword}"`,
            limit: 5
          },
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        }
      );
      
      if (searchResult.data.results.length > 0) {
        console.log(`\n   "${keyword}" 검색 결과: ${searchResult.data.results.length}개`);
        searchResult.data.results.slice(0, 2).forEach((page: any) => {
          console.log(`      - ${page.title}`);
        });
      }
    }
    
    // 3. 댓글 검색 (다른 방법)
    console.log('\n3️⃣ 댓글 직접 검색...');
    const commentsResult = await axios.get(
      `https://${domain}/wiki/rest/api/content/search`,
      {
        params: {
          cql: 'type=comment',
          limit: 10,
          expand: 'body.view,container,history'
        },
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log(`✅ 전체 댓글: ${commentsResult.data.results.length}개`);
    
    if (commentsResult.data.results.length > 0) {
      console.log('\n💬 샘플 댓글:');
      commentsResult.data.results.slice(0, 3).forEach((comment: any) => {
        const text = extractText(comment.body?.view?.value || '').substring(0, 100);
        console.log(`   - 페이지: ${comment.container?.title || 'Unknown'}`);
        console.log(`     작성자: ${comment.history?.createdBy?.displayName || 'Unknown'}`);
        console.log(`     내용: ${text}...\n`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ 오류:', error.response?.data || error.message);
  }
}

function extractText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

testConfluencePages();