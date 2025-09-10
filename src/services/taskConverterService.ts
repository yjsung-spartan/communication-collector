import { CustomerRequest } from '../types';

export interface Task {
  id: string;
  title: string;
  description: string;
  requester: string;
  requestDate: Date;
  source: string;
  sourceLink: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: string;
  status: 'unresolved' | 'resolved' | 'in_progress';
  assignee?: string;
  dueDate?: Date;
  tags: string[];
  relatedRequests: string[];
  technicalDetails?: {
    affectedComponents?: string[];
    estimatedEffort?: number;
    dependencies?: string[];
  };
}

export class TaskConverterService {
  /**
   * Raw 요청 데이터를 구조화된 태스크로 변환
   */
  convertToTasks(requests: CustomerRequest[]): Task[] {
    // 1. 요청 그룹핑 (유사한 요청 묶기)
    const groupedRequests = this.groupRequests(requests);
    
    // 2. 각 그룹을 태스크로 변환
    return groupedRequests.map(group => this.createTask(group));
  }

  /**
   * 유사한 요청들을 그룹화
   */
  private groupRequests(requests: CustomerRequest[]): CustomerRequest[][] {
    const groups: CustomerRequest[][] = [];
    const processed = new Set<string>();

    for (const request of requests) {
      if (processed.has(request.id)) continue;

      const similarRequests = this.findSimilarRequests(request, requests);
      if (similarRequests.length > 0) {
        groups.push([request, ...similarRequests]);
        similarRequests.forEach(r => processed.add(r.id));
      } else {
        groups.push([request]);
      }
      processed.add(request.id);
    }

    return groups;
  }

  /**
   * 유사한 요청 찾기
   */
  private findSimilarRequests(target: CustomerRequest, requests: CustomerRequest[]): CustomerRequest[] {
    return requests.filter(req => {
      if (req.id === target.id) return false;
      
      // 유사도 계산
      const similarity = this.calculateSimilarity(target, req);
      return similarity > 0.7; // 70% 이상 유사
    });
  }

  /**
   * 요청 간 유사도 계산
   */
  private calculateSimilarity(req1: CustomerRequest, req2: CustomerRequest): number {
    let score = 0;
    
    // 같은 카테고리
    if (req1.category === req2.category) score += 0.3;
    
    // 키워드 중복
    const keywords1 = this.extractKeywords(req1.content);
    const keywords2 = this.extractKeywords(req2.content);
    const overlap = this.calculateKeywordOverlap(keywords1, keywords2);
    score += overlap * 0.5;
    
    // 시간 근접성 (24시간 이내)
    const timeDiff = Math.abs(req1.requestedAt.getTime() - req2.requestedAt.getTime());
    if (timeDiff < 24 * 60 * 60 * 1000) score += 0.2;
    
    return score;
  }

  /**
   * 키워드 추출
   */
  private extractKeywords(content: string): string[] {
    const stopWords = ['의', '를', '을', '이', '가', '에', '에서', '으로', '와', '과'];
    const words = content.split(/\s+/)
      .filter(word => word.length > 1)
      .filter(word => !stopWords.includes(word))
      .map(word => word.toLowerCase());
    
    return [...new Set(words)];
  }

  /**
   * 키워드 중복도 계산
   */
  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * 그룹화된 요청을 태스크로 변환
   */
  private createTask(requests: CustomerRequest[]): Task {
    const primaryRequest = requests[0];
    const relatedIds = requests.slice(1).map(r => r.id);
    
    // 제목 생성
    const title = this.generateTaskTitle(requests);
    
    // 설명 통합
    const description = this.consolidateDescriptions(requests);
    
    // 우선순위 결정 (가장 높은 것 선택)
    const priority = this.determineHighestPriority(requests);
    
    // 태그 추출
    const tags = this.extractTags(requests);
    
    // 기술 상세 분석
    const technicalDetails = this.analyzeTechnicalDetails(requests);
    
    return {
      id: `TASK_${Date.now()}_${primaryRequest.id}`,
      title,
      description,
      requester: this.consolidateRequesters(requests),
      requestDate: primaryRequest.requestedAt,
      source: primaryRequest.source,
      sourceLink: primaryRequest.link,
      priority,
      category: primaryRequest.category,
      status: this.determineStatus(requests),
      tags,
      relatedRequests: relatedIds,
      technicalDetails
    };
  }

