import { config } from 'dotenv';
import axios from 'axios';

config();

async function testMomgleedu() {
  const domain = process.env.MOMGLEEDU_CONFLUENCE_DOMAIN;
  const email = process.env.MOMGLEEDU_CONFLUENCE_EMAIL;
  const token = process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN;

  if (!domain || !email || !token) {
    console.error('❌ Momgleedu Confluence 환경변수가 설정되지 않았습니다.');
    return;
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const baseURL = `https://${domain}/wiki/rest/api`;

  console.log('🎓 Testing Momgleedu Confluence API...\n');
  console.log(`Domain: ${domain}`);
  console.log(`Email: ${email}\n`);

  try {
    // 1. 스페이스 목록 조회
    console.log('1️⃣ Getting spaces...');
    const spacesResponse = await axios.get(`${baseURL}/space`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    
    const spaces = spacesResponse.data.results;
    console.log(`✅ Found ${spaces.length} spaces`);
    spaces.forEach((space: any) => {
      console.log(`   - ${space.name} (${space.key})`);
    });

    // 2. 최근 업데이트된 페이지 조회
    console.log('\n2️⃣ Getting recent pages...');
    const pagesResponse = await axios.get(`${baseURL}/content`, {
      headers: { Authorization: `Basic ${auth}` },
      params: {
        type: 'page',
        limit: 100,
        expand: 'children.comment.body.view,history'
      }
    });

    const pages = pagesResponse.data.results;
    console.log(`✅ Found ${pages.length} pages\n`);

    // 3. 댓글 수집
    console.log('3️⃣ Checking for comments...');
    let totalComments = 0;
    let pagesWithComments = 0;

    for (const page of pages) {
      const commentsUrl = `${baseURL}/content/${page.id}/child/comment`;
      try {
        const commentsResponse = await axios.get(commentsUrl, {
          headers: { Authorization: `Basic ${auth}` },
          params: { expand: 'body.view,history,version' }
        });

        const comments = commentsResponse.data.results;
        if (comments && comments.length > 0) {
          totalComments += comments.length;
          pagesWithComments++;
          
          console.log(`\n📄 "${page.title}"`);
          console.log(`   Page ID: ${page.id}`);
          console.log(`   Comments: ${comments.length}`);
          
          // 첫 번째 댓글 샘플 출력
          if (comments[0]) {
            const comment = comments[0];
            const author = comment.history?.createdBy?.displayName || 'Unknown';
            const content = comment.body?.view?.value
              ?.replace(/<[^>]*>/g, '')
              ?.substring(0, 100) || '';
            console.log(`   Sample: [${author}]: ${content}...`);
          }
        }
      } catch (error) {
        // 댓글 조회 실패는 무시 (권한 없을 수 있음)
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total pages checked: ${pages.length}`);
    console.log(`   Pages with comments: ${pagesWithComments}`);
    console.log(`   Total comments: ${totalComments}`);

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    if (error.response?.status === 401) {
      console.error('   인증 실패 - API 토큰을 확인해주세요');
    }
  }
}

testMomgleedu();