# 충돌 검토 로직 구현 가이드

## 충돌 유형 정의

### 1. 기능 충돌 (Functional Conflict)
```javascript
// 패턴 감지
const functionalConflictPatterns = [
  // 상반된 요구사항
  { pattern: /자동으로?\s*(저장|업로드)/i, conflicts: /수동으로?\s*(저장|업로드)/i },
  { pattern: /숨기기|비활성화|제거/i, conflicts: /보이기|활성화|추가/i },
  { pattern: /통합|합치기/i, conflicts: /분리|나누기/i },
  
  // UI/UX 충돌
  { pattern: /상단에?\s*배치/i, conflicts: /하단에?\s*배치/i },
  { pattern: /팝업으로?\s*표시/i, conflicts: /인라인으로?\s*표시/i },
  { pattern: /다크\s*모드/i, conflicts: /라이트\s*모드\s*전용/i }
];
```

### 2. 우선순위 충돌 (Priority Conflict)
```javascript
// 리소스 경합 감지
function detectPriorityConflict(requests) {
  const urgentRequests = requests.filter(r => r.priority === 'urgent');
  
  // 같은 개발자/팀에 할당된 긴급 요청이 여러 개인 경우
  const developerWorkload = {};
  urgentRequests.forEach(req => {
    const assignee = extractAssignee(req);
    developerWorkload[assignee] = (developerWorkload[assignee] || 0) + 1;
  });
  
  return Object.entries(developerWorkload)
    .filter(([dev, count]) => count > 1)
    .map(([dev, count]) => ({
      type: 'priority',
      developer: dev,
      conflictingRequests: count,
      message: `${dev}에게 ${count}개의 긴급 요청이 동시 할당됨`
    }));
}
```

### 3. 일정 충돌 (Timeline Conflict)
```javascript
// 의존성 및 순서 충돌
const timelineConflicts = [
  // 선후 관계
  { first: /로그인|인증/, then: /마이페이지|프로필/ },
  { first: /데이터\s*마이그레이션/, then: /새\s*기능/ },
  { first: /API\s*개발/, then: /프론트엔드\s*연동/ },
  
  // 동시 진행 불가
  { exclusive: [/전체\s*리팩토링/, /신규\s*기능/] },
  { exclusive: [/DB\s*스키마\s*변경/, /실시간\s*서비스/] }
];
```

### 4. 기술 충돌 (Technical Conflict)
```javascript
// 기술 스택/아키텍처 충돌
const technicalConflicts = [
  // 플랫폼 충돌
  { platform: 'iOS', incompatible: /안드로이드\s*전용/ },
  { platform: 'Web', incompatible: /네이티브\s*앱\s*전용/ },
  
  // 버전/호환성
  { requires: /최신\s*버전/, conflicts: /하위\s*호환성/ },
  { requires: /실시간/, conflicts: /배치\s*처리/ }
];
```

## 충돌 감지 알고리즘

### 단계 1: 요청 전처리
```javascript
function preprocessRequests(requests) {
  return requests.map(req => ({
    ...req,
    // 키워드 추출
    keywords: extractKeywords(req.content),
    // 기능 영역 분류
    domain: classifyDomain(req.content),
    // 예상 공수 계산
    estimatedEffort: estimateEffort(req.content),
    // 영향 범위 파악
    impactScope: analyzeImpact(req.content)
  }));
}
```

### 단계 2: 충돌 매트릭스 생성
```javascript
function createConflictMatrix(requests) {
  const matrix = [];
  
  for (let i = 0; i < requests.length; i++) {
    for (let j = i + 1; j < requests.length; j++) {
      const conflicts = detectConflicts(requests[i], requests[j]);
      
      if (conflicts.length > 0) {
        matrix.push({
          request1: requests[i].id,
          request2: requests[j].id,
          conflicts: conflicts,
          severity: calculateSeverity(conflicts),
          resolution: suggestResolution(conflicts, requests[i], requests[j])
        });
      }
    }
  }
  
  return matrix;
}
```

### 단계 3: 충돌 심각도 계산
```javascript
function calculateSeverity(conflicts) {
  const severityScores = {
    functional: 0.8,   // 기능 충돌은 심각
    priority: 0.6,     // 우선순위는 조정 가능
    timeline: 0.7,     // 일정은 중요
    technical: 0.9     // 기술 충돌은 매우 심각
  };
  
  const totalScore = conflicts.reduce((sum, conflict) => 
    sum + severityScores[conflict.type], 0
  );
  
  if (totalScore >= 1.5) return 'critical';
  if (totalScore >= 1.0) return 'high';
  if (totalScore >= 0.5) return 'medium';
  return 'low';
}
```

## 해결 방안 제시

