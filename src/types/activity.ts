export interface ActivityEvent {
  id: number;
  actor: string;
  event_type: string;
  note_id: string | null;
  timestamp: string;
  summary: string;
  data: string;
  agent_id: string | null;
}
