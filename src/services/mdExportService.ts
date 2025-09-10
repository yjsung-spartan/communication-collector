import { promises as fs } from 'fs';
import path from 'path';
import { CustomerRequest } from '../types';

export class MDExportService {
  private outputDir: string;

  constructor() {
    this.outputDir = process.env.OUTPUT_DIR || './exports';
  }

  async exportToMarkdown(requests: CustomerRequest[], date: Date): Promise<string> {
    // Ensure output directory exists
    await this.ensureDirectoryExists(this.outputDir);

    // Generate filename: customer_requests_YYYYMMDD.md
    const dateStr = this.formatDate(date);
    const filename = `customer_requests_${dateStr}.md`;
    const filepath = path.join(this.outputDir, filename);

    // Generate markdown content
    const content = this.generateMarkdown(requests, date);

    // Write to file
    await fs.writeFile(filepath, content, 'utf-8');
    console.log(`📝 Exported to: ${filepath}`);

    return filepath;
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private calculateDaysElapsed(requestDate: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - requestDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  private formatElapsedTime(days: number): string {
    if (days === 0) return '오늘';
    if (days === 1) return '1일 전';
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    if (days < 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
  }

  private generateMarkdown(requests: CustomerRequest[], date: Date): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# 일일 고객 요청 리포트');
    lines.push('');
    lines.push(`**수집 일시**: ${this.formatDateTime(date)}`);
    lines.push(`**수집 범위**: 전일 09:00 ~ 당일 09:00 (24시간)`);
    lines.push('');
    
    // Summary statistics
    lines.push('## 📊 요약');
    lines.push('');
    
    const stats = this.calculateStats(requests);
    const oldRequests = requests.filter(r => this.calculateDaysElapsed(r.requestedAt) > 7);
    const criticalRequests = requests.filter(r => this.calculateDaysElapsed(r.requestedAt) > 3 && (r.priority === 'urgent' || r.priority === 'high'));
    lines.push(`- **총 요청 수**: ${requests.length}건`);
    if (oldRequests.length > 0) {
      lines.push(`- **⚠️ 7일 이상 미해결**: ${oldRequests.length}건`);
    }
    if (criticalRequests.length > 0) {
      lines.push(`- **⏰ 3일 이상 높은 우선순위 미해결**: ${criticalRequests.length}건`);
    }
    lines.push(`- **채널별**:`);
    lines.push(`  - Slack: ${stats.bySource.slack || 0}건`);
    lines.push(`  - Confluence: ${stats.bySource.confluence || 0}건`);
    lines.push(`  - Figma: ${stats.bySource.figma || 0}건`);
    lines.push(`- **우선순위별**:`);
    lines.push(`  - 🔴 긴급: ${stats.byPriority.urgent || 0}건`);
    lines.push(`  - 🟡 높음: ${stats.byPriority.high || 0}건`);
    lines.push(`  - 🟢 보통: ${stats.byPriority.medium || 0}건`);
    lines.push(`  - ⚪ 낮음: ${stats.byPriority.low || 0}건`);
    lines.push(`- **카테고리별**:`);
    lines.push(`  - 🐛 버그: ${stats.byCategory.bug || 0}건`);
    lines.push(`  - 🔧 개선: ${stats.byCategory.improvement || 0}건`);
    lines.push(`  - ✨ 신규기능: ${stats.byCategory.new_feature || 0}건`);
    lines.push(`  - ❓ 문의: ${stats.byCategory.inquiry || 0}건`);
    lines.push(`  - 📌 기타: ${stats.byCategory.other || 0}건`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Group requests by priority
    const urgentRequests = requests.filter(r => r.priority === 'urgent');
    const highRequests = requests.filter(r => r.priority === 'high');
    const mediumRequests = requests.filter(r => r.priority === 'medium');
    const lowRequests = requests.filter(r => r.priority === 'low');

    // Urgent requests
    if (urgentRequests.length > 0) {
      lines.push('## 🔴 긴급 요청');
      lines.push('');
      this.addRequestsToMarkdown(lines, urgentRequests);
      lines.push('');
    }

    // High priority requests
    if (highRequests.length > 0) {
      lines.push('## 🟡 높은 우선순위 요청');
      lines.push('');
      this.addRequestsToMarkdown(lines, highRequests);
      lines.push('');
    }

    // Medium priority requests
    if (mediumRequests.length > 0) {
      lines.push('## 🟢 보통 우선순위 요청');
      lines.push('');
      this.addRequestsToMarkdown(lines, mediumRequests);
      lines.push('');
    }

    // Low priority requests
    if (lowRequests.length > 0) {
      lines.push('## ⚪ 낮은 우선순위 요청');
      lines.push('');
      this.addRequestsToMarkdown(lines, lowRequests);
      lines.push('');
    }

    // Raw data section
    lines.push('---');
    lines.push('');
    lines.push('## 📋 전체 요청 목록 (Raw Data)');
    lines.push('');
    lines.push('| CR번호 | 요청 시간 | 경과 | 출처 | 요청자 | 제목 | 카테고리 | 우선순위 |');
    lines.push('|--------|-----------|------|------|--------|------|----------|----------|');
    
    for (const req of requests) {
      const time = this.formatDateTime(req.requestedAt);
      const daysElapsed = this.calculateDaysElapsed(req.requestedAt);
      const elapsedLabel = this.formatElapsedTime(daysElapsed);
      const source = this.getSourceLabel(req.source);
      const category = this.getCategoryLabel(req.category);
      const priority = this.getPriorityLabel(req.priority);
      
      lines.push(`| ${req.crNumber} | ${time} | ${elapsedLabel} | ${source} | ${req.requesterName} | ${req.title} | ${category} | ${priority} |`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Generated by Customer Request Bot*');

    return lines.join('\n');
  }

  private addRequestsToMarkdown(lines: string[], requests: CustomerRequest[]): void {
    for (const req of requests) {
      const daysElapsed = this.calculateDaysElapsed(req.requestedAt);
      const elapsedLabel = this.formatElapsedTime(daysElapsed);
      const elapsedEmoji = daysElapsed > 7 ? '⚠️' : daysElapsed > 3 ? '⏰' : '';
      
      lines.push(`### [${req.crNumber}] ${req.title} ${elapsedEmoji}`);
      lines.push('');
      lines.push(`- **요청자**: ${req.requesterName}${req.requesterEmail ? ` (${req.requesterEmail})` : ''}`);
      lines.push(`- **출처**: ${this.getSourceLabel(req.source)} - ${req.channelName || ''}`);
      lines.push(`- **요청 시간**: ${this.formatDateTime(req.requestedAt)} (**${elapsedLabel}**, ${daysElapsed}일 경과)`);
      lines.push(`- **카테고리**: ${this.getCategoryLabel(req.category)}`);
      
      if (req.originalUrl) {
        lines.push(`- **원본 링크**: [보기](${req.originalUrl})`);
      }
      
      lines.push('');
      lines.push('**내용**:');
      lines.push('```');
      lines.push(req.description);
      lines.push('```');
      lines.push('');
    }
  }

  private calculateStats(requests: CustomerRequest[]) {
    const stats = {
      bySource: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byCategory: {} as Record<string, number>
    };

    for (const req of requests) {
      // Count by source
      stats.bySource[req.source] = (stats.bySource[req.source] || 0) + 1;
      
      // Count by priority
      stats.byPriority[req.priority] = (stats.byPriority[req.priority] || 0) + 1;
      
      // Count by category
      stats.byCategory[req.category] = (stats.byCategory[req.category] || 0) + 1;
    }

    return stats;
  }

  private getSourceLabel(source: string): string {
    const labels: Record<string, string> = {
      'slack': '💬 Slack',
      'confluence': '📝 Confluence',
      'figma': '🎨 Figma'
    };
    return labels[source] || source;
  }

  private getCategoryLabel(category: CustomerRequest['category']): string {
    const labels = {
      bug: '🐛 버그',
      improvement: '🔧 개선',
      new_feature: '✨ 신규기능',
      inquiry: '❓ 문의',
      other: '📌 기타'
    };
    return labels[category] || category;
  }

  private getPriorityLabel(priority: CustomerRequest['priority']): string {
    const labels = {
      urgent: '🔴 긴급',
      high: '🟡 높음',
      medium: '🟢 보통',
      low: '⚪ 낮음'
    };
    return labels[priority] || priority;
  }
}