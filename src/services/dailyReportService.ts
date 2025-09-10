import { App } from '@slack/bolt';
import { DatabaseService } from './databaseService';
import { BotConfig, CustomerRequest, DailyReport } from '../types';

export class DailyReportService {
  constructor(
    private app: App,
    private dbService: DatabaseService,
    private config: BotConfig,
    private batchCollector?: any
  ) {}

  async generateDailyReport(): Promise<void> {
    try {
      console.log('📊 Starting daily collection and report...');
      
      // First, collect yesterday's messages
      if (this.batchCollector) {
        const collected = await this.batchCollector.collectYesterdayRequests();
        console.log(`📥 Collected ${collected} requests`);
      }
      
      // Then get yesterday's requests from DB
      const requests = await this.dbService.getYesterdayRequests();
      
      if (requests.length === 0) {
        await this.postEmptyReport();
        return;
      }

      // Calculate statistics
      const stats = this.calculateStatistics(requests);
      
      // Create report
      const report: Omit<DailyReport, 'id'> = {
        reportDate: new Date(),
        totalRequests: requests.length,
        byCategory: stats.byCategory,
        byPriority: stats.byPriority,
        bySource: stats.bySource,
        requests: requests,
        generatedAt: new Date(),
        postedChannelId: this.config.reportChannel,
      };

      // Format and post report to Slack
      const messageTs = await this.postReportToSlack(report, requests);
      report.postedMessageTs = messageTs;

      // Save report to database
      await this.dbService.saveDailyReport(report);
      
      console.log('✅ Daily report generated and posted');
    } catch (error) {
      console.error('Error generating daily report:', error);
      await this.postErrorMessage();
    }
  }

  private calculateStatistics(requests: CustomerRequest[]) {
    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const request of requests) {
      // Count by category
      byCategory[request.category] = (byCategory[request.category] || 0) + 1;
      
      // Count by priority
      byPriority[request.priority] = (byPriority[request.priority] || 0) + 1;
      
      // Count by source
      bySource[request.source] = (bySource[request.source] || 0) + 1;
    }

    return { byCategory, byPriority, bySource };
  }

  private async postReportToSlack(report: Omit<DailyReport, 'id'>, requests: CustomerRequest[]): Promise<string> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Group requests by priority
    const urgentRequests = requests.filter(r => r.priority === 'urgent');
    const highRequests = requests.filter(r => r.priority === 'high');
    const mediumRequests = requests.filter(r => r.priority === 'medium');
    const lowRequests = requests.filter(r => r.priority === 'low');

    // Build message blocks
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 일일 고객 요청 리포트',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*날짜:* ${dateStr}`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📈 *요약*\n` +
                `• 총 요청: *${report.totalRequests}건*\n` +
                `• 긴급: ${report.byPriority['urgent'] || 0}건 | 높음: ${report.byPriority['high'] || 0}건 | 보통: ${report.byPriority['medium'] || 0}건 | 낮음: ${report.byPriority['low'] || 0}건`
        }
      }
    ];

    // Add urgent requests if any
    if (urgentRequests.length > 0) {
      blocks.push({
        type: 'divider'
      });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔴 *긴급 요청 (${urgentRequests.length}건)*`
        }
      });
      
      for (const req of urgentRequests.slice(0, 5)) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*[${req.crNumber}]* ${req.title}\n` +
                  `요청자: ${req.requesterName} | 채널: <#${req.channelId}>\n` +
                  `"${this.truncateText(req.description, 100)}"`
          }
        });
      }
    }

    // Add high priority requests
    if (highRequests.length > 0) {
      blocks.push({
        type: 'divider'
      });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🟡 *주요 요청 (${highRequests.length}건)*`
        }
      });
      
      for (const req of highRequests.slice(0, 3)) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*[${req.crNumber}]* ${req.title} - ${req.requesterName}`
          }
        });
      }
    }

    // Add category breakdown
    blocks.push({
      type: 'divider'
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📊 *카테고리별 분포*\n` +
              `• 🐛 버그: ${report.byCategory['bug'] || 0}건\n` +
              `• 🔧 개선: ${report.byCategory['improvement'] || 0}건\n` +
              `• ✨ 신규기능: ${report.byCategory['new_feature'] || 0}건\n` +
              `• ❓ 문의: ${report.byCategory['inquiry'] || 0}건\n` +
              `• 📌 기타: ${report.byCategory['other'] || 0}건`
      }
    });

    // Add action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📋 전체 목록 보기'
          },
          action_id: 'view_full_list',
          value: yesterday.toISOString()
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📥 CSV 다운로드'
          },
          action_id: 'download_csv',
          value: yesterday.toISOString()
        }
      ]
    });

    // Post message
    const result = await this.app.client.chat.postMessage({
      token: this.config.slackBotToken,
      channel: this.config.reportChannel,
      text: `📊 ${dateStr} 고객 요청 리포트 (총 ${report.totalRequests}건)`,
      blocks: blocks
    });

    return result.ts || '';
  }

  private async postEmptyReport(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    await this.app.client.chat.postMessage({
      token: this.config.slackBotToken,
      channel: this.config.reportChannel,
      text: `📊 ${dateStr} 고객 요청 리포트\n\n어제는 수집된 고객 요청이 없습니다. 🎉`
    });
  }

  private async postErrorMessage(): Promise<void> {
    await this.app.client.chat.postMessage({
      token: this.config.slackBotToken,
      channel: this.config.reportChannel,
      text: `⚠️ 일일 리포트 생성 중 오류가 발생했습니다. 관리자에게 문의해주세요.`
    });
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  async exportToCSV(requests: CustomerRequest[]): Promise<string> {
    const headers = [
      'CR번호', '요청일시', '요청자', '이메일', '회사',
      '제목', '설명', '카테고리', '우선순위', '상태',
      '채널', '담당자', 'URL'
    ];

    const rows = requests.map(r => [
      r.crNumber,
      r.requestedAt.toISOString(),
      r.requesterName,
      r.requesterEmail || '',
      r.customerCompany || '',
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      r.category,
      r.priority,
      r.status,
      r.channelName || '',
      r.assignee || '',
      r.originalUrl || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // In production, save to file storage and return URL
    // For now, return the CSV content
    return csv;
  }
}