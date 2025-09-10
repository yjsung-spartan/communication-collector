import express from 'express';
import { TaskConverterService } from '../src/services/taskConverterService';
import { CustomerRequest } from '../src/types';

const router = express.Router();
const taskConverter = new TaskConverterService();

/**
 * Raw 요청을 태스크로 변환
 */
router.post('/api/tasks/convert', async (req, res) => {
  try {
    const requests: CustomerRequest[] = req.body.requests || req.body;
    const tasks = taskConverter.convertToTasks(requests);
    
    res.json({
      success: true,
      totalRequests: requests.length,
      totalTasks: tasks.length,
      tasks
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 태스크 분석 (Request Analyzer 로직 통합)
 */
router.post('/api/tasks/analyze', async (req, res) => {
  try {
    const { tasks, confluenceSpaceKey } = req.body;
    
    // 여기에 Request Analyzer의 충돌 검토 로직 통합
    const analysis = {
      conflictAnalysis: [],
      effortEstimation: {},
      modificationGuide: [],
      coverageMatrix: {}
    };
    
    // 각 태스크별 분석
    for (const task of tasks) {
      // 1. 충돌 검토 (Q1)
      const conflicts = await analyzeConflicts(task, confluenceSpaceKey);
      
      // 2. 난이도 평가 (Q2)
      const complexity = evaluateComplexity(task);
      
      // 3. 공수 산정 (Q3)
      const effort = calculateEffort(task, complexity);
      
      // 4. 수정 가이드 (Q4)
      const guide = generateModificationGuide(task);
      
      analysis.conflictAnalysis.push({
        taskId: task.id,
        conflicts,
        complexity,
        effort,
        guide
      });
    }
    
    res.json({
      success: true,
      analysis
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 전체 파이프라인 실행
 */
router.post('/api/tasks/pipeline', async (req, res) => {
  try {
    const { requests, confluenceSpaceKey } = req.body;
    
    // 1단계: 태스크 변환
    const tasks = taskConverter.convertToTasks(requests);
    
    // 2단계: 태스크 분석
    const analysis = await analyzeTasks(tasks, confluenceSpaceKey);
    
    // 3단계: 의사결정 리스트 생성
    const decisions = generateDecisions(tasks, analysis);
    
    res.json({
      success: true,
      summary: {
        totalRequests: requests.length,
        totalTasks: tasks.length,
        criticalConflicts: analysis.criticalConflicts || 0,
        totalEffort: analysis.totalEffort || 0
      },
      tasks,
      analysis,
      decisions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Request Analyzer 로직 함수들
async function analyzeConflicts(task: any, spaceKey: string) {
  // Confluence API 호출하여 충돌 검토
  return {
    hasConflict: false,
    conflictDetails: [],
    resolution: []
  };
}

function evaluateComplexity(task: any) {
  return {
    score: 50,
    level: 'medium',
    factors: []
  };
}

function calculateEffort(task: any, complexity: any) {
  return {
    days: task.technicalDetails?.estimatedEffort || 5,
    breakdown: {
      development: 3,
      testing: 1,
      deployment: 1
    }
  };
}

function generateModificationGuide(task: any) {
  return {
    priority: task.priority,
    steps: [],
    checkpoints: []
  };
}

async function analyzeTasks(tasks: any[], spaceKey: string) {
  const results = {
    criticalConflicts: 0,
    totalEffort: 0,
    details: []
  };
  
  for (const task of tasks) {
    const conflicts = await analyzeConflicts(task, spaceKey);
    const complexity = evaluateComplexity(task);
    const effort = calculateEffort(task, complexity);
    
    if (conflicts.hasConflict) results.criticalConflicts++;
    results.totalEffort += effort.days;
    
    results.details.push({
      taskId: task.id,
      conflicts,
      complexity,
      effort
    });
  }
  
  return results;
}

function generateDecisions(tasks: any[], analysis: any) {
  return tasks.map((task, index) => ({
    id: `DECISION_${index + 1}`,
    taskId: task.id,
    title: task.title,
    recommendation: determineRecommendation(task, analysis.details[index]),
    actionItems: generateActionItems(task, analysis.details[index])
  }));
}

function determineRecommendation(task: any, analysisDetail: any) {
  if (analysisDetail.conflicts.hasConflict) {
    return {
      action: 'review',
      reason: '충돌 해결 필요',
      priority: 'high'
    };
  }
  
  if (task.priority === 'urgent') {
    return {
      action: 'proceed',
      reason: '긴급 요청',
      priority: 'urgent'
    };
  }
  
  return {
    action: 'schedule',
    reason: '일반 진행',
    priority: task.priority
  };
}

function generateActionItems(task: any, analysisDetail: any) {
  const items = [];
  
  if (analysisDetail.conflicts.hasConflict) {
    items.push('충돌 사항 PM 검토');
    items.push('이해관계자 협의');
  }
  
  items.push(`개발 공수 ${analysisDetail.effort.days}일 할당`);
  items.push('담당자 지정');
  
  return items;
}

export default router;