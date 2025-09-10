import dotenv from 'dotenv';
import { DatabaseService } from './src/services/databaseService';
import { ConfluencePageCollectorService } from './src/services/confluencePageCollectorService';

dotenv.config();

async function testConfluenceCollection() {
  console.log('🔍 Testing Confluence Collection...\n');
  
  const dbService = new DatabaseService();
  await dbService.initialize();
  
  try {
    // Test Fanlight
    if (process.env.CONFLUENCE_API_TOKEN) {
      console.log('📊 Testing Fanlight Confluence...');
      console.log('Domain:', process.env.CONFLUENCE_DOMAIN);
      console.log('Token exists:', !!process.env.CONFLUENCE_API_TOKEN);
      
      const fanlightCollector = new ConfluencePageCollectorService(dbService);
      const fanlightCount = await fanlightCollector.collectPagesAndComments([], 'fanlight');
      console.log(`✅ Fanlight: Collected ${fanlightCount} items\n`);
    }
    
    // Test Momgleedu
    if (process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN) {
      console.log('📊 Testing Momgleedu Confluence...');
      console.log('Domain:', process.env.MOMGLEEDU_CONFLUENCE_DOMAIN);
      console.log('Token exists:', !!process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN);
      
      const momgleeduCollector = new ConfluencePageCollectorService(dbService);
      const momgleeduCount = await momgleeduCollector.collectPagesAndComments([], 'momgleedu');
      console.log(`✅ Momgleedu: Collected ${momgleeduCount} items\n`);
    }
    
    // Get all requests from DB
    console.log('📋 Getting all requests from database...');
    const allRequests = await dbService.getAllRequests();
    console.log(`Total requests in DB: ${allRequests.length}`);
    
    // Group by source
    const bySource: Record<string, number> = {};
    const byProject: Record<string, number> = {};
    
    for (const req of allRequests) {
      bySource[req.source] = (bySource[req.source] || 0) + 1;
      
      if (req.originalUrl) {
        if (req.originalUrl.includes('fanlight-weplanet')) {
          byProject['fanlight'] = (byProject['fanlight'] || 0) + 1;
        } else if (req.originalUrl.includes('momgle-edu')) {
          byProject['momgleedu'] = (byProject['momgleedu'] || 0) + 1;
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log('By Source:', bySource);
    console.log('By Project:', byProject);
    
    // Show sample data
    if (allRequests.length > 0) {
      console.log('\n📝 Sample Request:');
      const sample = allRequests[0];
      console.log({
        id: sample.id,
        source: sample.source,
        author: sample.requesterName,
        content: sample.description?.substring(0, 100) + '...',
        url: sample.originalUrl
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await dbService.close();
  }
}

testConfluenceCollection();