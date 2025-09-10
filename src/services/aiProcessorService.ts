import { CustomerRequest } from '../types';
import OpenAI from 'openai';

export class AIProcessorService {
  private openai: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  /**
   * 댓글이 고객 요청인지 AI로 판단
   */
  async isCustomerRequest(text: string, author: string): Promise<{
    isRequest: boolean;
    category?: string;
    priority?: string;
    summary?: string;
  }> {
    if (!this.openai) {
      // Fallback to keyword-based detection
      return this.keywordBasedDetection(text);
    }

    try {
      const prompt = `다음 Confluence 댓글이 고객 요청/이슈/개선사항인지 판단해주세요.
단순 정보 공유나 일반 댓글은 제외합니다.

댓글 작성자: ${author}
댓글 내용: ${text}

다음 JSON 형식으로 응답해주세요:
{
  "isRequest": true/false,
  "category": "bug|improvement|new_feature|inquiry|other",
  "priority": "urgent|high|medium|low",
  "summary": "요청 내용 한 줄 요약 (50자 이내)"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result;
    } catch (error) {
      console.error('AI processing failed:', error);
      return this.keywordBasedDetection(text);
    }
  }

  /**
   * 여러 댓글을 배치로 처리 (비용 절감)
   */
  async processCommentsBatch(comments: Array<{
    id: string;
    text: string;
    author: string;
    pageTitle: string;
  }>): Promise<Map<string, any>> {
    if (!this.openai) {
      const results = new Map();
      comments.forEach(c => {
        results.set(c.id, this.keywordBasedDetection(c.text));
      });
      return results;
    }

    const prompt = `다음 Confluence 댓글들 중에서 고객 요청/이슈/개선사항을 찾아주세요.
단순 정보 공유나 일반 댓글은 제외합니다.

댓글 목록:
${comments.map((c, i) => `
[${i}]
페이지: ${c.pageTitle}
작성자: ${c.author}
내용: ${c.text}
`).join('\n---\n')}

각 댓글에 대해 다음 형식으로 응답해주세요:
{
  "results": [
    {
      "index": 0,
      "isRequest": true/false,
      "category": "bug|improvement|new_feature|inquiry|other",
      "priority": "urgent|high|medium|low",
      "summary": "요청 내용 한 줄 요약"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo-16k', // 더 긴 컨텍스트
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      const resultMap = new Map();
      
      result.results?.forEach((r: any) => {
        if (r.index < comments.length) {
          resultMap.set(comments[r.index].id, r);
        }
      });

      return resultMap;
    } catch (error) {
      console.error('Batch AI processing failed:', error);
      const results = new Map();
      comments.forEach(c => {
        results.set(c.id, this.keywordBasedDetection(c.text));
      });
      return results;
    }
  }

  /**
   * 키워드 기반 폴백 감지
   */
  private keywordBasedDetection(text: string): any {
    const lowerText = text.toLowerCase();
    
    // 더 넓은 키워드 범위
    const requestKeywords = [
      '요청', '문의', '개선', '오류', '버그', '수정', '변경', '이슈',
      '확인', '필요', '검토', '추가', '삭제', '업데이트', '반영',
      '안됨', '안돼', '실패', '문제'
    ];

    const isRequest = requestKeywords.some(k => lowerText.includes(k));
    
    // 카테고리 판단
    let category = 'other';
    if (lowerText.includes('버그') || lowerText.includes('오류') || lowerText.includes('안됨')) {
      category = 'bug';
    } else if (lowerText.includes('개선') || lowerText.includes('변경')) {
      category = 'improvement';
    } else if (lowerText.includes('추가') || lowerText.includes('신규')) {
      category = 'new_feature';
    } else if (lowerText.includes('문의') || lowerText.includes('질문')) {
      category = 'inquiry';
    }

    // 우선순위 판단
    let priority = 'medium';
    if (lowerText.includes('긴급') || lowerText.includes('asap') || lowerText.includes('급')) {
      priority = 'urgent';
    } else if (lowerText.includes('중요') || lowerText.includes('우선')) {
      priority = 'high';
    }

    return {
      isRequest,
      category,
      priority,
      summary: text.substring(0, 50)
    };
  }

  /**
   * 요청 내용을 구조화된 형식으로 변환
   */
  async enhanceRequestDescription(request: Partial<CustomerRequest>): Promise<string> {
    if (!this.openai) {
      return request.description || '';
    }

    try {
      const prompt = `다음 고객 요청을 명확하고 구조화된 형식으로 정리해주세요:

원본: ${request.description}
작성자: ${request.requesterName}
페이지: ${request.channelName}

다음 형식으로 작성:
1. 요청 사항: (핵심 요청을 명확하게)
2. 배경/이유: (있다면)
3. 영향 범위: (어떤 기능/화면에 영향)
4. 제안 사항: (있다면)`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 500
      });

      return response.choices[0].message.content || request.description || '';
    } catch (error) {
      console.error('Enhancement failed:', error);
      return request.description || '';
    }
  }
}