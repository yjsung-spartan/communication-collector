import * as cron from 'node-cron';
import { DailyReportService } from './dailyReportService';
import { BotConfig } from '../types';

export class SchedulerService {
  private task: cron.ScheduledTask | null = null;

  constructor(
    private reportService: DailyReportService,
    private config: BotConfig
  ) {}

  start() {
    // Schedule daily report (default: 9 AM every day)
    this.task = cron.schedule(this.config.dailyReportCron, async () => {
      console.log('⏰ Running scheduled daily report...');
      await this.reportService.generateDailyReport();
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul' // Korean timezone
    });

    console.log(`📅 Daily report scheduled with cron: ${this.config.dailyReportCron}`);
  }

  stop() {
    if (this.task) {
      this.task.stop();
      console.log('🛑 Scheduler stopped');
    }
  }

  // For testing - trigger report manually
  async triggerNow() {
    console.log('🔄 Manually triggering daily report...');
    await this.reportService.generateDailyReport();
  }
}