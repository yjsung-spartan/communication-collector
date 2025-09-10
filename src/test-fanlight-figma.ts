import axios from 'axios';

async function testFanlightFigma() {
  const token = 'figd_pPdkTYmBaLqZznGjxxaBT1xup5uIk166DDoBZbPK';
  const fileKey = 'O99LlTEvqCRtqUIAXLEgpw'; // Fanlight 파일 키
  
  console.log('🎨 Testing Fanlight Figma Comments...\n');
  
  try {
    // 1. Get file info
    console.log('📄 Getting file info...');
    const fileResponse = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: {
        'X-Figma-Token': token
      }
    });
    
    console.log(`✅ File: ${fileResponse.data.name}`);
    console.log(`   Last modified: ${fileResponse.data.lastModified}`);
    console.log(`   Version: ${fileResponse.data.version}`);
    console.log('');
    
    // 2. Get comments
    console.log('💬 Getting comments...');
    const commentsResponse = await axios.get(`https://api.figma.com/v1/files/${fileKey}/comments`, {
      headers: {
        'X-Figma-Token': token
      }
    });
    
    const comments = commentsResponse.data.comments || [];
    console.log(`✅ Found ${comments.length} comment threads\n`);
    
    // 3. Analyze comments
    const requestKeywords = ['요청', '수정', '변경', '확인', '문의', '추가', '삭제', '필요', '부탁', 
                           'please', 'need', 'fix', 'change', 'update', 'add', 'remove'];
    
    let totalMessages = 0;
    let requestComments = [];
    
    // Process all comments and replies
    for (const thread of comments) {
      totalMessages++;
      
      // Check main comment
      const isRequest = requestKeywords.some(keyword => 
        thread.message.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (isRequest) {
        requestComments.push({
          id: thread.id,
          user: thread.user.handle,
          message: thread.message,
          created: thread.created_at,
          resolved: thread.resolved_at ? true : false
        });
      }
      
      // Check replies
      if (thread.replies && thread.replies.length > 0) {
        for (const reply of thread.replies) {
          totalMessages++;
          const isReplyRequest = requestKeywords.some(keyword => 
            reply.message.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (isReplyRequest) {
            requestComments.push({
              id: reply.id,
              user: reply.user.handle,
              message: reply.message,
              created: reply.created_at,
              resolved: thread.resolved_at ? true : false,
              isReply: true,
              parentId: thread.id
            });
          }
        }
      }
    }
    
    // 4. Display sample comments
    console.log('📝 Sample comments (first 10):');
    comments.slice(0, 10).forEach((comment: any, index: number) => {
      console.log(`\n${index + 1}. ${comment.user.handle}:`);
      console.log(`   "${comment.message.substring(0, 100)}${comment.message.length > 100 ? '...' : ''}"`);
      console.log(`   Created: ${new Date(comment.created_at).toLocaleString('ko-KR')}`);
      if (comment.resolved_at) {
        console.log(`   ✅ Resolved: ${new Date(comment.resolved_at).toLocaleString('ko-KR')}`);
      }
      if (comment.replies && comment.replies.length > 0) {
        console.log(`   └─ ${comment.replies.length} replies`);
      }
    });
    
    // 5. Display analysis
    console.log('\n📊 Analysis:');
    console.log(`   Total comment threads: ${comments.length}`);
    console.log(`   Total messages (including replies): ${totalMessages}`);
    console.log(`   Potential customer requests: ${requestComments.length}`);
    console.log(`   Unresolved threads: ${comments.filter((c: any) => !c.resolved_at).length}`);
    
    // 6. Display request comments
    if (requestComments.length > 0) {
      console.log('\n🔴 Potential Customer Requests:');
      requestComments.slice(0, 5).forEach((req, index) => {
        console.log(`\n${index + 1}. [${req.user}] ${req.isReply ? '(Reply) ' : ''}`);
        console.log(`   "${req.message.substring(0, 150)}${req.message.length > 150 ? '...' : ''}"`);
        console.log(`   Status: ${req.resolved ? '✅ Resolved' : '⏳ Open'}`);
      });
    }
    
    // 7. Get user statistics
    const userStats = new Map();
    comments.forEach((c: any) => {
      const user = c.user.handle;
      if (!userStats.has(user)) {
        userStats.set(user, 0);
      }
      userStats.set(user, userStats.get(user) + 1);
    });
    
    console.log('\n👥 Top Commenters:');
    const sortedUsers = Array.from(userStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    sortedUsers.forEach(([user, count]) => {
      console.log(`   ${user}: ${count} comments`);
    });
    
    return comments;
    
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.error('❌ Access denied. You might not have permission to view this file.');
      console.error('   Make sure you have access to the Fanlight Figma file.');
    } else if (error.response?.status === 404) {
      console.error('❌ File not found. The file key might be incorrect.');
    } else {
      console.error('❌ Error:', error.response?.data?.message || error.message);
    }
  }
}

testFanlightFigma();