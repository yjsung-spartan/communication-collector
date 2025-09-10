import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

async function testConfluenceConnection() {
  const domain = process.env.CONFLUENCE_DOMAIN;
  const email = process.env.CONFLUENCE_EMAIL;
  const apiToken = process.env.CONFLUENCE_API_TOKEN;
  
  if (!domain || !email || !apiToken) {
    console.error('❌ Confluence 인증 정보가 없습니다.');
    console.log('📝 .env 파일에 다음 정보를 추가해주세요:');
    console.log('   CONFLUENCE_DOMAIN=yourcompany.atlassian.net');
    console.log('   CONFLUENCE_EMAIL=your.email@company.com');
    console.log('   CONFLUENCE_API_TOKEN=your-api-token');
    return;
  }
  
  console.log('🔄 Confluence 연결 테스트 중...');
  console.log(`📍 Domain: ${domain}`);
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Token: ${apiToken.substring(0, 10)}...`);
  
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  
  try {
    // 1. 연결 테스트 - 현재 사용자 정보 조회
    console.log('\n1️⃣ 사용자 정보 확인...');
    const userResponse = await axios.get(
      `https://${domain}/wiki/rest/api/user/current`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log(`✅ 연결 성공! 사용자: ${userResponse.data.displayName}`);
    
    // 2. 스페이스 목록 조회
    console.log('\n2️⃣ 접근 가능한 스페이스 조회...');
    const spacesResponse = await axios.get(
      `https://${domain}/wiki/rest/api/space`,
      {
        params: { limit: 10 },
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const spaces = spacesResponse.data.results;
    console.log(`✅ ${spaces.length}개 스페이스 발견:`);
    spaces.forEach((space: any) => {
      console.log(`   - [${space.key}] ${space.name}`);
    });
    
    // 3. 최근 댓글 조회 (오늘 기준)
    console.log('\n3️⃣ 최근 댓글 확인 (테스트)...');
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 7); // 일주일 전부터
    
    const cql = `type=comment and created >= "${formatDate(yesterday)}"`;
    
    const commentsResponse = await axios.get(
      `https://${domain}/wiki/rest/api/content/search`,
      {
        params: {
          cql: cql,
          limit: 5,
          expand: 'body.view,container'
        },
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const comments = commentsResponse.data.results;
    console.log(`✅ 최근 1주일 댓글 ${comments.length}개 발견`);
    
    if (comments.length > 0) {
      console.log('\n📋 샘플 댓글:');
      comments.slice(0, 3).forEach((comment: any, index: number) => {
        const text = extractText(comment.body?.view?.value || '');
        console.log(`\n   ${index + 1}. 페이지: ${comment.container?.title || 'Unknown'}`);
        console.log(`      작성자: ${comment.history?.createdBy?.displayName || 'Unknown'}`);
        console.log(`      내용: ${text.substring(0, 100)}...`);
      });
    }
    
    // 4. 권한 체크
    console.log('\n4️⃣ API 권한 확인...');
    console.log('✅ 읽기 권한: OK');
    console.log('✅ 댓글 조회: OK');
    console.log('✅ 스페이스 접근: OK');
    
    console.log('\n🎉 Confluence 연결 테스트 완료!');
    console.log('💡 이제 npm run collect 명령으로 실제 수집을 시작할 수 있습니다.');
    
  } catch (error: any) {
    console.error('\n❌ Confluence 연결 실패!');
    
    if (error.response?.status === 401) {
      console.error('🔐 인증 실패: 이메일 또는 API 토큰을 확인해주세요.');
    } else if (error.response?.status === 404) {
      console.error('🔍 도메인을 찾을 수 없습니다. CONFLUENCE_DOMAIN을 확인해주세요.');
      console.error('   예: yourcompany.atlassian.net (https:// 제외)');
    } else {
      console.error(`오류: ${error.message}`);
      if (error.response?.data) {
        console.error('상세:', error.response.data);
      }
    }
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Run test
testConfluenceConnection();