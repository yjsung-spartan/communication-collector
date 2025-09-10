import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testAllComments() {
  const auth = Buffer.from(`${process.env.CONFLUENCE_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64');
  const domain = process.env.CONFLUENCE_DOMAIN;
  
  console.log('🔍 모든 페이지를 순회하며 댓글 확인...\n');
  
  try {
    // 1. 먼저 최근 180일 내 수정된 모든 페이지 가져오기
    const pagesRes = await axios.get(`https://${domain}/wiki/rest/api/content/search`, {
      params: {
        cql: 'type=page and lastmodified >= now("-180d")',
        limit: 100,  // 더 많은 페이지 조회
        expand: 'space'
      },
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    const pages = pagesRes.data.results || [];
    console.log(`✅ 총 ${pages.length}개 페이지 발견\n`);
    
    let totalComments = 0;
    let pagesWithComments = [];
    
    // 2. 각 페이지의 댓글 확인
    for (const page of pages) {
      try {
        const commentsRes = await axios.get(
          `https://${domain}/wiki/rest/api/content/${page.id}/child/comment`,
          {
            params: {
              expand: 'body.view,history'
            },
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const comments = commentsRes.data.results || [];
        if (comments.length > 0) {
          totalComments += comments.length;
          pagesWithComments.push({
            pageTitle: page.title,
            pageId: page.id,
            space: page.space?.name,
            commentCount: comments.length,
            comments: comments.map((c: any) => ({
              id: c.id,
              author: c.history?.createdBy?.displayName || 'Unknown',
              text: (c.body?.view?.value || '').replace(/<[^>]*>/g, ' ').substring(0, 100)
            }))
          });
        }
      } catch (err) {
        // 댓글 조회 실패 시 무시
      }
    }
    
    console.log(`📊 댓글 통계:`);
    console.log(`   - 총 댓글 수: ${totalComments}개`);
    console.log(`   - 댓글이 있는 페이지: ${pagesWithComments.length}개\n`);
    
    if (pagesWithComments.length > 0) {
      console.log(`💬 댓글이 있는 페이지 목록:\n`);
      pagesWithComments.forEach(p => {
        console.log(`📄 "${p.pageTitle}" (${p.space})`);
        console.log(`   페이지 ID: ${p.pageId}`);
        console.log(`   댓글 수: ${p.commentCount}개`);
        p.comments.forEach((c: any) => {
          console.log(`   - [${c.author}]: ${c.text}...`);
        });
        console.log('');
      });
    }
    
  } catch (err: any) {
    console.error('오류:', err.response?.data || err.message);
  }
}

testAllComments();