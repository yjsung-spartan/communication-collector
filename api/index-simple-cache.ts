import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();

// CORS 설정 강화 - GPTs Actions 호환성
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// 간단한 메모리 캐시
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1시간 캐시

// 동적으로 최근 날짜 생성
const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const twoDaysAgo = new Date(today);
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

// 미리 정의된 데이터 (수동 업데이트용)
const STATIC_DATA = {
  fanlight: [
    {
      id: 'CONF-001',
      crNumber: 'CR-20250110-001',
      source: 'confluence',
      sourceId: 'comment-12345',
      requesterName: '김개발',
      title: '로그인 화면 개선 요청',
      description: '소셜 로그인 버튼이 너무 작아서 터치가 어렵습니다.',
      category: 'UI/UX',
      priority: 'high',
      channelName: 'Fanlight',
      originalUrl: 'https://fanlight-weplanet.atlassian.net/wiki/spaces/FL/pages/12345',
      requestedAt: yesterday.toISOString()
    },
    {
      id: 'FIGMA-001',
      crNumber: 'CR-20250110-002',
      source: 'figma',
      sourceId: 'comment-67890',
      requesterName: '박디자인',
      title: '결제 화면 플로우 검토',
      description: '쿠폰 적용 버튼 위치가 직관적이지 않습니다.',
      category: 'UI/UX',
      priority: 'medium',
      channelName: 'Fanlight',
      originalUrl: 'https://www.figma.com/file/abc123/Fanlight-Design',
      requestedAt: twoDaysAgo.toISOString()
    }
  ],
  momgleedu: [
    {
      id: 'CONF-002',
      crNumber: 'CR-20250110-003',
      source: 'confluence',
      sourceId: 'comment-11111',
      requesterName: '이기획',
      title: '회원가입 프로세스 간소화',
      description: '필수 입력 항목이 너무 많아 이탈률이 높습니다.',
      category: '기획/기능',
      priority: 'high',
      channelName: 'Momgleedu',
      originalUrl: 'https://momgle-edu.atlassian.net/wiki/spaces/ME/pages/67890',
      requestedAt: today.toISOString()
    }
  ]
};

// 데이터 로드 (파일이 있으면 파일에서, 없으면 static 데이터)
async function loadData() {
  const now = Date.now();
  
  // 캐시 체크
  if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedData;
  }

  try {
    // /tmp/data.json 파일 체크 (Vercel 임시 저장소)
    const dataPath = '/tmp/comm-collector-data.json';
    if (fs.existsSync(dataPath)) {
      const fileData = fs.readFileSync(dataPath, 'utf-8');
      cachedData = JSON.parse(fileData);
      console.log('Loaded from file cache');
    } else {
      // Static 데이터 사용
      cachedData = [...STATIC_DATA.fanlight, ...STATIC_DATA.momgleedu];
      console.log('Using static data');
    }
  } catch (error) {
    // 에러시 static 데이터 사용
    cachedData = [...STATIC_DATA.fanlight, ...STATIC_DATA.momgleedu];
    console.log('Fallback to static data');
  }

  lastFetchTime = now;
  return cachedData;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: 'simple-cache',
    cacheAge: lastFetchTime ? Math.floor((Date.now() - lastFetchTime) / 1000) + 's' : 'none'
  });
});

// Main API endpoint
app.get('/api/requests', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 파라미터 파싱
    const project = (req.query.project || req.query.projectTag || 'all') as string;
    const days = parseInt(req.query.days as string) || 30;
    const source = (req.query.source || 'all') as string;
    
    // 데이터 로드
    let data = await loadData();
    
    // 날짜 필터
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    data = data.filter((item: any) => new Date(item.requestedAt) >= cutoffDate);
    
    // 프로젝트 필터
    if (project !== 'all') {
      data = data.filter((item: any) => {
        const proj = project.toLowerCase();
        const channel = (item.channelName || '').toLowerCase();
        const url = (item.originalUrl || '').toLowerCase();
        
        if (proj === 'fanlight') {
          return channel.includes('fanlight') || url.includes('fanlight');
        } else if (proj.includes('momgle')) {
          return channel.includes('momgle') || url.includes('momgle');
        }
        return false;
      });
    }
    
    // 소스 필터
    if (source !== 'all') {
      data = data.filter((item: any) => item.source === source);
    }
    
    // 메타데이터 추가
    const enrichedData = data.map((item: any) => ({
      ...item,
      daysElapsed: Math.floor((Date.now() - new Date(item.requestedAt).getTime()) / (1000 * 60 * 60 * 24)),
      status: 'open',
      collectedAt: new Date().toISOString()
    }));
    
    // 소스별 카운트
    const sources = {
      slack: enrichedData.filter((r: any) => r.source === 'slack').length,
      figma: enrichedData.filter((r: any) => r.source === 'figma').length,
      confluence: enrichedData.filter((r: any) => r.source === 'confluence').length
    };
    
    // GPTs Actions 호환성을 위한 명시적 헤더 설정
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      total: enrichedData.length,
      data: enrichedData,
      filters: { project, days, source },
      sources,
      responseTime: `${Date.now() - startTime}ms`
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Summary endpoint
app.get('/api/summary', async (req, res) => {
  const data = await loadData();
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    stats: {
      total: data.length,
      bySource: {
        confluence: data.filter((r: any) => r.source === 'confluence').length,
        figma: data.filter((r: any) => r.source === 'figma').length,
        slack: 0
      },
      byPriority: {
        high: data.filter((r: any) => r.priority === 'high').length,
        medium: data.filter((r: any) => r.priority === 'medium').length,
        low: data.filter((r: any) => r.priority === 'low').length
      }
    }
  });
});

// LLM endpoint
app.get('/api/requests/llm', async (req, res) => {
  const project = req.query.project as string;
  let data = await loadData();
  
  if (project && project !== 'all') {
    data = data.filter((item: any) => {
      const proj = project.toLowerCase();
      const channel = (item.channelName || '').toLowerCase();
      return channel.includes(proj);
    });
  }
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      total: data.length,
      requests: data.map((item: any) => ({
        id: item.id,
        source: item.source,
        author: item.requesterName,
        content: item.description,
        timestamp: item.requestedAt,
        priority: item.priority,
        originalUrl: item.originalUrl
      }))
    }
  });
});

// 데이터 업데이트 endpoint (수동 업데이트용)
app.post('/api/update-data', express.json(), (req, res) => {
  try {
    const { data, secret } = req.body;
    
    // 간단한 인증
    if (secret !== process.env.UPDATE_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 파일로 저장
    fs.writeFileSync('/tmp/comm-collector-data.json', JSON.stringify(data));
    
    // 캐시 클리어
    cachedData = null;
    lastFetchTime = 0;
    
    res.json({ success: true, message: 'Data updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vercel Serverless Function Export
export default app;

// Local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Simple cache API running on port ${PORT}`);
  });
}