import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DatabaseService } from '../src/services/databaseService';
import { BatchCollectorService } from '../src/services/batchCollectorService';
import { FigmaCollectorService } from '../src/services/figmaCollectorService';
import { ConfluencePageCollectorService } from '../src/services/confluencePageCollectorService';
import { MDExportService } from '../src/services/mdExportService';
import { App, LogLevel } from '@slack/bolt';
import { CustomerRequest } from '../src/types';
import { TaskConverterService } from '../src/services/taskConverterService';
import { setupSlackEndpoints } from './slack-endpoint';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Setup Slack endpoints
setupSlackEndpoints(app);

// Collection function
async function collectRequests(): Promise<CustomerRequest[]> {
  const dbService = new DatabaseService();
  await dbService.initialize();
  
  let allRequests: CustomerRequest[] = [];
  
  try {
    // Skip Slack collection for now - not configured
    console.log('Skipping Slack - not configured');
    
    // Collect from Figma if configured
    const figmaFiles = (process.env.FIGMA_FILE_KEYS || '').split(',').filter(f => f);
    if (figmaFiles.length > 0 && process.env.FIGMA_ACCESS_TOKEN) {
      console.log('Collecting from Figma...');
      const figmaCollector = new FigmaCollectorService(dbService);
      await figmaCollector.collectComments(figmaFiles);
    }
    
    // Collect from Fanlight Confluence
    if (process.env.CONFLUENCE_API_TOKEN) {
      console.log('Collecting from Fanlight Confluence...');
      console.log('API Token exists:', !!process.env.CONFLUENCE_API_TOKEN);
      console.log('Domain:', process.env.CONFLUENCE_DOMAIN);
      const confluenceCollector = new ConfluencePageCollectorService(dbService);
      const confluenceSpaces = (process.env.CONFLUENCE_SPACES || '').split(',').filter(s => s);
      
      try {
        if (confluenceSpaces.length === 0) {
          // If no specific spaces, try to get all spaces
          await confluenceCollector.collectPagesAndComments([], 'fanlight');
        } else {
          await confluenceCollector.collectPagesAndComments(confluenceSpaces, 'fanlight');
        }
      } catch (error: any) {
        console.error('Error collecting from Fanlight:', error.message);
      }
    }
    
    // Collect from Momgleedu Confluence if configured
    if (process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN) {
      console.log('Collecting from Momgleedu Confluence...');
      console.log('Momgleedu API Token exists:', !!process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN);
      console.log('Momgleedu Domain:', process.env.MOMGLEEDU_CONFLUENCE_DOMAIN);
      const confluenceCollector = new ConfluencePageCollectorService(dbService);
      const momgleeduSpaces = (process.env.MOMGLEEDU_CONFLUENCE_SPACES || '').split(',').filter(s => s);
      
      try {
        console.log('Momgleedu spaces:', momgleeduSpaces.length === 0 ? 'All spaces' : momgleeduSpaces.join(', '));
        const count = await confluenceCollector.collectPagesAndComments(
          momgleeduSpaces.length === 0 ? [] : momgleeduSpaces, 
          'momgleedu'
        );
        console.log('Momgleedu collection complete. Items collected:', count);
      } catch (error: any) {
        console.error('Error collecting from Momgleedu:', error.message);
        console.error('Error stack:', error.stack);
      }
    } else {
      console.log('Momgleedu API token not configured');
    }
    
    // Get all collected requests
    allRequests = await dbService.getYesterdayRequests();
    
    // If still no data, get all requests (not just yesterday)
    if (allRequests.length === 0) {
      console.log('No yesterday requests, getting all requests...');
      allRequests = await dbService.getAllRequests();
    }
    
  } catch (error: any) {
    console.error('Error in collectRequests:', error.message);
  } finally {
    await dbService.close();
  }
  
  return allRequests;
}

// Helper function to calculate days elapsed
function calculateDaysElapsed(requestDate: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - requestDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    env: {
      CONFLUENCE_API_TOKEN: !!process.env.CONFLUENCE_API_TOKEN,
      CONFLUENCE_DOMAIN: process.env.CONFLUENCE_DOMAIN,
      CONFLUENCE_EMAIL: process.env.CONFLUENCE_EMAIL,
      MOMGLEEDU_CONFLUENCE_API_TOKEN: !!process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN,
      MOMGLEEDU_CONFLUENCE_DOMAIN: process.env.MOMGLEEDU_CONFLUENCE_DOMAIN,
      MOMGLEEDU_CONFLUENCE_EMAIL: process.env.MOMGLEEDU_CONFLUENCE_EMAIL,
      FIGMA_ACCESS_TOKEN: !!process.env.FIGMA_ACCESS_TOKEN,
      FIGMA_FILE_KEYS: process.env.FIGMA_FILE_KEYS
    }
  });
});

