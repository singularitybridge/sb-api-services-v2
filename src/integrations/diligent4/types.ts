// Diligent4 API Types

export interface WorkflowStep {
  action: string;
  details?: string;
  notes?: string;
}

export interface KnowledgeItem {
  title: string;
  content: string;
  tags?: string[];
}

export interface Context {
  id: string;
  name: string;
  kind: 'project' | 'session';
  session_type?: 'workflow_recording' | 'teaching_session';
  goal?: string;
  steps?: WorkflowStep[];
  knowledge_items?: KnowledgeItem[];
  created_at: string;
  updated_at: string;
}

export interface ContextSummary {
  id: string;
  name: string;
  kind: 'project' | 'session';
  session_type?: string;
  created_at: string;
}

export interface SearchResult {
  id: string;
  name: string;
  kind: string;
  session_type?: string;
  relevance_score: number;
  snippet?: string;
}

export interface SearchResponse {
  status: 'AUTO_SELECTED' | 'MULTIPLE_MATCHES' | 'NO_MATCHES';
  results: SearchResult[];
  auto_selected?: SearchResult;
}

export interface GenerateResponse {
  session_id: string;
  estimated_seconds: number;
  status: 'processing';
}

export interface ListContextsArgs {
  limit?: number;
  kind?: 'all' | 'project' | 'session';
  sessionType?: 'workflow_recording' | 'teaching_session';
}

export interface SearchWorkflowsArgs {
  query: string;
  topK?: number;
  minConfidence?: number;
  autoFetch?: boolean;
}

export interface GetContextArgs {
  id: string;
  detail?: 'summary' | 'full';
}

export interface GenerateWorkflowArgs {
  content: string;
  name: string;
  outputType?: 'workflow_recording' | 'teaching_session';
  waitForCompletion?: boolean;
  maxWaitSeconds?: number;
}

export interface ModifyContextArgs {
  id: string;
  targetType: 'step' | 'phase' | 'knowledge_item' | 'metadata';
  changePrompt: string;
  action?: 'modify' | 'add' | 'delete';
  targetNumber?: number;
  targetId?: string;
  position?: {
    type: 'after' | 'before' | 'at_end' | 'at_start';
    reference?: number;
  };
  autoConfirm?: boolean;
}

// MCP-style nested response format from Diligent4 API
export interface MCPResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}
