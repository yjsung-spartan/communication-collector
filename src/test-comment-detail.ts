import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testCommentDetail() {
  const auth = Buffer.from(`${process.env.CONFLUENCE_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64');
  const domain = process.env.CONFLUENCE_DOMAIN;
  
  console.log('🔍 페이지 ID 8650753의 댓글 상세 조회...\n');
  
  try {
    const res = await axios.get(
      `https://${domain}/wiki/rest/api/content/8650753/child/comment`,
      {
        params: {
          expand: 'body.view,history,version'
        },
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const comments = res.data.results || [];
    console.log(`✅ ${comments.length}개 댓글 발견\n`);
    
    comments.forEach((comment: any) => {
      const text = comment.body?.view?.value || '';
      const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      console.log(`💬 댓글 ID: ${comment.id}`);
      console.log(`   작성자: ${comment.history?.createdBy?.displayName}`);
      console.log(`   작성일: ${comment.history?.created?.when}`);
      console.log(`   내용: ${cleanText}`);
      console.log('---');
    });
    
  } catch (err: any) {
    console.error('오류:', err.response?.data || err.message);
  }
}

testCommentDetail();