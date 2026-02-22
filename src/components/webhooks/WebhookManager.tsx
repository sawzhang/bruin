import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useWebhookStore } from "../../stores/webhookStore";
import { useUIStore } from "../../stores/uiStore";
import { useToastStore } from "../../stores/toastStore";
import { WebhookLogViewer } from "./WebhookLogViewer";

export function WebhookManager() {
  const isOpen = useUIStore((s) => s.isWebhookManagerOpen);
  const toggleManager = useUIStore((s) => s.toggleWebhookManager);
  const {
    webhooks, isLoading, loadWebhooks,
    registerWebhook, updateWebhook, deleteWebhook, testWebhook,
    selectedWebhookId, setSelectedWebhookId,
  } = useWebhookStore();
  const addToast = useToastStore((s) => s.addToast);

  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [eventTypes, setEventTypes] = useState("");

  useEffect(() => {
    if (isOpen) loadWebhooks();
  }, [isOpen, loadWebhooks]);

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (!url.trim() || !secret.trim()) return;
    const types = eventTypes.trim() ? eventTypes.split(",").map((s) => s.trim()) : [];
    await registerWebhook(url.trim(), types, secret.trim());
    setUrl("");
    setSecret("");
    setEventTypes("");
    setShowForm(false);
  };

  const handleTest = async (id: string) => {
    try {
      const log = await testWebhook(id);
      if (log.success) {
        addToast({ type: "success", message: `Webhook test succeeded (${log.status_code})` });
      } else {
        addToast({ type: "error", message: `Webhook test failed: ${log.error_message ?? "Unknown error"}` });
      }
    } catch (err) {
      addToast({ type: "error", message: `Test failed: ${err}` });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={toggleManager}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[640px] max-h-[80vh] bg-bear-sidebar border border-bear-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-bear-border shrink-0">
          <h2 className="text-[16px] font-semibold text-bear-text">Webhooks</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowForm(!showForm); setSelectedWebhookId(null); }}
              className="text-[12px] text-bear-accent hover:underline"
            >
              {showForm ? "Cancel" : "+ Add Webhook"}
            </button>
            <button onClick={toggleManager} className="text-bear-text-muted hover:text-bear-text text-[18px]">
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showForm && (
            <div className="px-6 py-4 border-b border-bear-border flex flex-col gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Webhook URL (https://...)"
                className="bg-bear-bg border border-bear-border rounded px-3 py-1.5 text-[13px] text-bear-text outline-none"
              />
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Secret key for HMAC-SHA256 signing"
                className="bg-bear-bg border border-bear-border rounded px-3 py-1.5 text-[13px] text-bear-text outline-none"
              />
              <input
                value={eventTypes}
                onChange={(e) => setEventTypes(e.target.value)}
                placeholder="Event types (comma-separated, empty = all)"
                className="bg-bear-bg border border-bear-border rounded px-3 py-1.5 text-[13px] text-bear-text outline-none"
              />
              <button
                onClick={handleAdd}
                disabled={!url.trim() || !secret.trim()}
                className="self-end px-3 py-1 text-[12px] bg-bear-accent text-white rounded disabled:opacity-50"
              >
                Register Webhook
              </button>
            </div>
          )}

          {selectedWebhookId ? (
            <div>
              <button
                onClick={() => setSelectedWebhookId(null)}
                className="px-6 py-2 text-[12px] text-bear-accent hover:underline"
              >
                &larr; Back to list
              </button>
              <WebhookLogViewer webhookId={selectedWebhookId} />
            </div>
          ) : (
            <>
              {isLoading && (
                <p className="px-6 py-8 text-[12px] text-bear-text-muted text-center">Loading...</p>
              )}

              {!isLoading && webhooks.length === 0 && (
                <p className="px-6 py-8 text-[12px] text-bear-text-muted text-center">
                  No webhooks registered
                </p>
              )}

              {webhooks.map((webhook) => (
                <div key={webhook.id} className="px-6 py-3 border-b border-bear-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${webhook.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                      <span className="text-[13px] text-bear-text font-mono truncate max-w-[300px]">
                        {webhook.url}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTest(webhook.id)}
                        className="px-2 py-0.5 text-[10px] text-bear-text-secondary border border-bear-border rounded hover:bg-bear-hover"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => setSelectedWebhookId(webhook.id)}
                        className="px-2 py-0.5 text-[10px] text-bear-text-secondary border border-bear-border rounded hover:bg-bear-hover"
                      >
                        Logs
                      </button>
                      <button
                        onClick={() => updateWebhook(webhook.id, undefined, undefined, !webhook.is_active)}
                        className="px-2 py-0.5 text-[10px] text-bear-text-secondary border border-bear-border rounded hover:bg-bear-hover"
                      >
                        {webhook.is_active ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteWebhook(webhook.id)}
                        className="px-2 py-0.5 text-[10px] text-red-400 border border-bear-border rounded hover:bg-bear-hover"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-bear-text-muted">
                    {webhook.event_types.length > 0 ? (
                      <span>Events: {webhook.event_types.join(", ")}</span>
                    ) : (
                      <span>All events</span>
                    )}
                    {webhook.last_triggered_at && (
                      <span>Last: {formatDistanceToNow(new Date(webhook.last_triggered_at), { addSuffix: true })}</span>
                    )}
                    {webhook.failure_count > 0 && (
                      <span className="text-red-400">Failures: {webhook.failure_count}</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
