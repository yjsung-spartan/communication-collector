import axios from 'axios';
import { DatabaseService } from './databaseService';
import { CustomerRequest } from '../types';

export class ConfluenceCollectorService {
  private domain: string;
  private email: string;
  private apiToken: string;
  
  constructor(
    private dbService: DatabaseService
  ) {
    this.domain = process.env.CONFLUENCE_DOMAIN || '';
    this.email = process.env.CONFLUENCE_EMAIL || '';
    this.apiToken = process.env.CONFLUENCE_API_TOKEN || '';
  }

  async collectComments(spaceKeys?: string[]): Promise<number> {
    if (!this.domain || !this.email || !this.apiToken) {
      console.log('⚠️  Confluence credentials not configured, skipping Confluence collection');
      return 0;
    }

    console.log('📝 Collecting Confluence comments...');
    let totalCollected = 0;

    // Calculate time range: Yesterday 9:00 ~ Today 9:00
    const now = new Date();
    const todayNineAM = new Date(now);
    todayNineAM.setHours(9, 0, 0, 0);
    
    const yesterdayNineAM = new Date(todayNineAM);
    yesterdayNineAM.setDate(yesterdayNineAM.getDate() - 1);
    
    if (now.getHours() < 9) {
      todayNineAM.setDate(todayNineAM.getDate() - 1);
      yesterdayNineAM.setDate(yesterdayNineAM.getDate() - 1);
    }

    try {
      // If no specific spaces provided, get recent comments from all spaces
      const collected = await this.collectRecentComments(yesterdayNineAM, todayNineAM, spaceKeys);
      totalCollected += collected;
    } catch (error) {
      console.error('Error collecting Confluence comments:', error);
    }

    console.log(`✅ Collected ${totalCollected} Confluence comments`);
    return totalCollected;
  }

  private async collectRecentComments(
    startTime: Date, 
    endTime: Date,
    spaceKeys?: string[]
  ): Promise<number> {
    let collected = 0;
    const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');

    try {
      // Build CQL query for comments created in time range
      // Expand search to last 30 days for testing
      const thirtyDaysAgo = new Date(startTime);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      let cql = `type=comment and created >= "${this.formatDate(thirtyDaysAgo)}"`;
      
      if (spaceKeys && spaceKeys.length > 0) {
        const spaceFilter = spaceKeys.map(key => `space="${key}"`).join(' OR ');
        cql += ` and (${spaceFilter})`;
      }

      // Search for comments using CQL
      const searchUrl = `https://${this.domain}/wiki/rest/api/content/search`;
      const response = await axios.get(searchUrl, {
        params: {
          cql: cql,
          expand: 'body.view,container,version,history',
          limit: 100
        },
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });

      const comments = response.data.results || [];

      for (const comment of comments) {
        // Get the comment content
        const commentText = this.extractTextFromHtml(comment.body?.view?.value || '');
        
        if (this.isCustomerRequest(commentText)) {
          const processed = await this.processComment(comment, commentText);
          if (processed) collected++;
        }
      }

      return collected;
    } catch (error: any) {
      console.error(`Failed to fetch Confluence comments: ${error.message}`);
      return 0;
    }
  }

  private formatDate(date: Date): string {
    // Format date for CQL: "2024-12-28"
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractTextFromHtml(html: string): string {
    // Simple HTML stripping (in production, use a proper HTML parser)
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isCustomerRequest(text: string): boolean {
    const keywords = (process.env.REQUEST_KEYWORDS || '요청,문의,개선,오류,버그,수정,변경').split(',');
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  private async processComment(comment: any, commentText: string): Promise<boolean> {
    try {
      // Check for duplicate
      const isDuplicate = await this.dbService.checkDuplicateRequest(comment.id, 'confluence');
      if (isDuplicate) {
        return false;
      }

      // Build Confluence comment URL
      const pageUrl = comment._links?.webui || '';
      const confluenceUrl = `https://${this.domain}/wiki${pageUrl}`;

      // Get author info - try multiple fields
      const authorName = comment.version?.by?.displayName || 
                        comment.history?.createdBy?.displayName ||
                        comment.history?.lastUpdated?.by?.displayName || 
                        'Unknown';
      const authorEmail = comment.version?.by?.email ||
                         comment.history?.createdBy?.email ||
                         comment.history?.lastUpdated?.by?.email;

      // Get parent page title
      const containerTitle = comment.container?.title || 'Unknown Page';

      // Create customer request
      const request: Omit<CustomerRequest, 'id' | 'crNumber' | 'collectedAt' | 'updatedAt'> = {
        source: 'confluence',
        sourceId: comment.id,
        requesterId: comment.version?.by?.accountId || 
                     comment.history?.createdBy?.accountId ||
                     comment.history?.lastUpdated?.by?.accountId || 
                     'unknown',
        requesterName: authorName,
        requesterEmail: authorEmail,
        title: this.generateTitle(commentText),
        description: commentText,
        category: this.determineCategory(commentText),
        priority: this.determinePriority(commentText),
        channelName: `Confluence: ${containerTitle}`,
        originalUrl: confluenceUrl,
        status: 'new',
        requestedAt: new Date(comment.version?.when || 
                              comment.history?.createdDate || 
                              comment.history?.lastUpdated?.when || 
                              comment.history?.created?.when),
      };

      // Save to database
      await this.dbService.saveCustomerRequest(request);
      return true;
      
    } catch (error) {
      console.error('Error processing Confluence comment:', error);
      return false;
    }
  }

  private determinePriority(text: string): CustomerRequest['priority'] {
    const lowerText = text.toLowerCase();
    const urgentKeywords = (process.env.URGENT_KEYWORDS || '긴급,급함,ASAP').split(',');
    const highKeywords = (process.env.HIGH_KEYWORDS || '중요,우선').split(',');
    
    if (urgentKeywords.some(k => lowerText.includes(k.toLowerCase()))) {
      return 'urgent';
    }
    if (highKeywords.some(k => lowerText.includes(k.toLowerCase()))) {
      return 'high';
    }
    return 'medium';
  }

  private determineCategory(text: string): CustomerRequest['category'] {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('버그') || lowerText.includes('오류') || lowerText.includes('안됨')) {
      return 'bug';
    }
    if (lowerText.includes('개선') || lowerText.includes('변경') || lowerText.includes('수정')) {
      return 'improvement';
    }
    if (lowerText.includes('추가') || lowerText.includes('신규')) {
      return 'new_feature';
    }
    if (lowerText.includes('문의') || lowerText.includes('질문')) {
      return 'inquiry';
    }
    return 'other';
  }

  private generateTitle(text: string): string {
    const firstLine = text.split('\n')[0];
    if (firstLine.length <= 50) {
      return firstLine.trim();
    }
    return firstLine.substring(0, 50).trim() + '...';
  }
}