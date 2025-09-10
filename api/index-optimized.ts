import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DatabaseService } from '../src/services/databaseService';
import { CustomerRequest } from '../src/types';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 캐시 변수
let cachedData: CustomerRequest[] | null = null;
let cacheTimestamp: Date | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

// DB에서 데이터 조회만 (수집 X)
async function getStoredRequests(): Promise<CustomerRequest[]> {
  // 캐시 확인
  if (cachedData && cacheTimestamp) {
    const now = new Date();
    if (now.getTime() - cacheTimestamp.getTime() < CACHE_DURATION) {
      console.log('Using cached data');
      return cachedData;
    }
  }

  const dbService = new DatabaseService();
  await dbService.initialize();
  
  try {
    // DB에서 최근 30일 데이터만 조회
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const allRequests = await dbService.getAllRequests();
    const recentRequests = allRequests.filter(req => 
      new Date(req.requestedAt) >= thirtyDaysAgo
    );
    
    // 캐시 업데이트
    cachedData = recentRequests;
    cacheTimestamp = new Date();
    
    return recentRequests;
  } catch (error) {
    console.error('Error fetching from DB:', error);
    return [];
  } finally {
    await dbService.close();
  }
}

// Helper function to calculate days elapsed
function calculateDaysElapsed(requestDate: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - requestDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cached: cachedData !== null,
    cacheAge: cacheTimestamp ? Math.floor((new Date().getTime() - cacheTimestamp.getTime()) / 1000) : null
  });
});

// 빠른 응답을 위한 최적화된 endpoint
app.get('/api/requests', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Parse parameters
    const project = (req.query.project || req.query.projectTag) as string;
    const days = parseInt(req.query.days as string) || 30;
    const source = req.query.source as string;
    
    // DB에서 저장된 데이터만 가져오기 (수집 없음)
    const allRequests = await getStoredRequests();
    console.log(`Data fetched in ${Date.now() - startTime}ms`);
    
    // Apply filters
    let filteredRequests = allRequests;
    
    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    filteredRequests = filteredRequests.filter(req => 
      new Date(req.requestedAt) >= cutoffDate
    );
    
    // Filter by source
    if (source && source !== 'all') {
      filteredRequests = filteredRequests.filter(req => req.source === source);
    }
    
    // Filter by project
    if (project && project !== 'all') {
      filteredRequests = filteredRequests.filter(req => {
        if (req.source === 'confluence' && req.originalUrl) {
          const url = req.originalUrl.toLowerCase();
          if (project.toLowerCase() === 'fanlight') {
            return url.includes('fanlight-weplanet.atlassian.net');
          } else if (project.toLowerCase().includes('momgle')) {
            return url.includes('momgle-edu.atlassian.net');
          }
        }
        
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
    }
    
    // Add metadata
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
    
    console.log(`Total response time: ${Date.now() - startTime}ms`);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      total: enrichedRequests.length,
      data: enrichedRequests,
      filters: { project, days, source },
      sources: sourceCount,
      responseTime: `${Date.now() - startTime}ms`,
      cached: cachedData !== null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Summary endpoint (캐시 사용)
app.get('/api/summary', async (req, res) => {
  try {
    const requests = await getStoredRequests();
    
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
      stats.bySource[req.source] = (stats.bySource[req.source] || 0) + 1;
      stats.byPriority[req.priority] = (stats.byPriority[req.priority] || 0) + 1;
      stats.byCategory[req.category] = (stats.byCategory[req.category] || 0) + 1;
      
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
      stats,
      cached: cachedData !== null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// LLM endpoint (캐시 사용)
app.get('/api/requests/llm', async (req, res) => {
  try {
    const project = req.query.project as string;
    const requests = await getStoredRequests();
    
    let filteredRequests = requests;
    
    if (project && project !== 'all') {
      filteredRequests = requests.filter(req => {
        if (req.source === 'confluence' && req.originalUrl) {
          const url = req.originalUrl.toLowerCase();
          if (project.toLowerCase() === 'fanlight') {
            return url.includes('fanlight-weplanet.atlassian.net');
          } else if (project.toLowerCase().includes('momgle')) {
            return url.includes('momgle-edu.atlassian.net');
          }
        }
        return false;
      });
    }
    
    const formattedData = {
      total: filteredRequests.length,
      requests: filteredRequests.map(req => ({
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
      data: formattedData,
      cached: cachedData !== null
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 수동 데이터 수집 endpoint (별도 cron job이나 수동 실행용)
app.post('/api/collect', async (req, res) => {
  // 이 엔드포인트는 별도로 실행하여 DB를 업데이트
  res.json({
    success: true,
    message: 'Data collection should be done via scheduled job'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Optimized API server running on port ${PORT}`);
  console.log(`Cache duration: ${CACHE_DURATION / 1000}s`);
});