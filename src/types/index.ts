// Customer Request Types
export interface CustomerRequest {
  id: string;
  crNumber: string; // CR-20241228-001
  source: 'slack' | 'figma' | 'confluence';
  sourceId: string; // Original message/comment ID
  
  // Requester Info
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  customerCompany?: string;
  
  // Request Content
  title: string;
  description: string;
  category: 'bug' | 'improvement' | 'new_feature' | 'inquiry' | 'other';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  
  // Metadata
  channelId?: string;
  channelName?: string;
  threadTs?: string;
  attachments?: string[];
  originalUrl?: string;
  
  // Status Management
  status: 'new' | 'reviewing' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  assignee?: string;
  
  // Timestamps
  requestedAt: Date;
  collectedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Change Request Log
export interface ChangeRequestLog {
  id: string;
  crNumber: string;
  requestId: string;
  
  // Detailed Info
  businessImpact?: string;
  technicalRequirements?: string;
  estimatedEffort?: string;
  targetRelease?: string;
  
  // History
  history: ChangeHistory[];
  comments: any[];
  
  // Resolution
  resolution?: string;
  implementationNotes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Change History Entry
export interface ChangeHistory {
  id: string;
  crNumber: string;
  action: 'status_change' | 'assign' | 'comment' | 'priority_change';
  fromValue?: string;
  toValue?: string;
  userId: string;
  userName: string;
  timestamp: Date;
  note?: string;
}

// Daily Report
export interface DailyReport {
  id: string;
  reportDate: Date;
  
  // Summary Statistics
  totalRequests: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  bySource: Record<string, number>;
  
  // Request List
  requests: CustomerRequest[];
  
  // Report Metadata
  generatedAt: Date;
  postedChannelId?: string;
  postedMessageTs?: string;
  exportedFileUrl?: string;
}

// Slack Event Types
export interface SlackMessageEvent {
  type: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  files?: any[];
  attachments?: any[];
}

// Configuration
export interface BotConfig {
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;
  monitorChannels: string[];
  reportChannel: string;
  requestKeywords: string[];
  urgentKeywords: string[];
  highKeywords: string[];
  lowKeywords: string[];
  dailyReportCron: string;
}