import axios from 'axios';
import { DatabaseService } from './databaseService';
import { CustomerRequest } from '../types';
import { AIProcessorService } from './aiProcessorService';

export class ConfluencePageCollectorService {
  private email: string;
  private apiToken: string;
  private fanlightDomain: string;
  private momgleeduDomain: string;
  private aiProcessor: AIProcessorService;
  
  constructor(
    private dbService: DatabaseService
  ) {
    // 통합된 인증 정보 (fanlight와 momgleedu 모두 동일)
    this.email = (process.env.CONFLUENCE_EMAIL || '').trim();
    this.apiToken = (process.env.CONFLUENCE_API_TOKEN || '').trim();
    
    // 도메인만 다름
    this.fanlightDomain = (process.env.CONFLUENCE_DOMAIN || 'fanlight-weplanet.atlassian.net').trim();
    this.momgleeduDomain = (process.env.MOMGLEEDU_CONFLUENCE_DOMAIN || 'momgle-edu.atlassian.net').trim();
    
    this.aiProcessor = new AIProcessorService();
  }

  async collectPagesAndComments(spaceKeys?: string[], source: 'fanlight' | 'momgleedu' = 'fanlight'): Promise<number> {
    // Select domain based on source (credentials are the same)
    const domain = source === 'momgleedu' ? this.momgleeduDomain : this.fanlightDomain;
    const email = this.email;
    const apiToken = this.apiToken;
    
    console.log(`🔍 Checking ${source} credentials:`);
    console.log(`   Domain: ${domain}`);
    console.log(`   Email: ${email}`);
    console.log(`   API Token: ${apiToken ? 'EXISTS' : 'MISSING'}`);
    
    if (!domain || !email || !apiToken) {
      console.log(`⚠️  ${source} Confluence credentials not configured`);
      return 0;
    }

    console.log(`📝 Collecting ${source} Confluence pages and comments...`);
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

    // For testing, use last 365 days to get all historical data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 365);

    try {
      // 1. Collect pages with request keywords
      const pageCount = await this.collectPages(thirtyDaysAgo, todayNineAM, spaceKeys, source);
      totalCollected += pageCount;
      
      // 2. Collect all comments
      const commentCount = await this.collectComments(thirtyDaysAgo, todayNineAM, spaceKeys, source);
      totalCollected += commentCount;
      
    } catch (error) {
      console.error('Error collecting Confluence data:', error);
    }

    console.log(`✅ Collected ${totalCollected} items from ${source} Confluence`);
    return totalCollected;
  }

  private async collectPages(startTime: Date, endTime: Date, spaceKeys?: string[], source: 'fanlight' | 'momgleedu' = 'fanlight'): Promise<number> {
    let collected = 0;
    const domain = source === 'momgleedu' ? this.momgleeduDomain : this.fanlightDomain;
    const email = this.email;
    const apiToken = this.apiToken;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    
    try {
      // Get pages created or modified in the time range
      // For testing, using 365 days to get all historical data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 365);
      
      let cql = `type=page and lastmodified >= "${this.formatDate(thirtyDaysAgo)}"`;
      
      if (spaceKeys && spaceKeys.length > 0) {
        const spaceFilter = spaceKeys.map(key => `space="${key}"`).join(' OR ');
        cql += ` and (${spaceFilter})`;
      }
      
      const response = await axios.get(
        `https://${domain}/wiki/rest/api/content/search`,
        {
          params: {
            cql: cql,
            limit: 100,
            expand: 'body.view,history.lastUpdated,space'
          },
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        }
      );
      
      const pages = response.data.results || [];
      console.log(`   Found ${pages.length} pages modified in last 30 days`);
      
      for (const page of pages) {
        const pageText = this.extractTextFromHtml(page.body?.view?.value || '');
        const fullText = page.title + ' ' + pageText;
        
        // Process all pages for now (remove strict filtering)
        // if (this.isStrongCustomerRequest(page.title, pageText)) {
          const processed = await this.processPage(page, source);
          if (processed) {
            collected++;
            console.log(`   ✅ Processed page: ${page.title}`);
          }
        // }
      }
    } catch (error: any) {
      console.error(`Error fetching pages:`, error.message);
    }
    
    return collected;
  }

