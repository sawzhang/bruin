export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_agent_id: string | null;
  linked_note_id: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}
