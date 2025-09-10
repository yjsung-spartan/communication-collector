import Database from 'better-sqlite3';
import path from 'path';

// Vercel Serverless Function - SQLite DB에서 데이터 읽기
export default async function handler(req: any, res: any) {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 파라미터 파싱
  const project = searchParams.get('project') || 'all';
  const days = parseInt(searchParams.get('days') || '30');
  
  // 라우팅
  if (pathname === '/health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dataSource: 'SQLite cache'
    });
  }
  
  if (pathname === '/requests' || pathname === '/api/requests') {
    try {
      // SQLite DB 연결 (public 폴더에서)
      const dbPath = path.join(process.cwd(), 'public', 'requests.db');
      const db = new Database(dbPath, { readonly: true });
      
      // 쿼리 작성
      let query = `
        SELECT * FROM customer_requests 
        WHERE datetime(requested_at) >= datetime('now', '-${days} days')
      `;
      
      const params: any[] = [];
      
      // 프로젝트 필터
      if (project !== 'all') {
        if (project === 'fanlight') {
          query += ` AND original_url LIKE '%fanlight-weplanet.atlassian.net%'`;
        } else if (project === 'momgleedu' || project === 'momgle-edu') {
          query += ` AND original_url LIKE '%momgle-edu.atlassian.net%'`;
        }
      }
      
      query += ` ORDER BY requested_at DESC`;
      
      // 데이터 조회
      const rows = db.prepare(query).all();
      
      // 결과 포맷팅
      const requests = rows.map((row: any) => ({
        id: row.id,
        crNumber: row.cr_number,
        source: row.source,
        requesterName: row.requester_name,
        title: row.title,
        description: row.description,
        category: row.category,
        priority: row.priority,
        channelName: row.channel_name,
        requestedAt: row.requested_at,
        status: row.status,
        originalUrl: row.original_url,
        daysElapsed: Math.floor((Date.now() - new Date(row.requested_at).getTime()) / (1000 * 60 * 60 * 24))
      }));
      
      // 소스별 카운트
      const sourceCount = {
        confluence: requests.filter(r => r.source === 'confluence').length,
        figma: requests.filter(r => r.source === 'figma').length,
        slack: requests.filter(r => r.source === 'slack').length
      };
      
      db.close();
      
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        total: requests.length,
        data: {
          total: requests.length,
          requests: requests
        },
        filters: { project, days },
        sources: sourceCount
      });
      
    } catch (error: any) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  if (pathname === '/summary' || pathname === '/api/summary') {
    try {
      const dbPath = path.join(process.cwd(), 'public', 'requests.db');
      const db = new Database(dbPath, { readonly: true });
      
      const total = db.prepare('SELECT COUNT(*) as count FROM customer_requests').get();
      const bySource = db.prepare(`
        SELECT source, COUNT(*) as count 
        FROM customer_requests 
        GROUP BY source
      `).all();
      
      const byPriority = db.prepare(`
        SELECT priority, COUNT(*) as count 
        FROM customer_requests 
        GROUP BY priority
      `).all();
      
      db.close();
      
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        stats: {
          total: total.count,
          bySource: Object.fromEntries(bySource.map(r => [r.source, r.count])),
          byPriority: Object.fromEntries(byPriority.map(r => [r.priority, r.count]))
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  return res.status(404).json({ error: 'Not found' });
}