  private async collectComments(startTime: Date, endTime: Date, spaceKeys?: string[], source: 'fanlight' | 'momgleedu' = 'fanlight'): Promise<number> {
    let collected = 0;
    const domain = source === 'momgleedu' ? this.momgleeduDomain : this.fanlightDomain;
    const email = this.email;
    const apiToken = this.apiToken;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    
    try {
      // First get all pages modified in the time range
      let pageCql = `type=page and lastmodified >= now("-365d")`;  // Last 365 days
      
      if (spaceKeys && spaceKeys.length > 0) {
        const spaceFilter = spaceKeys.map(key => `space="${key}"`).join(' OR ');
        pageCql += ` and (${spaceFilter})`;
      }
      
      const pagesResponse = await axios.get(
        `https://${domain}/wiki/rest/api/content/search`,
        {
          params: {
            cql: pageCql,
            limit: 100,
            expand: 'space'
          },
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        }
      );
      
      const pages = pagesResponse.data.results || [];
      console.log(`   Checking ${pages.length} pages for comments...`);
      
      let totalComments = 0;
      
      // Check each page for comments
      const useAI = process.env.USE_AI_FILTER === 'true';
      const allComments: any[] = [];
      
      for (const page of pages) {
        try {
          const commentsRes = await axios.get(
            `https://${domain}/wiki/rest/api/content/${page.id}/child/comment`,
            {
              params: {
                expand: 'body.view,history,version,ancestors'
              },
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
              }
            }
          );
          
          const comments = commentsRes.data.results || [];
          if (comments.length > 0) {
            totalComments += comments.length;
            
            // Collect all comments for batch processing
            for (const comment of comments) {
              const commentText = this.extractTextFromHtml(comment.body?.view?.value || '');
              comment.container = { title: page.title, id: page.id };
              comment.space = page.space;
              comment.cleanText = commentText;
              allComments.push(comment);
            }
          }
        } catch (err) {
          // Skip pages where we can't access comments
          continue;
        }
      }

      // Process comments (with AI or keyword-based)
      if (useAI && allComments.length > 0) {
        console.log(`   🤖 Using AI to analyze ${allComments.length} comments...`);
        
        // Batch process with AI
        const commentBatch = allComments.map(c => ({
          id: c.id,
          text: c.cleanText,
          author: c.history?.createdBy?.displayName || 'Unknown',
          pageTitle: c.container?.title || ''
        }));
        
        const aiResults = await this.aiProcessor.processCommentsBatch(commentBatch);
        
        for (const comment of allComments) {
          const aiResult = aiResults.get(comment.id);
          if (aiResult?.isRequest) {
            const processed = await this.processComment(comment, comment.cleanText, aiResult, source);
            if (processed) {
              collected++;
              console.log(`   ✅ AI: Processed comment on "${comment.container?.title}"`);
            }
          }
        }
      } else {
        // Fallback to keyword-based detection with author filtering
        for (const comment of allComments) {
          const author = comment.history?.createdBy?.displayName || 
                        comment.history?.lastUpdated?.by?.displayName || 'Unknown';
          
          // Process all comments without filtering
          const processed = await this.processComment(comment, comment.cleanText, null, source);
          if (processed) {
            collected++;
            const authorType = this.isClientAuthor(author) ? '👤 Client' : '👨‍💻 Internal';
            console.log(`   ✅ ${authorType}: Processed comment by ${author} on "${comment.container?.title}"`);
          }
        }
      }
      
      console.log(`   Found total ${totalComments} comments, ${collected} are customer requests`);
      
    } catch (error: any) {
      console.error(`Error fetching comments:`, error.message);
    }
    
