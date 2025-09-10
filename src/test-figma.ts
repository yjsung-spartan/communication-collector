import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testFigmaAPI() {
  const token = 'figd_pPdkTYmBaLqZznGjxxaBT1xup5uIk166DDoBZbPK';
  
  console.log('🎨 Testing Figma API...\n');
  
  try {
    // 1. First, get user info to verify token works
    console.log('1️⃣ Verifying API token...');
    const meResponse = await axios.get('https://api.figma.com/v1/me', {
      headers: {
        'X-Figma-Token': token
      }
    });
    
    console.log(`✅ Authenticated as: ${meResponse.data.email}`);
    console.log(`   Name: ${meResponse.data.handle}`);
    console.log('');
    
    // 2. Get team projects (fanlight might be in a team)
    console.log('2️⃣ Getting team projects...');
    
    // You need to know the team ID. Let's try to find fanlight project
    // First, we need the file key. Common Figma URL format:
    // https://www.figma.com/file/{FILE_KEY}/{FILE_NAME}
    
    // If you have a Figma URL for fanlight, extract the file key
    // For now, let's try to search for files
    
    console.log('\n3️⃣ Please provide one of the following:');
    console.log('   - Figma file URL (e.g., https://www.figma.com/file/ABC123/fanlight)');
    console.log('   - Figma file key (e.g., ABC123xyz)');
    console.log('   - Team ID to list all projects');
    
    // Example: Test with a specific file if you have the key
    // const fileKey = 'YOUR_FILE_KEY_HERE';
    // await testFileComments(token, fileKey);
    
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.error('❌ Access denied. Token might not have necessary permissions.');
    } else if (error.response?.status === 404) {
      console.error('❌ Resource not found.');
    } else {
      console.error('❌ Error:', error.response?.data || error.message);
    }
  }
}

async function testFileComments(token: string, fileKey: string) {
  console.log(`\n4️⃣ Getting comments from file: ${fileKey}`);
  
  try {
    // Get file info
    const fileResponse = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: {
        'X-Figma-Token': token
      }
    });
    
    console.log(`📄 File: ${fileResponse.data.name}`);
    console.log(`   Last modified: ${fileResponse.data.lastModified}`);
    
    // Get comments
    const commentsResponse = await axios.get(`https://api.figma.com/v1/files/${fileKey}/comments`, {
      headers: {
        'X-Figma-Token': token
      }
    });
    
    const comments = commentsResponse.data.comments || [];
    console.log(`\n💬 Found ${comments.length} comments`);
    
    // Display first few comments
    comments.slice(0, 5).forEach((comment: any) => {
      console.log(`\n   Comment by ${comment.user.handle}:`);
      console.log(`   "${comment.message}"`);
      console.log(`   Created: ${comment.created_at}`);
      
      // Check for replies
      if (comment.replies && comment.replies.length > 0) {
        console.log(`   └─ ${comment.replies.length} replies`);
      }
    });
    
    // Analyze comment content
    const requestKeywords = ['요청', '수정', '변경', '확인', '문의', 'please', 'need', 'fix', 'change'];
    const requestComments = comments.filter((c: any) => {
      const message = c.message.toLowerCase();
      return requestKeywords.some(keyword => message.includes(keyword));
    });
    
    console.log(`\n📊 Analysis:`);
    console.log(`   Total comments: ${comments.length}`);
    console.log(`   Potential requests: ${requestComments.length}`);
    
    return comments;
    
  } catch (error: any) {
    console.error('Error fetching file comments:', error.response?.data || error.message);
  }
}

// Search for fanlight-related projects
async function searchProjects(token: string) {
  console.log('\n🔍 Attempting to find fanlight projects...');
  
  // Note: Figma API doesn't have a search endpoint
  // You need to know either:
  // 1. The exact file key
  // 2. The team ID to list team projects
  // 3. Or get recent files
  
  try {
    // Get recent files (this requires the file to be in your recent files)
    const recentResponse = await axios.get('https://api.figma.com/v1/me/files', {
      headers: {
        'X-Figma-Token': token
      },
      params: {
        limit: 20
      }
    });
    
    if (recentResponse.data.files) {
      console.log('\n📁 Your recent files:');
      recentResponse.data.files.forEach((file: any) => {
        console.log(`   - ${file.name} (${file.key})`);
        if (file.name.toLowerCase().includes('fanlight')) {
          console.log(`     ⭐ This might be the fanlight project!`);
        }
      });
    }
  } catch (error: any) {
    console.error('Could not fetch recent files:', error.message);
  }
}

// Run tests
async function run() {
  await testFigmaAPI();
  await searchProjects('figd_pPdkTYmBaLqZznGjxxaBT1xup5uIk166DDoBZbPK');
}

run();