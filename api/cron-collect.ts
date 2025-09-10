// Vercel Cron Job용 데이터 수집 스크립트
// vercel.json에 cron 설정 추가 필요

import { DatabaseService } from '../src/services/databaseService';
import { FigmaCollectorService } from '../src/services/figmaCollectorService';
import { ConfluencePageCollectorService } from '../src/services/confluencePageCollectorService';
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req: any, res: any) {
  // Cron job 인증 (선택적)
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dbService = new DatabaseService();
  await dbService.initialize();
  
  const results = {
    figma: 0,
    fanlight: 0,
    momgleedu: 0,
    errors: [] as string[]
  };
  
  try {
    // Figma 수집
    if (process.env.FIGMA_ACCESS_TOKEN) {
      try {
        const figmaFiles = (process.env.FIGMA_FILE_KEYS || '').split(',').filter(f => f);
        if (figmaFiles.length > 0) {
          const figmaCollector = new FigmaCollectorService(dbService);
          await figmaCollector.collectComments(figmaFiles);
          results.figma = figmaFiles.length;
        }
      } catch (error: any) {
        results.errors.push(`Figma: ${error.message}`);
      }
    }
    
    // Fanlight Confluence 수집
    if (process.env.CONFLUENCE_API_TOKEN) {
      try {
        const confluenceCollector = new ConfluencePageCollectorService(dbService);
        const spaces = (process.env.CONFLUENCE_SPACES || '').split(',').filter(s => s);
        const count = await confluenceCollector.collectPagesAndComments(spaces, 'fanlight');
        results.fanlight = count;
      } catch (error: any) {
        results.errors.push(`Fanlight: ${error.message}`);
      }
    }
    
    // Momgleedu Confluence 수집
    if (process.env.MOMGLEEDU_CONFLUENCE_API_TOKEN) {
      try {
        const confluenceCollector = new ConfluencePageCollectorService(dbService);
        const spaces = (process.env.MOMGLEEDU_CONFLUENCE_SPACES || '').split(',').filter(s => s);
        const count = await confluenceCollector.collectPagesAndComments(spaces, 'momgleedu');
        results.momgleedu = count;
      } catch (error: any) {
        results.errors.push(`Momgleedu: ${error.message}`);
      }
    }
    
    // 캐시 무효화 플래그 설정 (옵션)
    await dbService.close();
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      collected: results,
      message: 'Data collection completed'
    });
    
  } catch (error: any) {
    await dbService.close();
    res.status(500).json({
      success: false,
      error: error.message,
      results
    });
  }
}