### 자동 해결 제안
```javascript
function suggestResolution(conflicts, req1, req2) {
  const suggestions = [];
  
  conflicts.forEach(conflict => {
    switch(conflict.type) {
      case 'functional':
        suggestions.push({
          type: 'merge',
          description: '두 요구사항을 통합하여 설정 옵션으로 제공',
          example: '사용자가 자동/수동 저장을 선택할 수 있도록 설정 추가'
        });
        break;
        
      case 'priority':
        suggestions.push({
          type: 'sequence',
          description: '우선순위 재조정 및 순차 처리',
          example: `${req1.priority === 'urgent' ? req1.id : req2.id}를 먼저 처리`
        });
        break;
        
      case 'timeline':
        suggestions.push({
          type: 'dependency',
          description: '의존성 관계 설정 및 단계별 진행',
          example: '1단계 완료 후 2단계 진행'
        });
        break;
        
      case 'technical':
        suggestions.push({
          type: 'architecture',
          description: '아키텍처 재검토 또는 대안 기술 적용',
          example: '크로스플랫폼 솔루션 도입 검토'
        });
        break;
    }
  });
  
  return suggestions;
}
```

## 기획문서와의 충돌 검토

### PRD/기능정의서 대조
```javascript
function checkAgainstPRD(request, prdContent) {
  const violations = [];
  
  // 핵심 원칙 위반 체크
  const coreP principles = extractPrinciples(prdContent);
  principles.forEach(principle => {
    if (violatesPrinciple(request, principle)) {
      violations.push({
        type: 'principle_violation',
        principle: principle.name,
        description: principle.description,
        severity: 'high'
      });
    }
  });
  
  // 기존 기능과의 충돌
  const existingFeatures = extractFeatures(prdContent);
  existingFeatures.forEach(feature => {
    if (conflictsWithFeature(request, feature)) {
      violations.push({
        type: 'feature_conflict',
        feature: feature.name,
        description: `기존 기능 "${feature.name}"과 충돌`,
        severity: 'medium'
      });
    }
  });
  
  return violations;
}
```

## 의사결정 매트릭스

### 우선순위 결정 기준
```javascript
const decisionCriteria = {
  // 비즈니스 영향도
  businessImpact: {
    weight: 0.3,
    factors: ['revenue', 'userCount', 'retention']
  },
  
  // 기술적 복잡도
  technicalComplexity: {
    weight: 0.2,
    factors: ['effort', 'risk', 'dependencies']
  },
  
  // 긴급도
  urgency: {
    weight: 0.25,
    factors: ['deadline', 'blocking', 'customer_priority']
  },
  
  // 리소스 가용성
  resourceAvailability: {
    weight: 0.25,
    factors: ['team_capacity', 'skill_match', 'current_workload']
  }
};
```

### 최종 의사결정 포맷
```javascript
function generateDecisionList(conflicts, requests) {
  return {
    summary: {
      totalConflicts: conflicts.length,
      criticalConflicts: conflicts.filter(c => c.severity === 'critical').length,
      resolvableConflicts: conflicts.filter(c => c.autoResolvable).length
    },
    
    decisions: conflicts.map(conflict => ({
      id: `DECISION_${conflict.id}`,
      title: conflict.title,
      relatedRequests: conflict.requests,
      
      options: conflict.resolutions.map(resolution => ({
        name: resolution.name,
        description: resolution.description,
        pros: resolution.pros,
        cons: resolution.cons,
        effort: resolution.effort,
        risk: resolution.risk
      })),
      
      recommendation: {
        option: conflict.recommendedResolution,
        reasoning: conflict.reasoning,
        actionItems: conflict.actionItems,
        timeline: conflict.timeline,
        owner: conflict.owner
      },
      
      impact: {
        affectedFeatures: conflict.affectedFeatures,
        affectedUsers: conflict.affectedUsers,
        technicalDebt: conflict.technicalDebt
      }
    })),
    
    nextSteps: generateNextSteps(conflicts)
  };
}
```

## 실행 예시

```javascript
// GPT에서 사용할 함수
async function analyzeRequests() {
  // 1. 데이터 수집
  const response = await getRequestsForLLM();
  const requests = [...response.unresolved.urgent, 
                   ...response.unresolved.high,
                   ...response.unresolved.medium];
  
  // 2. 충돌 감지
  const preprocessed = preprocessRequests(requests);
  const conflictMatrix = createConflictMatrix(preprocessed);
  
  // 3. PRD 대조
  const prdViolations = requests.map(req => 
    checkAgainstPRD(req, prdContent)
  );
  
  // 4. 의사결정 리스트 생성
  const decisionList = generateDecisionList(conflictMatrix, requests);
  
  // 5. 보고서 생성
  return formatReport({
    requests: requests,
    conflicts: conflictMatrix,
    violations: prdViolations,
    decisions: decisionList
  });
}
```