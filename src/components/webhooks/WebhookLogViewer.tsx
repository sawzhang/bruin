import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useWebhookStore } from "../../stores/webhookStore";

export function WebhookLogViewer({ webhookId }: { webhookId: string }) {
  const { logs, loadLogs } = useWebhookStore();

  useEffect(() => {
    loadLogs(webhookId);
  }, [webhookId, loadLogs]);

  return (
    <div className="px-6 py-3">
      <h3 className="text-[13px] font-medium text-bear-text mb-2">Delivery Logs</h3>

      {logs.length === 0 && (
        <p className="text-[12px] text-bear-text-muted text-center py-4">No delivery logs yet</p>
      )}

      {logs.map((log) => (
        <div key={log.id} className="py-2 border-b border-bear-border/50">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${log.success ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-[12px] text-bear-text font-mono">{log.event_type}</span>
              {log.status_code && (
                <span className="text-[11px] px-1 rounded bg-bear-hover text-bear-text-secondary">
                  {log.status_code}
                </span>
              )}
            </div>
            <span className="text-[10px] text-bear-text-muted">
              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
            </span>
          </div>
          {log.error_message && (
            <p className="text-[11px] text-red-400 mt-1">{log.error_message}</p>
          )}
          <details className="mt-1">
            <summary className="text-[10px] text-bear-text-muted cursor-pointer hover:text-bear-text">
              Payload (attempt {log.attempt})
            </summary>
            <pre className="mt-1 p-2 bg-bear-bg rounded text-[10px] text-bear-text-secondary overflow-x-auto max-h-[120px]">
              {log.payload}
            </pre>
            {log.response_body && (
              <>
                <p className="text-[10px] text-bear-text-muted mt-1">Response:</p>
                <pre className="mt-0.5 p-2 bg-bear-bg rounded text-[10px] text-bear-text-secondary overflow-x-auto max-h-[80px]">
                  {log.response_body}
                </pre>
              </>
            )}
          </details>
        </div>
      ))}
    </div>
  );
}
