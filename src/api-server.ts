import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DatabaseService } from './services/databaseService';
import { BatchCollectorService } from './services/batchCollectorService';
import { FigmaCollectorService } from './services/figmaCollectorService';
import { ConfluencePageCollectorService } from './services/confluencePageCollectorService';
import { MDExportService } from './services/mdExportService';
import { App, LogLevel } from '@slack/bolt';
import { CustomerRequest } from './types';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Collection function
async function collectRequests(): Promise<CustomerRequest[]> {
  const dbService = new DatabaseService();
  await dbService.initialize();
  
  let slackCollector: BatchCollectorService | null = null;
  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
    const slackApp = new App({
      token: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET || '',
      socketMode: false,
      logLevel: LogLevel.ERROR,
    });
    
    const config = {
      slackBotToken: process.env.SLACK_BOT_TOKEN,
      slackAppToken: process.env.SLACK_APP_TOKEN,
      slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
      monitorChannels: (process.env.MONITOR_CHANNELS || '').split(',').filter(c => c),
      reportChannel: process.env.REPORT_CHANNEL || '',
      requestKeywords: (process.env.REQUEST_KEYWORDS || '요청,문의,개선,오류,버그').split(','),
      urgentKeywords: (process.env.URGENT_KEYWORDS || '긴급,급함,ASAP').split(','),
      highKeywords: (process.env.HIGH_KEYWORDS || '중요,우선').split(','),
      lowKeywords: (process.env.LOW_KEYWORDS || '검토,고려,제안').split(','),
      dailyReportCron: '0 9 * * *'
    };
    
    slackCollector = new BatchCollectorService(slackApp, config, dbService);
  }
  
  const figmaCollector = new FigmaCollectorService(dbService);
  const confluenceCollector = new ConfluencePageCollectorService(dbService);
  
  let allRequests: CustomerRequest[] = [];
  
  // Collect from all sources
  if (slackCollector) {
    await slackCollector.collectYesterdayRequests();
  }
  
  const figmaFiles = (process.env.FIGMA_FILE_KEYS || '').split(',').filter(f => f);
  if (figmaFiles.length > 0) {
    await figmaCollector.collectComments(figmaFiles);
  }
  
  const confluenceSpaces = (process.env.CONFLUENCE_SPACES || '').split(',').filter(s => s);
  await confluenceCollector.collectPagesAndComments(confluenceSpaces);
  
  // Get all collected requests
  allRequests = await dbService.getYesterdayRequests();
  
  await dbService.close();
  
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

// Get latest collected requests (from stored JSON)
app.get('/api/requests', async (req, res) => {
  try {
    // Try to read from stored JSON first
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.join(__dirname, '..', 'data', 'latest.json');
    
    if (fs.existsSync(dataPath)) {
      const storedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      const requests = storedData.requests || [];
      
      // Add elapsed days to each request
      const enrichedRequests = requests.map((req: any) => ({
        ...req,
        daysElapsed: calculateDaysElapsed(new Date(req.requestedAt)),
        isOld: calculateDaysElapsed(new Date(req.requestedAt)) > 7,
        isCritical: calculateDaysElapsed(new Date(req.requestedAt)) > 3 && 
                    (req.priority === 'urgent' || req.priority === 'high')
      }));
      
      res.json({
        success: true,
        timestamp: storedData.metadata?.timestamp || new Date().toISOString(),
        total: enrichedRequests.length,
        dataSource: 'cached',
        data: enrichedRequests
      });
    } else {
      // Fallback to real-time collection if no cached data
      const requests = await collectRequests();
      
      // Add elapsed days to each request
      const enrichedRequests = requests.map(req => ({
        ...req,
        daysElapsed: calculateDaysElapsed(req.requestedAt),
        isOld: calculateDaysElapsed(req.requestedAt) > 7,
        isCritical: calculateDaysElapsed(req.requestedAt) > 3 && 
                    (req.priority === 'urgent' || req.priority === 'high')
      }));
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        total: enrichedRequests.length,
        dataSource: 'real-time',
        data: enrichedRequests
      });
    }
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
      const isInternalResponse = internalAuthors.some(author => 
        req.requesterName?.includes(author)
      );
      return !isInternalResponse || req.category === 'bug' || req.category === 'new_feature';
    });
    
    const resolvedRequests = requests.filter(req => {
      const isInternalResponse = internalAuthors.some(author => 
        req.requesterName?.includes(author)
      );
      return isInternalResponse && req.category !== 'bug' && req.category !== 'new_feature';
    });
    
    // Group unresolved by priority
    const grouped = {
      urgent: unresolvedRequests.filter(r => r.priority === 'urgent'),
      high: unresolvedRequests.filter(r => r.priority === 'high'),
      medium: unresolvedRequests.filter(r => r.priority === 'medium'),
      low: unresolvedRequests.filter(r => r.priority === 'low')
    };
    
    // Format for LLM
    const llmFormat = {
      summary: {
        total: requests.length,
        unresolved: unresolvedRequests.length,
        resolved: resolvedRequests.length,
        urgent: grouped.urgent.length,
        high: grouped.high.length,
        requiresImmediateAttention: unresolvedRequests.filter(r => 
          calculateDaysElapsed(r.requestedAt) > 3 && 
          (r.priority === 'urgent' || r.priority === 'high')
        ).length
      },
      unresolvedRequests: Object.entries(grouped).map(([priority, items]) => ({
        priority,
        items: items.map(req => ({
          id: req.crNumber,
          title: req.title,
          description: req.description,
          requester: req.requesterName,
          source: req.source,
          category: req.category,
          daysElapsed: calculateDaysElapsed(req.requestedAt),
          requestedAt: req.requestedAt
        }))
      })),
      resolvedRequests: resolvedRequests.map(req => ({
        id: req.crNumber,
        title: req.title,
        description: req.description,
        resolver: req.requesterName, // In this case, internal person who responded
        source: req.source,
        category: req.category,
        resolvedAt: req.requestedAt // Would be response time in real implementation
      })),
      context: {
        collectionTime: new Date().toISOString(),
        sources: ['slack', 'confluence', 'figma'],
        clientAuthors: (process.env.CLIENT_AUTHORS || 'heather,client').split(','),
        internalAuthors: internalAuthors,
        note: 'Resolved requests are identified by internal team responses. Full conversation threading would require additional implementation.'
      }
    };
    
    res.json(llmFormat);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Trigger manual collection
