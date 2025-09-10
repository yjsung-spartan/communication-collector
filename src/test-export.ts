import dotenv from 'dotenv';
import { DummyDataService } from './services/dummyDataService';
import { MDExportService } from './services/mdExportService';

// Load environment variables
dotenv.config();

async function testExport() {
  console.log('🧪 테스트 모드로 실행 중...');
  console.log('📝 더미 데이터로 MD 파일을 생성합니다.\n');
  
  try {
    // Generate dummy data
    const dummyService = new DummyDataService();
    const dummyRequests = dummyService.generateDummyRequests();
    
    console.log(`✅ ${dummyRequests.length}개의 샘플 고객 요청 생성 완료`);
    console.log('\n📊 요청 분포:');
    
    // Count by source
    const bySource: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    
    for (const req of dummyRequests) {
      bySource[req.source] = (bySource[req.source] || 0) + 1;
      byPriority[req.priority] = (byPriority[req.priority] || 0) + 1;
      byCategory[req.category] = (byCategory[req.category] || 0) + 1;
    }
    
    console.log('  출처별:', bySource);
    console.log('  우선순위별:', byPriority);
    console.log('  카테고리별:', byCategory);
    
    // Export to markdown
    const mdExporter = new MDExportService();
    const filepath = await mdExporter.exportToMarkdown(dummyRequests, new Date());
    
    console.log('\n✅ MD 파일 생성 완료!');
    console.log(`📄 파일 위치: ${filepath}`);
    console.log('\n💡 생성된 파일을 열어서 형식을 확인해보세요.');
    console.log('   notepad, VS Code, 또는 다른 텍스트 에디터로 열 수 있습니다.');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

// Run test
testExport();