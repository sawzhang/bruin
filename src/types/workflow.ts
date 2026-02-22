export interface WorkflowStep {
  order: number;
  tool_name: string;
  description: string;
  params: Record<string, unknown>;
  use_result_as?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}
