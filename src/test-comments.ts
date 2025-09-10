import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testComments() {
  const auth = Buffer.from(`${process.env.CONFLUENCE_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64');
  const domain = process.env.CONFLUENCE_DOMAIN;
  
  console.log('🔍 댓글만 검색...');
  
  try {
    // 최근 90일 댓글 검색
    const res = await axios.get(`https://${domain}/wiki/rest/api/content/search`, {
      params: {
        cql: 'type=comment and created >= now("-90d")',
        limit: 20,
        expand: 'body.view,container,history,space'
      },
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`✅ ${res.data.results.length}개 댓글 발견\n`);
    
    res.data.results.forEach((comment: any) => {
      const text = comment.body?.view?.value || '';
      const cleanText = text.replace(/<[^>]*>/g, ' ').substring(0, 200);
      const containerTitle = comment.container?.title || 'Unknown Page';
      const author = comment.history?.createdBy?.displayName || 
                     comment.history?.lastUpdated?.by?.displayName || 'Unknown';
      
      console.log(`💬 댓글 on "${containerTitle}"`);
      console.log(`   작성자: ${author}`);
      console.log(`   내용: ${cleanText}...`);
      console.log(`   작성일: ${comment.history?.created?.when || comment.history?.lastUpdated?.when}`);
      console.log('');
    });
    
  } catch (err: any) {
    console.error('오류:', err.response?.data || err.message);
  }
}

testComments();