  /**
   * 태스크 제목 생성
   */
  private generateTaskTitle(requests: CustomerRequest[]): string {
    if (requests.length === 1) {
      // 단일 요청: 내용 요약
      const content = requests[0].content;
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }
    
    // 다중 요청: 공통 주제 추출
    const commonKeywords = this.findCommonKeywords(requests);
    const category = requests[0].category;
    
    return `[${category}] ${commonKeywords.slice(0, 3).join(', ')} 관련 요청 (${requests.length}건)`;
  }

  /**
   * 공통 키워드 찾기
   */
  private findCommonKeywords(requests: CustomerRequest[]): string[] {
    const allKeywords = requests.map(r => this.extractKeywords(r.content));
    const keywordCounts = new Map<string, number>();
    
    allKeywords.forEach(keywords => {
      keywords.forEach(keyword => {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      });
    });
    
    // 빈도순 정렬
    return Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([keyword]) => keyword);
  }

  /**
   * 설명 통합
   */
  private consolidateDescriptions(requests: CustomerRequest[]): string {
    if (requests.length === 1) {
      return requests[0].content;
    }
    
    let description = '## 관련 요청사항들\n\n';
    requests.forEach((req, index) => {
      description += `### ${index + 1}. ${req.author} (${req.source})\n`;
      description += `${req.content}\n`;
      description += `- 요청일: ${req.requestedAt.toLocaleDateString()}\n`;
      description += `- 링크: ${req.link}\n\n`;
    });
    
    return description;
  }

  /**
   * 최고 우선순위 결정
   */
  private determineHighestPriority(requests: CustomerRequest[]): 'urgent' | 'high' | 'medium' | 'low' {
    const priorityOrder = ['urgent', 'high', 'medium', 'low'];
    const priorities = requests.map(r => r.priority);
    
    for (const priority of priorityOrder) {
      if (priorities.includes(priority as any)) {
        return priority as any;
      }
    }
    
    return 'medium';
  }

  /**
   * 요청자 통합
   */
  private consolidateRequesters(requests: CustomerRequest[]): string {
    const requesters = [...new Set(requests.map(r => r.author))];
    return requesters.join(', ');
  }

  /**
   * 상태 결정
   */
  private determineStatus(requests: CustomerRequest[]): 'unresolved' | 'resolved' | 'in_progress' {
    const internalAuthors = ['iOS', 'Android', 'DANIEL', 'LUCY', 'LILY'];
    
    // 모든 요청에 내부 응답이 있으면 resolved
    const allResolved = requests.every(req => 
      internalAuthors.some(author => req.content.includes(author))
    );
    
    if (allResolved) return 'resolved';
    
    // 일부만 응답이 있으면 in_progress
    const someResolved = requests.some(req =>
      internalAuthors.some(author => req.content.includes(author))
    );
    
    if (someResolved) return 'in_progress';
    
    return 'unresolved';
  }

  /**
   * 태그 추출
   */
  private extractTags(requests: CustomerRequest[]): string[] {
    const tags = new Set<string>();
    
    requests.forEach(req => {
      // 소스 태그
      tags.add(`source:${req.source}`);
      
      // 카테고리 태그
      tags.add(`category:${req.category}`);
      
      // 우선순위 태그
      if (req.priority === 'urgent' || req.priority === 'high') {
        tags.add('priority:high');
      }
      
      // 기능 태그 추출
      const featureTags = this.extractFeatureTags(req.content);
      featureTags.forEach(tag => tags.add(tag));
    });
    
    return Array.from(tags);
  }

  /**
   * 기능 태그 추출
   */
  private extractFeatureTags(content: string): string[] {
    const tags: string[] = [];
    
    const patterns = [
      { pattern: /로그인|인증|회원/, tag: 'auth' },
      { pattern: /결제|구매|환불/, tag: 'payment' },
      { pattern: /검색|필터|정렬/, tag: 'search' },
      { pattern: /알림|푸시|노티/, tag: 'notification' },
      { pattern: /UI|UX|디자인|화면/, tag: 'ui' },
      { pattern: /API|서버|백엔드/, tag: 'backend' },
      { pattern: /성능|속도|최적화/, tag: 'performance' },
      { pattern: /버그|오류|에러/, tag: 'bug' }
    ];
    
    patterns.forEach(({ pattern, tag }) => {
      if (pattern.test(content)) {
        tags.push(tag);
      }
    });
    
    return tags;
  }

  /**
   * 기술 상세 분석
   */
  private analyzeTechnicalDetails(requests: CustomerRequest[]): Task['technicalDetails'] {
    const components = new Set<string>();
    const dependencies = new Set<string>();
    
    requests.forEach(req => {
      // 컴포넌트 추출
      const extractedComponents = this.extractComponents(req.content);
      extractedComponents.forEach(c => components.add(c));
      
      // 의존성 추출
      const extractedDeps = this.extractDependencies(req.content);
      extractedDeps.forEach(d => dependencies.add(d));
    });
    
    return {
      affectedComponents: Array.from(components),
      estimatedEffort: this.estimateEffort(requests),
      dependencies: Array.from(dependencies)
    };
  }

  /**
   * 영향받는 컴포넌트 추출
   */
  private extractComponents(content: string): string[] {
    const components: string[] = [];
    
    const patterns = [
      { pattern: /홈\s*화면|메인\s*페이지/, component: 'HomePage' },
      { pattern: /로그인\s*화면|회원가입/, component: 'AuthPage' },
      { pattern: /마이\s*페이지|프로필/, component: 'MyPage' },
      { pattern: /상품\s*상세|제품\s*페이지/, component: 'ProductDetail' },
      { pattern: /장바구니|카트/, component: 'ShoppingCart' },
      { pattern: /결제|주문/, component: 'Checkout' },
      { pattern: /검색/, component: 'Search' },
      { pattern: /설정|세팅/, component: 'Settings' }
    ];
    
    patterns.forEach(({ pattern, component }) => {
      if (pattern.test(content)) {
        components.push(component);
      }
    });
    
    return components;
  }

  /**
   * 의존성 추출
   */
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    if (/API|서버|백엔드/.test(content)) {
      dependencies.push('backend-api');
    }
    
    if (/데이터베이스|DB/.test(content)) {
      dependencies.push('database');
    }
    
    if (/외부\s*서비스|써드파티|3rd/.test(content)) {
      dependencies.push('third-party');
    }
    
    if (/인프라|서버\s*구성/.test(content)) {
      dependencies.push('infrastructure');
    }
    
    return dependencies;
  }

  /**
   * 예상 공수 추정
   */
  private estimateEffort(requests: CustomerRequest[]): number {
    let effort = 0;
    
    requests.forEach(req => {
      // 기본 공수
      effort += 1;
      
      // 우선순위에 따른 가중치
      if (req.priority === 'urgent') effort += 2;
      if (req.priority === 'high') effort += 1;
      
      // 복잡도에 따른 추가 공수
      const complexity = this.estimateComplexity(req.content);
      effort += complexity;
    });
    
    return Math.ceil(effort);
  }

  /**
   * 복잡도 추정
   */
  private estimateComplexity(content: string): number {
    let complexity = 0;
    
    // 복잡도 키워드
    if (/전체|모든|통합|리팩토링/.test(content)) complexity += 3;
    if (/마이그레이션|이전|변경/.test(content)) complexity += 2;
    if (/신규|새로운|추가/.test(content)) complexity += 1;
    
    return complexity;
  }
}