// Get latest collected requests
app.get('/api/requests', async (req, res) => {
  try {
    console.log('API /api/requests called with params:', req.query);
    
    // Parse query parameters - support both 'project' and 'projectTag'
    const project = (req.query.project || req.query.projectTag) as string;
    const days = parseInt(req.query.days as string) || 30;
    const source = req.query.source as string;
    
    console.log(`Filters - Project: ${project || 'all'}, Days: ${days}, Source: ${source || 'all'}`);
    
    // Always collect fresh data first
    const allRequests = await collectRequests();
    console.log(`Collection complete. Found ${allRequests.length} total requests`);
    
    // Apply filters
    let filteredRequests = allRequests;
    
    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    filteredRequests = filteredRequests.filter(req => 
      new Date(req.requestedAt) >= cutoffDate
    );
    console.log(`After date filter (${days} days): ${filteredRequests.length} requests`);
    
    // Filter by source if specified
    if (source && source !== 'all') {
      filteredRequests = filteredRequests.filter(req => req.source === source);
      console.log(`After source filter (${source}): ${filteredRequests.length} requests`);
    }
    
    // Filter by project if specified (URL-based filtering for Confluence)
    if (project && project !== 'all') {
      filteredRequests = filteredRequests.filter(req => {
        // For Confluence sources, use URL-based filtering
        if (req.source === 'confluence' && req.originalUrl) {
          const url = req.originalUrl.toLowerCase();
          
          // Project mapping based on Confluence domains
          if (project.toLowerCase() === 'fanlight') {
            return url.includes('fanlight-weplanet.atlassian.net');
          } else if (project.toLowerCase() === 'momgleedu' || project.toLowerCase() === 'momgle-edu' || project.toLowerCase() === 'momgle') {
            return url.includes('momgle-edu.atlassian.net');
          }
        }
        
        // For non-Confluence sources, use flexible text matching
        const normalizedProject = project.toLowerCase().replace(/[-_\s]/g, '');
        const searchFields = [
          req.channelName?.toLowerCase() || '',
          req.title?.toLowerCase() || '',
          req.description?.toLowerCase() || ''
        ];
        
        return searchFields.some(field => {
          const normalizedField = field.replace(/[-_\s]/g, '');
          return normalizedField.includes(normalizedProject) || 
                 field.includes(project.toLowerCase());
        });
      });
      console.log(`After project filter (${project}): ${filteredRequests.length} requests`);
    }
    
    // Check if no data found
    if (!filteredRequests || filteredRequests.length === 0) {
      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        total: 0,
        data: [],
        message: `조회된 데이터가 없습니다. (프로젝트: ${project || '전체'}, 기간: ${days}일, 소스: ${source || '전체'})`,
        filters: { project, days, source },
        sources: {
          slack: 0,
          figma: 0,
          confluence: 0
        }
      });
    }
    
    // Add elapsed days to each request
    const enrichedRequests = filteredRequests.map(req => ({
      ...req,
      daysElapsed: calculateDaysElapsed(req.requestedAt),
      isOld: calculateDaysElapsed(req.requestedAt) > 7,
      isCritical: calculateDaysElapsed(req.requestedAt) > 3 && 
                  (req.priority === 'urgent' || req.priority === 'high')
    }));
    
    // Count by source
    const sourceCount = {
      slack: enrichedRequests.filter(r => r.source === 'slack').length,
      figma: enrichedRequests.filter(r => r.source === 'figma').length,
      confluence: enrichedRequests.filter(r => r.source === 'confluence').length
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      total: enrichedRequests.length,
      data: enrichedRequests,
      filters: { project, days, source },
      sources: sourceCount
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get summary statistics
app.get('/api/summary', async (req, res) => {
  try {
    const requests = await collectRequests();
    
    const stats = {
      total: requests.length,
      bySource: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      oldRequests: 0,
      criticalRequests: 0,
      averageDaysElapsed: 0
    };
    
    let totalDays = 0;
    
    for (const req of requests) {
      // Count by source
      stats.bySource[req.source] = (stats.bySource[req.source] || 0) + 1;
      
      // Count by priority
      stats.byPriority[req.priority] = (stats.byPriority[req.priority] || 0) + 1;
      
      // Count by category
      stats.byCategory[req.category] = (stats.byCategory[req.category] || 0) + 1;
      
      // Calculate elapsed days
      const daysElapsed = calculateDaysElapsed(req.requestedAt);
      totalDays += daysElapsed;
      
      if (daysElapsed > 7) stats.oldRequests++;
      if (daysElapsed > 3 && (req.priority === 'urgent' || req.priority === 'high')) {
        stats.criticalRequests++;
      }
    }
    
    stats.averageDaysElapsed = requests.length > 0 ? Math.round(totalDays / requests.length) : 0;
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get requests formatted for LLM processing
app.get('/api/requests/llm', async (req, res) => {
  try {
    const requests = await collectRequests();
    
    // Separate resolved (has internal response) vs unresolved
    const internalAuthors = (process.env.INTERNAL_AUTHORS || 'iOS,Android,DANIEL,LUCY,LILY').split(',');
    
    // Check if request has internal response (simplified logic - in real app would track responses)
    const unresolvedRequests = requests.filter(req => {
      // If requester is internal and it's a response/answer, skip it
      const isInternal = internalAuthors.some(author => 
        req.requesterName?.toLowerCase().includes(author.toLowerCase())
      );
      return !isInternal;
    });
    
    const formattedData = {
      total: unresolvedRequests.length,
      requests: unresolvedRequests.map(req => ({
        id: req.id,
        source: req.source,
        author: req.requesterName,
        content: req.description,
        timestamp: req.requestedAt,
        priority: req.priority,
        originalUrl: req.originalUrl
      }))
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: formattedData
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});