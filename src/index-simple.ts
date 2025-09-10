import dotenv from 'dotenv';
import { App, LogLevel } from '@slack/bolt';
import { BatchCollectorService } from './services/batchCollectorService';
import { FigmaCollectorService } from './services/figmaCollectorService';
import { ConfluencePageCollectorService } from './services/confluencePageCollectorService';
import { DatabaseService } from './services/databaseService';
import { MDExportService } from './services/mdExportService';
import * as cron from 'node-cron';

// Load environment variables
dotenv.config();

async function collectAndExport() {
  console.log('🚀 Starting daily collection...');
  const startTime = new Date();
  
  try {
    // Initialize services
    const dbService = new DatabaseService();
    await dbService.initialize();
    
    // Initialize Slack app only if credentials exist
    let slackCollector: BatchCollectorService | null = null;
    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
      const app = new App({
        token: process.env.SLACK_BOT_TOKEN,
        appToken: process.env.SLACK_APP_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET || '',
        socketMode: false, // We don't need socket mode for batch collection
        logLevel: LogLevel.ERROR,
      });
      
      const config = {
        slackBotToken: process.env.SLACK_BOT_TOKEN,
        slackAppToken: process.env.SLACK_APP_TOKEN,
        slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
        monitorChannels: (process.env.MONITOR_CHANNELS || '').split(',').filter(c => c),
        reportChannel: process.env.REPORT_CHANNEL || '',
        requestKeywords: (process.env.REQUEST_KEYWORDS || '요청,문의,개선,오류,버그,에러,불편,안됨,안돼,추가,변경').split(','),
        urgentKeywords: (process.env.URGENT_KEYWORDS || '긴급,급함,ASAP,장애,다운,먹통').split(','),
        highKeywords: (process.env.HIGH_KEYWORDS || '중요,우선,빠른,시급').split(','),
        lowKeywords: (process.env.LOW_KEYWORDS || '검토,고려,제안,아이디어').split(','),
        dailyReportCron: '0 9 * * *'
      };
      
      slackCollector = new BatchCollectorService(app, config, dbService);
    }
    
    const figmaCollector = new FigmaCollectorService(dbService);
    const confluenceCollector = new ConfluencePageCollectorService(dbService);
    const mdExporter = new MDExportService();
    
    // Collect from all sources
    let totalCollected = 0;
    
    // 1. Collect Slack messages
    if (slackCollector) {
      console.log('💬 Collecting from Slack...');
      const slackCount = await slackCollector.collectYesterdayRequests();
      totalCollected += slackCount;
    } else {
      console.log('⚠️  Slack credentials not configured');
    }
    
    // 2. Collect Figma comments
    const figmaFiles = (process.env.FIGMA_FILE_KEYS || '').split(',').filter(f => f);
    if (figmaFiles.length > 0) {
      console.log('🎨 Collecting from Figma...');
      const figmaCount = await figmaCollector.collectComments(figmaFiles);
      totalCollected += figmaCount;
    } else {
      console.log('⚠️  No Figma files configured');
    }
    
    // 3. Collect Confluence pages and comments
    const confluenceSpaces = (process.env.CONFLUENCE_SPACES || '').split(',').filter(s => s);
    console.log('📝 Collecting from Confluence...');
    const confluenceCount = await confluenceCollector.collectPagesAndComments(confluenceSpaces);
    totalCollected += confluenceCount;
    
    console.log(`✅ Total collected: ${totalCollected} customer requests`);
    
    // Get all collected requests and export to MD
    const allRequests = await dbService.getYesterdayRequests();
    if (allRequests.length > 0) {
      const filepath = await mdExporter.exportToMarkdown(allRequests, new Date());
      console.log(`📄 Markdown report saved to: ${filepath}`);
    } else {
      console.log('ℹ️  No requests to export');
    }
    
    // Close database connection
    await dbService.close();
    
    const duration = (Date.now() - startTime.getTime()) / 1000;
    console.log(`✅ Collection completed in ${duration}s`);
    
  } catch (error) {
    console.error('❌ Error during collection:', error);
  }
}

// Main function
async function main() {
  const mode = process.argv[2];
  
  if (mode === '--once') {
    // Run once immediately
    console.log('🔄 Running collection once...');
    await collectAndExport();
    process.exit(0);
  } else {
    // Schedule for 9 AM daily
    console.log('📅 Scheduling daily collection at 9:00 AM...');
    
    cron.schedule('0 9 * * *', async () => {
      await collectAndExport();
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul'
    });
    
    console.log('⏰ Bot is running. Daily collection scheduled for 9:00 AM KST');
    console.log('💡 Tip: Run with --once flag to collect immediately');
    
    // Keep the process running
    process.stdin.resume();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

// Start the application
main().catch(console.error);