    return collected;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isCustomerRequest(text: string, author?: string): boolean {
    // Author-based filtering
    if (process.env.FILTER_BY_AUTHOR === 'true' && author) {
      const isClient = this.isClientAuthor(author);
      const includeInternal = process.env.INCLUDE_INTERNAL === 'true';
      
      // If it's a client, always include
      if (isClient) {
        return true;
      }
      
      // If it's internal and we don't include internal, skip
      if (!isClient && !includeInternal) {
        return false;
      }
    }
    
    // Keyword-based filtering (for internal developers or when author filtering is off)
    const keywords = (process.env.REQUEST_KEYWORDS || '요청,문의,개선,오류,버그,수정,변경,이슈').split(',');
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }
  
  private isClientAuthor(author: string): boolean {
    const clientAuthors = (process.env.CLIENT_AUTHORS || 'heather,client,customer').split(',');
    const lowerAuthor = author.toLowerCase();
    return clientAuthors.some(client => lowerAuthor.includes(client.toLowerCase()));
  }
  
  private isInternalAuthor(author: string): boolean {
    const internalAuthors = (process.env.INTERNAL_AUTHORS || 'iOS,Android,DANIEL,LUCY,LILY').split(',');
    const lowerAuthor = author.toLowerCase();
    return internalAuthors.some(internal => lowerAuthor.includes(internal.toLowerCase()));
  }

  private isStrongCustomerRequest(title: string, content: string): boolean {
    // More strict filtering for pages (not comments)
    // Avoid collecting general documentation pages
    const strongKeywords = ['긴급', '오류', '버그', '안됨', '문제', '이슈', '수정 요청', '개선 요청'];
    const combinedText = (title + ' ' + content).toLowerCase();
    
    // Check if title contains request-like patterns
    const titlePatterns = [
      /\[요청\]/,
      /\[버그\]/,
      /\[이슈\]/,
      /\[문의\]/,
      /확인.*필요/,
      /수정.*요청/
    ];
    
    // If title matches specific patterns, it's likely a request
    if (titlePatterns.some(pattern => pattern.test(title))) {
      return true;
    }
    
    // Check for strong keywords in content
    return strongKeywords.some(keyword => combinedText.includes(keyword));
  }

  private async processPage(page: any, source: 'fanlight' | 'momgleedu' = 'fanlight'): Promise<boolean> {
    try {
      // Check for duplicate
      const isDuplicate = await this.dbService.checkDuplicateRequest(`page-${page.id}`, 'confluence');
      if (isDuplicate) {
        return false;
      }

      const domain = source === 'momgleedu' ? this.momgleeduDomain : this.fanlightDomain;
      const pageUrl = `https://${domain}/wiki${page._links?.webui || `/spaces/${page.space?.key}/pages/${page.id}`}`;
      const pageText = this.extractTextFromHtml(page.body?.view?.value || '');
      
      // Create customer request from page
      const request: Omit<CustomerRequest, 'id' | 'crNumber' | 'collectedAt' | 'updatedAt'> = {
        source: 'confluence',
        sourceId: `page-${page.id}`,
        requesterId: page.history?.lastUpdated?.by?.accountId || 'unknown',
        requesterName: page.history?.lastUpdated?.by?.displayName || 'Unknown',
        requesterEmail: page.history?.lastUpdated?.by?.email,
        title: page.title,
        description: pageText.substring(0, 1000), // Limit description length
        category: this.determineCategory(page.title + ' ' + pageText),
        priority: this.determinePriority(page.title + ' ' + pageText, page.history?.lastUpdated?.by?.displayName),
        channelName: `Confluence Page: ${page.space?.name || 'Unknown Space'}`,
        originalUrl: pageUrl,
        status: 'new',
        requestedAt: this.parseConfluenceDate(page.history?.lastUpdated?.when || page.history?.created?.when || new Date().toISOString()),
      };

      await this.dbService.saveCustomerRequest(request);
      return true;
      
    } catch (error) {
      console.error('Error processing page:', error);
      return false;
    }
  }

