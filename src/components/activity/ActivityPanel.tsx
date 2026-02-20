import { useEffect } from "react";
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

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <div className="h-full flex flex-col bg-bear-list">
      <div className="px-3 pt-3 pb-2 border-b border-bear-border">
        <h2 className="text-[13px] font-medium text-bear-text">Activity</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="px-3 py-4 text-[12px] text-bear-text-muted text-center">
            Loading...
          </p>
        )}
        {!isLoading && events.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-bear-text-muted text-center">
            No activity yet
          </p>
        )}
        {events.map((event) => (
          <div
            key={event.id}
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
