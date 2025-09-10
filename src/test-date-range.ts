import { config } from 'dotenv';
import axios from 'axios';

config();

async function testWithDateRange(days: number = 7) {
  const domain = process.env.CONFLUENCE_DOMAIN;
  const email = process.env.CONFLUENCE_EMAIL;
  const token = process.env.CONFLUENCE_API_TOKEN;

  if (!domain || !email || !token) {
    console.error('❌ Confluence 환경변수가 설정되지 않았습니다.');
    return;
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const baseURL = `https://${domain}/wiki/rest/api`;

  console.log(`📅 Testing with date range: Last ${days} days\n`);

  // 날짜 계산
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  console.log(`   Start: ${startDate.toISOString().split('T')[0]}`);
  console.log(`   End:   ${endDate.toISOString().split('T')[0]}\n`);

  try {
    // 1. 지정된 기간 내 수정된 페이지 조회
    const cql = `type=page and lastmodified >= "${startDate.toISOString().split('T')[0]}"`;
    
    const searchResponse = await axios.get(`${baseURL}/content/search`, {
      headers: { Authorization: `Basic ${auth}` },
      params: {
        cql,
        limit: 100,
        expand: 'history,version'
      }
    });

    const pages = searchResponse.data.results;
    console.log(`✅ Found ${pages.length} pages modified in last ${days} days\n`);

    // 2. 각 페이지의 댓글 확인 (기간 필터링)
    let totalComments = 0;
    let filteredComments = 0;
    const commentsByDate: { [key: string]: number } = {};

    for (const page of pages) {
      try {
        const commentsUrl = `${baseURL}/content/${page.id}/child/comment`;
        const commentsResponse = await axios.get(commentsUrl, {
          headers: { Authorization: `Basic ${auth}` },
          params: { 
            expand: 'body.view,history,version',
            limit: 100
          }
        });

        const comments = commentsResponse.data.results || [];
        totalComments += comments.length;

        // 날짜 필터링
        for (const comment of comments) {
          const commentDate = new Date(comment.history?.createdDate || comment.version?.when);
          
          if (commentDate >= startDate && commentDate <= endDate) {
            filteredComments++;
            
            // 날짜별 집계
            const dateKey = commentDate.toISOString().split('T')[0];
            commentsByDate[dateKey] = (commentsByDate[dateKey] || 0) + 1;
          }
        }
      } catch (error) {
        // 댓글 조회 실패 무시
      }
    }

    // 3. 결과 출력
    console.log('📊 Summary:');
    console.log(`   Total comments found: ${totalComments}`);
    console.log(`   Comments in date range: ${filteredComments}\n`);

    // 날짜별 분포
    if (Object.keys(commentsByDate).length > 0) {
      console.log('📈 Comments by date:');
      const sortedDates = Object.keys(commentsByDate).sort();
      for (const date of sortedDates.slice(-10)) { // 최근 10일만 표시
        const bar = '█'.repeat(Math.min(commentsByDate[date], 20));
        console.log(`   ${date}: ${bar} (${commentsByDate[date]})`);
      }
    }

    // 4. 주간/월간 통계
    console.log('\n📅 Period Statistics:');
    const last7Days = Object.keys(commentsByDate)
      .filter(date => {
        const d = new Date(date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      })
      .reduce((sum, date) => sum + commentsByDate[date], 0);

    const last30Days = Object.keys(commentsByDate)
      .filter(date => {
        const d = new Date(date);
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        return d >= monthAgo;
      })
      .reduce((sum, date) => sum + commentsByDate[date], 0);

    console.log(`   Last 7 days: ${last7Days} comments`);
    console.log(`   Last 30 days: ${last30Days} comments`);

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
  }
}

// CLI 인자 처리
const days = parseInt(process.argv[2]) || 30;
testWithDateRange(days);