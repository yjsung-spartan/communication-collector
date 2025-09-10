import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function simpleTest() {
  const email = process.env.CONFLUENCE_EMAIL!;
  const token = process.env.CONFLUENCE_API_TOKEN!;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  
  // 가능한 도메인들 테스트
  const domains = [
    'weplanet.atlassian.net',
    'weplanet-team.atlassian.net', 
    'weplanet-inc.atlassian.net',
    'weplanet-kr.atlassian.net'
  ];
  
  for (const domain of domains) {
    console.log(`\n테스트: ${domain}`);
    try {
      const response = await axios.get(
        `https://${domain}/rest/api/user?accountId=me`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          },
          timeout: 5000
        }
      );
      console.log(`✅ ${domain} - 성공!`);
      console.log(`   사용자: ${response.data.displayName || response.data.email}`);
      
      // 이 도메인으로 .env 업데이트 제안
      console.log(`\n💡 .env 파일에서 CONFLUENCE_DOMAIN을 다음으로 변경하세요:`);
      console.log(`   CONFLUENCE_DOMAIN=${domain}`);
      break;
      
    } catch (error: any) {
      if (error.code === 'ENOTFOUND') {
        console.log(`❌ ${domain} - 도메인 없음`);
      } else if (error.response?.status === 403) {
        console.log(`⚠️  ${domain} - 권한 없음`);
      } else if (error.response?.status === 401) {
        console.log(`🔐 ${domain} - 인증 실패`);
      } else {
        console.log(`❓ ${domain} - 기타 오류: ${error.message}`);
      }
    }
  }
}

simpleTest();