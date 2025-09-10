import axios from 'axios';
import { DatabaseService } from './databaseService';
import { CustomerRequest } from '../types';

export class FigmaCollectorService {
  private apiToken: string;
  
  constructor(
    private dbService: DatabaseService
  ) {
    this.apiToken = (process.env.FIGMA_ACCESS_TOKEN || '').trim();
  }

  async collectComments(fileKeys: string[]): Promise<number> {
    if (!this.apiToken) {
      console.log('⚠️  Figma API token not configured, skipping Figma collection');
      return 0;
    }

    console.log('🎨 Collecting Figma comments...');
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

    for (const fileKey of fileKeys) {
      try {
        const collected = await this.collectFileComments(fileKey, yesterdayNineAM, todayNineAM);
        totalCollected += collected;
      } catch (error) {
        console.error(`Error collecting Figma comments for file ${fileKey}:`, error);
      }
    }

    console.log(`✅ Collected ${totalCollected} Figma comments`);
    return totalCollected;
  }

  private async collectFileComments(
    fileKey: string, 
    startTime: Date, 
    endTime: Date
  ): Promise<number> {
    try {
      // Get file comments from Figma API
      const response = await axios.get(
        `https://api.figma.com/v1/files/${fileKey}/comments`,
        {
          headers: {
            'X-Figma-Token': this.apiToken
          }
        }
      );

      const comments = response.data.comments || [];
      let collected = 0;

      // Get file info for title
      const fileResponse = await axios.get(
        `https://api.figma.com/v1/files/${fileKey}`,
        {
          headers: {
            'X-Figma-Token': this.apiToken
          }
        }
      );
      const fileName = fileResponse.data.name || fileKey;
      
      console.log(`   📄 Processing Figma file: ${fileName}`);
      console.log(`   Found ${comments.length} comment threads`);

      // For testing, process all comments regardless of time
      let skippedResolved = 0;
      let skippedOld = 0;
      let skippedNotRequest = 0;

      for (const comment of comments.slice(0, 50)) { // Process first 50 for testing
        const createdAt = new Date(comment.created_at);
        
        // Skip resolved comments unless configured
        if (comment.resolved_at && process.env.FIGMA_INCLUDE_RESOLVED !== 'true') {
          skippedResolved++;
          continue;
        }
        
        // Process all comments without filtering
        const processed = await this.processComment(comment, fileKey, fileName);
        if (processed) {
          collected++;
          console.log(`   ✅ Processed: ${comment.user.handle} - ${comment.message.substring(0, 50)}...`);
        }
      }
      
      console.log(`   Skipped: ${skippedResolved} resolved, ${skippedOld} old, ${skippedNotRequest} non-requests`);

      return collected;
    } catch (error: any) {
      console.error(`Failed to fetch Figma comments: ${error.message}`);
      return 0;
    }
  }

  private isCustomerRequest(text: string, author?: string): boolean {
    // Check if it's from a client/PM
    if (author) {
      const clientAuthors = (process.env.FIGMA_CLIENT_AUTHORS || 'Lucy,heather,PM,최지선').split(',');
      const isClient = clientAuthors.some(client => 
        author.toLowerCase().includes(client.toLowerCase())
      );
      
      // If it's a client, always include
      if (isClient) return true;
    }
    
    // Otherwise check for request keywords
    const keywords = (process.env.REQUEST_KEYWORDS || '요청,문의,개선,오류,버그,수정,변경').split(',');
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  private async processComment(comment: any, fileKey: string, fileName: string): Promise<boolean> {
    try {
      // Check for duplicate
      const isDuplicate = await this.dbService.checkDuplicateRequest(comment.id, 'figma');
      if (isDuplicate) {
        return false;
      }

      // Build Figma comment URL
      const figmaUrl = `https://www.figma.com/file/${fileKey}/${fileName}?node-id=${comment.node_id || ''}#${comment.id}`;

      // Create customer request
      const request: Omit<CustomerRequest, 'id' | 'crNumber' | 'collectedAt' | 'updatedAt'> = {
        source: 'figma',
        sourceId: comment.id,
        requesterId: comment.user.id,
        requesterName: comment.user.handle,
        requesterEmail: comment.user.email,
        title: this.generateTitle(comment.message),
        description: comment.message,
        category: this.determineCategory(comment.message),
        priority: this.determinePriority(comment.message),
        channelName: `Figma: ${fileName}`,
        originalUrl: figmaUrl,
        status: 'new',
        requestedAt: new Date(comment.created_at),
      };

      // Save to database
      await this.dbService.saveCustomerRequest(request);
      return true;
      
    } catch (error) {
      console.error('Error processing Figma comment:', error);
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