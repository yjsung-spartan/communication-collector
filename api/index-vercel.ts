// Vercel Serverless Function용 간단한 핸들러
export default async function handler(req: any, res: any) {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Mock 데이터
  const mockData = [
    {
      id: 'CONF-001',
      crNumber: 'CR-20250110-001',
      source: 'confluence',
      requesterName: 'Test User',
      title: 'Test Request',
      description: 'This is a test request',
      category: 'UI/UX',
      priority: 'high',
      channelName: 'Fanlight',
      requestedAt: new Date().toISOString()
    }
  ];
  
  // 라우팅
  if (pathname === '/health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }
  
  if (pathname === '/api/requests') {
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      total: mockData.length,
      data: mockData
    });
  }
  
  if (pathname === '/api/summary') {
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        total: mockData.length,
        bySource: { confluence: 1, figma: 0, slack: 0 },
        byPriority: { high: 1, medium: 0, low: 0 }
      }
    });
  }
  
  // 404
  return res.status(404).json({ error: 'Not found' });
}