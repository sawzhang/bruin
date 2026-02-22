export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