  private async processComment(comment: any, commentText: string, aiResult?: any, source: 'fanlight' | 'momgleedu' = 'fanlight'): Promise<boolean> {
    try {
      // Check for duplicate
      const isDuplicate = await this.dbService.checkDuplicateRequest(comment.id, 'confluence');
      if (isDuplicate) {
        return false;
      }

      const domain = source === 'momgleedu' ? this.momgleeduDomain : this.fanlightDomain;
      const pageUrl = comment._links?.webui || '';
      const confluenceUrl = `https://${domain}/wiki${pageUrl}`;
      
      // Get author info
      const authorName = comment.history?.created?.by?.displayName || 
                        comment.history?.lastUpdated?.by?.displayName ||
                        comment.version?.by?.displayName || 'Unknown';
      const authorEmail = comment.history?.created?.by?.email ||
                         comment.history?.lastUpdated?.by?.email ||
                         comment.version?.by?.email;

      // Get parent page title
      const containerTitle = comment.container?.title || 'Unknown Page';

      // Create customer request
      const request: Omit<CustomerRequest, 'id' | 'crNumber' | 'collectedAt' | 'updatedAt'> = {
        source: 'confluence',
        sourceId: comment.id,
        requesterId: comment.history?.createdBy?.accountId || 
                    comment.history?.lastUpdated?.by?.accountId || 'unknown',
        requesterName: authorName,
        requesterEmail: authorEmail,
        title: aiResult?.summary || this.generateTitle(commentText),
        description: commentText,
        category: aiResult?.category || this.determineCategory(commentText),
        priority: aiResult?.priority || this.determinePriority(commentText, authorName),
        channelName: `Confluence Comment on: ${containerTitle}`,
        originalUrl: confluenceUrl,
        status: 'new',
        requestedAt: this.parseConfluenceDate(
          comment.history?.created?.when || 
          comment.history?.lastUpdated?.when ||
          comment.version?.when
        ),
      };

      await this.dbService.saveCustomerRequest(request);
      return true;
      
    } catch (error) {
      console.error('Error processing comment:', error);
      return false;
    }
  }

  private determinePriority(text: string, author?: string): CustomerRequest['priority'] {
    const lowerText = text.toLowerCase();
    const urgentKeywords = (process.env.URGENT_KEYWORDS || '긴급,급함,ASAP,장애,다운,먹통,중단,멈춤').split(',');
    const highKeywords = (process.env.HIGH_KEYWORDS || '중요,우선,빠른,시급').split(',');
    const lowKeywords = (process.env.LOW_KEYWORDS || '검토,고려,제안,아이디어').split(',');
    
    // Check for urgent keywords
    if (urgentKeywords.some(k => lowerText.includes(k.toLowerCase()))) {
      return 'urgent';
    }
    
    // Bug reports get at least high priority
    if (lowerText.includes('버그') || lowerText.includes('오류') || 
        lowerText.includes('에러') || lowerText.includes('안됨') ||
        lowerText.includes('실패') || lowerText.includes('안돼')) {
      return 'high';
    }
    
    // Check for high priority keywords
    if (highKeywords.some(k => lowerText.includes(k.toLowerCase()))) {
      return 'high';
    }
    
    // Check for low priority keywords
    if (lowKeywords.some(k => lowerText.includes(k.toLowerCase()))) {
      return 'low';
    }
    
    // Client requests get medium priority by default
    if (author && this.isClientAuthor(author)) {
      return 'medium';
    }
    
    // Default is medium
    return 'medium';
  }

  private determineCategory(text: string): CustomerRequest['category'] {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('버그') || lowerText.includes('오류') || 
        lowerText.includes('에러') || lowerText.includes('안됨')) {
      return 'bug';
    }
    if (lowerText.includes('개선') || lowerText.includes('변경') || 
        lowerText.includes('수정')) {
      return 'improvement';
    }
    if (lowerText.includes('추가') || lowerText.includes('신규') || 
        lowerText.includes('새로운')) {
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

  private parseConfluenceDate(dateString: string | undefined): Date {
    if (!dateString) {
      return new Date();
    }
    
    try {
      // Confluence dates are typically in ISO format
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date string: ${dateString}`);
        return new Date();
      }
      
      return date;
    } catch (error) {
      console.error(`Error parsing date: ${dateString}`, error);
      return new Date();
    }
  }
}