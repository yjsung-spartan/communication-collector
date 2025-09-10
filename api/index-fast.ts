import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { CustomerRequest } from '../src/types';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Mock data for testing - GPTs용 임시 데이터
const mockData: CustomerRequest[] = [
  {
    id: 'CONF-001',
    crNumber: 'CR-20250110-001',
    source: 'confluence',
    sourceId: 'comment-12345',
    requesterId: 'user123',
    requesterName: '김개발',
    title: '로그인 화면 개선 요청',
    description: '소셜 로그인 버튼이 너무 작아서 터치가 어렵습니다. 크기를 키워주세요.',
    category: 'UI/UX',
    priority: 'high',
    channelId: 'FL',
    channelName: 'Fanlight',
    originalUrl: 'https://fanlight-weplanet.atlassian.net/wiki/spaces/FL/pages/12345',
    status: 'open',
    requestedAt: new Date('2025-01-09'),
    collectedAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'FIGMA-001',
    crNumber: 'CR-20250110-002',
    source: 'figma',
    sourceId: 'comment-67890',
    requesterId: 'designer456',
    requesterName: '박디자인',
    title: '결제 화면 플로우 검토',
    description: '쿠폰 적용 버튼 위치가 직관적이지 않습니다. 금액 입력란 근처로 이동 필요.',
    category: 'UI/UX',
    priority: 'medium',
    channelId: 'FL',
    channelName: 'Fanlight',
    originalUrl: 'https://www.figma.com/file/abc123/Fanlight-Design?node-id=456',
    status: 'open',
    requestedAt: new Date('2025-01-08'),
    collectedAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'CONF-002',
    crNumber: 'CR-20250110-003',
    source: 'confluence',
    sourceId: 'comment-11111',
    requesterId: 'pm789',
    requesterName: '이기획',
    title: '회원가입 프로세스 간소화',
    description: '필수 입력 항목이 너무 많아 이탈률이 높습니다. 단계적 가입 프로세스 도입 검토.',
    category: '기획/기능',
    priority: 'high',
    channelId: 'ME',
    channelName: 'Momgleedu',
    originalUrl: 'https://momgle-edu.atlassian.net/wiki/spaces/ME/pages/67890',
    status: 'open',
    requestedAt: new Date('2025-01-10'),
    collectedAt: new Date(),
    updatedAt: new Date()
  }
];

// Fast health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fast API endpoint - 즉시 응답
app.get('/api/requests', async (req, res) => {
  try {
    const project = (req.query.project || req.query.projectTag) as string;
    const days = parseInt(req.query.days as string) || 30;
    const source = req.query.source as string;
    
    // Filter mock data
    let filteredRequests = [...mockData];
    
    // Filter by date
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
      if (project.toLowerCase() === 'fanlight') {
        filteredRequests = filteredRequests.filter(req => 
          req.channelName?.toLowerCase().includes('fanlight') ||
          req.originalUrl?.includes('fanlight')
        );
      } else if (project.toLowerCase().includes('momgle')) {
        filteredRequests = filteredRequests.filter(req => 
          req.channelName?.toLowerCase().includes('momgle') ||
          req.originalUrl?.includes('momgle')
        );
      }
    }
    
    // Add elapsed days
    const enrichedRequests = filteredRequests.map(req => ({
      ...req,
      daysElapsed: Math.floor((new Date().getTime() - new Date(req.requestedAt).getTime()) / (1000 * 60 * 60 * 24)),
      isOld: false,
      isCritical: req.priority === 'high' || req.priority === 'urgent'
    }));
    
    // Count by source
    const sourceCount = {
      slack: 0,
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

// Fast summary endpoint
app.get('/api/summary', async (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    stats: {
      total: mockData.length,
      bySource: {
        confluence: 2,
        figma: 1,
        slack: 0
      },
      byPriority: {
        high: 2,
        medium: 1,
        low: 0
      },
      oldRequests: 0,
      criticalRequests: 2,
      averageDaysElapsed: 1
    }
  });
});

// Fast LLM endpoint
app.get('/api/requests/llm', async (req, res) => {
  const project = req.query.project as string;
  let data = [...mockData];
  
  if (project && project !== 'all') {
    if (project.toLowerCase() === 'fanlight') {
      data = data.filter(req => 
        req.channelName?.toLowerCase().includes('fanlight') ||
        req.originalUrl?.includes('fanlight')
      );
    } else if (project.toLowerCase().includes('momgle')) {
      data = data.filter(req => 
        req.channelName?.toLowerCase().includes('momgle') ||
        req.originalUrl?.includes('momgle')
      );
    }
  }
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      total: data.length,
      requests: data.map(req => ({
        id: req.id,
        source: req.source,
        author: req.requesterName,
        content: req.description,
        timestamp: req.requestedAt,
        priority: req.priority,
        originalUrl: req.originalUrl
      }))
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fast API server running on port ${PORT}`);
});