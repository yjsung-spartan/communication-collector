import { App, LogLevel } from '@slack/bolt';
import dotenv from 'dotenv';
import { BatchCollectorService } from './services/batchCollectorService';
import { DailyReportService } from './services/dailyReportService';
import { DatabaseService } from './services/databaseService';
import { SchedulerService } from './services/schedulerService';
import { BotConfig } from './types';

// Load environment variables
dotenv.config();

// Validate required environment variables
function validateEnv(): BotConfig {
  const required = [
    'SLACK_BOT_TOKEN',
    'SLACK_APP_TOKEN', 
    'SLACK_SIGNING_SECRET',
    'MONITOR_CHANNELS',
    'REPORT_CHANNEL'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    slackBotToken: process.env.SLACK_BOT_TOKEN!,
    slackAppToken: process.env.SLACK_APP_TOKEN!,
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET!,
    monitorChannels: process.env.MONITOR_CHANNELS!.split(','),
    reportChannel: process.env.REPORT_CHANNEL!,
    requestKeywords: (process.env.REQUEST_KEYWORDS || '요청,문의,개선,오류,버그,에러,불편,안됨,안돼,추가,변경').split(','),
    urgentKeywords: (process.env.URGENT_KEYWORDS || '긴급,급함,ASAP,장애,다운,먹통').split(','),
    highKeywords: (process.env.HIGH_KEYWORDS || '중요,우선,빠른,시급').split(','),
    lowKeywords: (process.env.LOW_KEYWORDS || '검토,고려,제안,아이디어').split(','),
    dailyReportCron: process.env.DAILY_REPORT_CRON || '0 9 * * *'
  };
}

async function main() {
  try {
    // Validate configuration
    const config = validateEnv();
    console.log('✅ Configuration validated');

    // Initialize Slack app
    const app = new App({
      token: config.slackBotToken,
      appToken: config.slackAppToken,
      signingSecret: config.slackSigningSecret,
      socketMode: true,
      logLevel: LogLevel.INFO,
    });

    console.log('🤖 Initializing Customer Request Bot (Batch Mode)...');

    // Initialize services
    const dbService = new DatabaseService();
    await dbService.initialize();
    console.log('✅ Database connected');

    const batchCollector = new BatchCollectorService(app, config, dbService);
    const reportService = new DailyReportService(app, dbService, config, batchCollector);
    const scheduler = new SchedulerService(reportService, config);

    // Register slash commands
    app.command('/cr', async ({ command, ack, respond }) => {
      await ack();
      
      const args = command.text.split(' ');
      const subcommand = args[0];

      switch (subcommand) {
        case 'setup':
          await respond({
            text: '🔧 Customer Request Bot 설정\n' +
                  `모니터링 채널: ${config.monitorChannels.map(c => `<#${c}>`).join(', ')}\n` +
                  `리포트 채널: <#${config.reportChannel}>\n` +
                  `수집 및 리포트: 매일 오전 9시 (전날 24시간 메시지)`
          });
          break;

        case 'status':
          const todayCount = await dbService.getTodayRequestCount();
          await respond({
            text: `📊 오늘의 요청 현황\n` +
                  `수집된 요청: ${todayCount}건\n` +
                  `다음 수집 및 리포트: 내일 오전 9시`
          });
          break;

        case 'collect':
          await respond({ text: '🔄 어제 메시지를 수집중입니다...' });
          const collected = await batchCollector.collectYesterdayRequests();
          await respond({ text: `✅ ${collected}건의 고객 요청을 수집했습니다.` });
          break;

        case 'report':
          await respond({ text: '📝 일일 리포트를 생성중입니다...' });
          await reportService.generateDailyReport();
          break;

        case 'list':
          const requests = await dbService.getYesterdayRequests();
          if (requests.length === 0) {
            await respond({ text: '어제 수집된 요청이 없습니다.' });
          } else {
            const list = requests.map((r, i) => 
              `${i+1}. [${r.crNumber}] ${r.title} - ${r.requesterName}`
            ).join('\n');
            await respond({ text: `📋 어제의 요청 목록:\n${list}` });
          }
          break;

        case 'help':
        default:
          await respond({
            text: '📖 Customer Request Bot 명령어\n' +
                  '`/cr setup` - 현재 설정 확인\n' +
                  '`/cr status` - 수집 현황\n' +
                  '`/cr collect` - 수동으로 어제 메시지 수집\n' +
                  '`/cr report` - 수동 리포트 생성\n' +
                  '`/cr list` - 어제 요청 목록'
          });
      }
    });

    // Start scheduler (collects and reports at 9 AM)
    scheduler.start();
    console.log(`✅ Scheduler started (Daily collection & report at 9 AM)`);

    // Start the app
    await app.start();
    console.log('⚡️ Customer Request Bot is running in batch mode!');
    console.log(`📊 Will collect from channels: ${config.monitorChannels.join(', ')}`);
    console.log(`📊 Will post reports to: #${config.reportChannel}`);

  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Start the bot
main();