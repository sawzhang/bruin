import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useActivityStore } from "../../stores/activityStore";

const EVENT_ICONS: Record<string, string> = {
  note_created: "+",
  note_updated: "~",
  note_deleted: "x",
  note_trashed: "!",
  note_restored: "<",
  note_pinned: "*",
  state_changed: ">",
};

export function ActivityPanel() {
  const { events, isLoading, loadEvents } = useActivityStore();
  const [agentFilter, setAgentFilter] = useState<string>("");

  useEffect(() => {
    loadEvents(undefined, agentFilter || undefined);
  }, [loadEvents, agentFilter]);

  return (
    <div data-testid="activity-panel" className="h-full flex flex-col bg-bear-list">
      <div className="px-3 pt-3 pb-2 border-b border-bear-border">
        <h2 className="text-[13px] font-medium text-bear-text">Activity</h2>
        <input
          data-testid="activity-filter"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          placeholder="Filter by agent..."
          className="mt-1 w-full bg-bear-bg border border-bear-border rounded px-2 py-0.5 text-[11px] text-bear-text outline-none placeholder:text-bear-text-muted"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="px-3 py-4 text-[12px] text-bear-text-muted text-center">
            Loading...
          </p>
        )}
        {!isLoading && events.length === 0 && (
          <p data-testid="activity-empty" className="px-3 py-4 text-[12px] text-bear-text-muted text-center">
            No activity yet
          </p>
        )}
        {events.map((event) => (
          <div
            key={event.id}
            data-testid="activity-item"
            data-event-type={event.event_type}
            className="px-3 py-2 border-b border-bear-border/50"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-mono text-bear-accent w-3 text-center shrink-0">
                {EVENT_ICONS[event.event_type] ?? "?"}
              </span>
              <span className="text-[12px] text-bear-text truncate">
                {event.summary}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 ml-[18px]">
              <span className="text-[10px] text-bear-text-muted">
                {formatDistanceToNow(new Date(event.timestamp), {
                  addSuffix: true,
                })}
              </span>
              <span className="text-[10px] px-1 rounded bg-bear-tag-bg text-bear-tag">
                {event.actor}
              </span>
              {event.agent_id && (
                <span className="text-[10px] px-1 rounded bg-bear-accent/20 text-bear-accent">
                  agent
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
