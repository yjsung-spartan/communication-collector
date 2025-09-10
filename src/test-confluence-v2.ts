import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testConfluenceV2() {
  const domain = 'weplanet.atlassian.net';
  const email = process.env.CONFLUENCE_EMAIL!;
  const token = process.env.CONFLUENCE_API_TOKEN!;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  
  console.log('🔄 Confluence API 테스트 (다양한 엔드포인트)...\n');
  
  const endpoints = [
    { 
      name: 'Wiki API (Space 목록)',
      url: `https://${domain}/wiki/rest/api/space`,
      desc: 'Confluence 스페이스 목록'
    },
    {
      name: 'Wiki API (현재 사용자)',
      url: `https://${domain}/wiki/rest/api/user/current`,
      desc: 'Confluence 현재 사용자'
    },
    {
      name: 'Jira API (Myself)',
      url: `https://${domain}/rest/api/3/myself`,
      desc: 'Jira 사용자 정보'
    },
    {
      name: 'Jira API (Projects)',
      url: `https://${domain}/rest/api/3/project`,
      desc: 'Jira 프로젝트 목록'
    }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`테스트: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    
    try {
      const response = await axios.get(endpoint.url, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`✅ 성공!`);
      
      if (endpoint.name.includes('Space')) {
        const spaces = response.data.results || [];
        console.log(`   스페이스 수: ${spaces.length}`);
        if (spaces.length > 0) {
          console.log('   스페이스 목록:');
          spaces.slice(0, 5).forEach((space: any) => {
            console.log(`   - [${space.key}] ${space.name}`);
          });
        }
      } else if (endpoint.name.includes('사용자')) {
        console.log(`   사용자: ${response.data.displayName || response.data.publicName || response.data.email}`);
        console.log(`   이메일: ${response.data.emailAddress || response.data.email || 'N/A'}`);
      } else if (endpoint.name.includes('Projects')) {
        console.log(`   프로젝트 수: ${response.data.length || 0}`);
      }
      
      console.log('');
      
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 403) {
        console.log(`⛔ 권한 없음: ${message}`);
      } else if (status === 401) {
        console.log(`🔐 인증 실패`);
      } else if (status === 404) {
        console.log(`❌ 엔드포인트 없음`);
      } else {
        console.log(`❓ 오류 (${status}): ${message}`);
      }
      console.log('');
    }
  }
  
  console.log('\n💡 팁:');
  console.log('- "권한 없음"은 해당 제품(Confluence/Jira)에 접근 권한이 없다는 의미');
  console.log('- "엔드포인트 없음"은 해당 제품이 설치되지 않았을 수 있음');
  console.log('- Jira만 성공한다면 Confluence 라이센스가 없을 수 있음');
}

testConfluenceV2();