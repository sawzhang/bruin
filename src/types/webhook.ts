export interface Webhook {
  id: string;
  url: string;
  event_types: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
}

export interface WebhookLog {
  id: number;
  webhook_id: string;
  event_type: string;
  payload: string;
  status_code: number | null;
  response_body: string | null;
  attempt: number;
  success: boolean;
  error_message: string | null;
  timestamp: string;
}
