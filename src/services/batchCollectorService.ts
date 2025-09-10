import { App } from '@slack/bolt';
import { DatabaseService } from './databaseService';
import { BotConfig, CustomerRequest } from '../types';

export class BatchCollectorService {
  constructor(
    private app: App,
    private config: BotConfig,
    private dbService: DatabaseService
  ) {}

  async collectYesterdayRequests(): Promise<number> {
    console.log('🔄 Starting batch collection (last 24 hours from 9 AM)...');
    
    // Calculate time range: Yesterday 9:00 ~ Today 9:00
    const now = new Date();
    const todayNineAM = new Date(now);
    todayNineAM.setHours(9, 0, 0, 0);
    
    const yesterdayNineAM = new Date(todayNineAM);
    yesterdayNineAM.setDate(yesterdayNineAM.getDate() - 1);
    
    // If current time is before 9 AM, adjust the range
    if (now.getHours() < 9) {
      todayNineAM.setDate(todayNineAM.getDate() - 1);
      yesterdayNineAM.setDate(yesterdayNineAM.getDate() - 1);
    }
    
    // Convert to Slack timestamp format (seconds.microseconds)
    const oldest = Math.floor(yesterdayNineAM.getTime() / 1000).toString();
    const latest = Math.floor(todayNineAM.getTime() / 1000).toString();
    
    console.log(`📅 Collecting from ${yesterdayNineAM.toLocaleString()} to ${todayNineAM.toLocaleString()}`);
    
    let totalCollected = 0;
    
    // Collect from each monitored channel
    for (const channelId of this.config.monitorChannels) {
      try {
        const collected = await this.collectFromChannel(channelId, oldest, latest);
        totalCollected += collected;
        console.log(`✅ Collected ${collected} requests from channel ${channelId}`);
      } catch (error) {
        console.error(`Error collecting from channel ${channelId}:`, error);
      }
    }
    
    console.log(`✅ Total collected: ${totalCollected} customer requests`);
    return totalCollected;
  }

  private async collectFromChannel(channelId: string, oldest: string, latest: string): Promise<number> {
    let collected = 0;
    let cursor: string | undefined;
    
    try {
      // Get channel info
      const channelInfo = await this.app.client.conversations.info({
        token: this.config.slackBotToken,
        channel: channelId
      });
      const channelName = channelInfo.channel?.name || channelId;
      
      // Fetch messages from the channel
      do {
        const result = await this.app.client.conversations.history({
          token: this.config.slackBotToken,
          channel: channelId,
          oldest: oldest,
          latest: latest,
          limit: 100,
          cursor: cursor
        });
        
        if (!result.messages) break;
        
        // Process each message
        for (const message of result.messages) {
          // Skip bot messages, system messages, etc
          if (message.subtype || !message.text || !message.user) continue;
          
          // Check if it's a customer request
          if (this.isCustomerRequest(message.text)) {
            const processed = await this.processMessage(message, channelId, channelName);
            if (processed) collected++;
          }
          
          // Also check thread replies if there are any
          if (message.thread_ts && message.reply_count && message.reply_count > 0) {
            const threadCollected = await this.collectFromThread(
              channelId, 
              channelName, 
              message.thread_ts,
              oldest,
              latest
            );
            collected += threadCollected;
          }
        }
        
        cursor = result.response_metadata?.next_cursor;
      } while (cursor);
      
    } catch (error) {
      console.error(`Error fetching messages from channel ${channelId}:`, error);
    }
    
    return collected;
  }

  private async collectFromThread(
    channelId: string, 
    channelName: string,
    threadTs: string,
    oldest: string,
    latest: string
  ): Promise<number> {
    let collected = 0;
    
    try {
      const result = await this.app.client.conversations.replies({
        token: this.config.slackBotToken,
        channel: channelId,
        ts: threadTs,
        oldest: oldest,
        latest: latest
      });
      
      if (!result.messages) return 0;
      
      // Skip the parent message (first one)
      for (const message of result.messages.slice(1)) {
        if (message.subtype || !message.text || !message.user) continue;
        
        if (this.isCustomerRequest(message.text)) {
          const processed = await this.processMessage(message, channelId, channelName, threadTs);
          if (processed) collected++;
        }
      }
    } catch (error) {
      console.error(`Error fetching thread ${threadTs}:`, error);
    }
    
    return collected;
  }

  private isCustomerRequest(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.config.requestKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  private async processMessage(
    message: any,
    channelId: string,
    channelName: string,
    threadTs?: string
  ): Promise<boolean> {
    try {
      // Check for duplicate
      const isDuplicate = await this.dbService.checkDuplicateRequest(message.ts, 'slack');
      if (isDuplicate) {
        return false;
      }

      // Get user info
      const userInfo = await this.app.client.users.info({
        token: this.config.slackBotToken,
        user: message.user
      });
      const userName = userInfo.user?.real_name || userInfo.user?.name || 'Unknown';
      const userEmail = userInfo.user?.profile?.email;

      // Build Slack message URL (simplified - may need team domain)
      const messageUrl = `https://slack.com/archives/${channelId}/p${message.ts.replace('.', '')}`;

      // Process attachments if any
      const attachments = message.files?.map((file: any) => file.url_private || file.permalink) || [];

      // Create customer request
      const request: Omit<CustomerRequest, 'id' | 'crNumber' | 'collectedAt' | 'updatedAt'> = {
        source: 'slack',
        sourceId: message.ts,
        requesterId: message.user,
        requesterName: userName,
        requesterEmail: userEmail,
        title: this.generateTitle(message.text),
        description: message.text,
        category: this.determineCategory(message.text),
        priority: this.determinePriority(message.text),
        channelId: channelId,
        channelName: channelName,
        threadTs: threadTs || message.thread_ts,
        attachments: attachments,
        originalUrl: messageUrl,
        status: 'new',
        requestedAt: new Date(parseFloat(message.ts) * 1000),
      };

      // Save to database
      await this.dbService.saveCustomerRequest(request);
      return true;
      
    } catch (error) {
      console.error('Error processing message:', error);
      return false;
    }
  }

  private determinePriority(text: string): CustomerRequest['priority'] {
    const lowerText = text.toLowerCase();
    
    if (this.config.urgentKeywords.some(k => lowerText.includes(k.toLowerCase()))) {
      return 'urgent';
    }
    if (this.config.highKeywords.some(k => lowerText.includes(k.toLowerCase()))) {
      return 'high';
    }
    if (this.config.lowKeywords.some(k => lowerText.includes(k.toLowerCase()))) {
      return 'low';
    }
    return 'medium';
  }

  private determineCategory(text: string): CustomerRequest['category'] {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('버그') || lowerText.includes('오류') || lowerText.includes('에러') || 
        lowerText.includes('안됨') || lowerText.includes('안돼')) {
      return 'bug';
    }
    if (lowerText.includes('개선') || lowerText.includes('변경') || lowerText.includes('수정')) {
      return 'improvement';
    }
    if (lowerText.includes('추가') || lowerText.includes('신규') || lowerText.includes('새로운')) {
      return 'new_feature';
    }
    if (lowerText.includes('문의') || lowerText.includes('질문')) {
      return 'inquiry';
    }
    return 'other';
  }

  private generateTitle(text: string): string {
    // Extract first sentence or first 50 characters as title
    const firstSentence = text.split(/[.!?]/)[0];
    if (firstSentence.length <= 50) {
      return firstSentence.trim();
    }
    return text.substring(0, 50).trim() + '...';
  }
}