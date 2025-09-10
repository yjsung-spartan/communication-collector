import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const auth = Buffer.from(`${process.env.CONFLUENCE_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64');
  const domain = process.env.CONFLUENCE_DOMAIN;
  
  console.log('🔍 최근 7일 페이지 검색...');
  
  try {
    const res = await axios.get(`https://${domain}/wiki/rest/api/content/search`, {
      params: {
        cql: 'type=page and lastmodified >= now("-90d")',
        limit: 20,
        expand: 'body.view'
      },
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`✅ ${res.data.results.length}개 페이지 발견\n`);
    
    res.data.results.forEach((page: any) => {
      const text = page.body?.view?.value || '';
      const cleanText = text.replace(/<[^>]*>/g, ' ').substring(0, 200);
      
      console.log(`📄 ${page.title}`);
      console.log(`   내용: ${cleanText}...`);
      
      // Check if it contains request keywords
      const keywords = ['요청', '문의', '버그', '개선', '이슈'];
      const hasKeyword = keywords.some(k => 
        page.title.includes(k) || cleanText.includes(k)
      );
      
      if (hasKeyword) {
        console.log(`   ✅ 고객 요청 키워드 포함!`);
      }
      console.log('');
    });
    
  } catch (err: any) {
    console.error('오류:', err.response?.data || err.message);
  }
}

test();