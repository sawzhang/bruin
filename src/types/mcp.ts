export interface McpStatus {
  is_running: boolean;
  socket_path: string | null;
  client_count: number;
}
