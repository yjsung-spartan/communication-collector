import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testPagesDetail() {
  const auth = Buffer.from(`${process.env.CONFLUENCE_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64');
  const domain = process.env.CONFLUENCE_DOMAIN;
  
  console.log('🔍 페이지 상세 정보 확인...\n');
  
  try {
    // 먼저 최근 페이지 몇 개 가져오기
    const res = await axios.get(`https://${domain}/wiki/rest/api/content/search`, {
      params: {
        cql: 'type=page and lastmodified >= now("-180d")',
        limit: 5,
        expand: 'body.view,history.lastUpdated,space'
      },
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`✅ ${res.data.results.length}개 페이지 발견\n`);
    
    // 각 페이지의 댓글 확인
    for (const page of res.data.results) {
      console.log(`📄 페이지: ${page.title}`);
      console.log(`   ID: ${page.id}`);
      console.log(`   Space: ${page.space?.name}`);
      console.log(`   수정일: ${page.history?.lastUpdated?.when}`);
      
      // 이 페이지의 댓글 가져오기
      try {
        const commentsRes = await axios.get(
          `https://${domain}/wiki/rest/api/content/${page.id}/child/comment`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const comments = commentsRes.data.results || [];
        console.log(`   💬 댓글 수: ${comments.length}개`);
        
        if (comments.length > 0) {
          comments.slice(0, 2).forEach((comment: any) => {
            const text = comment.body?.view?.value || '';
            const cleanText = text.replace(/<[^>]*>/g, ' ').substring(0, 100);
            console.log(`      - ${cleanText}...`);
          });
        }
      } catch (err) {
        console.log(`   ⚠️ 댓글 조회 실패`);
      }
      
      console.log('');
    }
    
  } catch (err: any) {
    console.error('오류:', err.response?.data || err.message);
  }
}

testPagesDetail();