app.post('/api/collect', async (req, res) => {
  try {
    const requests = await collectRequests();
    
    res.json({
      success: true,
      message: 'Collection completed',
      collected: requests.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export as markdown
app.get('/api/export/markdown', async (req, res) => {
  try {
    const requests = await collectRequests();
    const mdExporter = new MDExportService();
    const filepath = await mdExporter.exportToMarkdown(requests, new Date());
    
    res.json({
      success: true,
      filepath,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// OpenAPI schema for GPTs Actions
app.get('/openapi.json', (req, res) => {
  const schema = {
    openapi: '3.0.0',
    info: {
      title: 'WeplaNet Customer Request API',
      version: '1.0.0',
      description: 'API for collecting and analyzing customer requests from multiple sources'
    },
    servers: [
      {
        url: process.env.API_URL || `http://localhost:${PORT}`
      }
    ],
    paths: {
      '/api/requests': {
        get: {
          summary: 'Get all customer requests',
          description: 'Retrieves all collected customer requests with elapsed time information',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      timestamp: { type: 'string' },
                      total: { type: 'number' },
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            crNumber: { type: 'string' },
                            title: { type: 'string' },
                            description: { type: 'string' },
                            priority: { type: 'string' },
                            category: { type: 'string' },
                            requesterName: { type: 'string' },
                            source: { type: 'string' },
                            daysElapsed: { type: 'number' },
                            isOld: { type: 'boolean' },
                            isCritical: { type: 'boolean' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/summary': {
        get: {
          summary: 'Get summary statistics',
          description: 'Returns aggregated statistics about customer requests',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      timestamp: { type: 'string' },
                      stats: {
                        type: 'object',
                        properties: {
                          total: { type: 'number' },
                          bySource: { type: 'object' },
                          byPriority: { type: 'object' },
                          byCategory: { type: 'object' },
                          oldRequests: { type: 'number' },
                          criticalRequests: { type: 'number' },
                          averageDaysElapsed: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/requests/llm': {
        get: {
          summary: 'Get LLM-formatted requests',
          description: 'Returns requests in a format optimized for LLM processing and task generation',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            }
          }
        }
      }
    }
  };
  
  res.json(schema);
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📚 OpenAPI schema available at http://localhost:${PORT}/openapi.json`);
  console.log(`🔍 Test endpoints:`);
  console.log(`   - GET /health`);
  console.log(`   - GET /api/requests`);
  console.log(`   - GET /api/summary`);
  console.log(`   - GET /api/requests/llm`);
  console.log(`   - POST /api/collect`);
});