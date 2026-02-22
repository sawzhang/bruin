import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import { useTaskStore } from "../../stores/taskStore";
import { TaskCreateForm } from "./TaskCreateForm";
import type { TaskStatus, TaskPriority } from "../../types/task";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-gray-400",
  medium: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-red-500",
};

export function TaskPanel() {
  const { tasks, isLoading, loadTasks, completeTask, deleteTask, filterStatus, setFilterStatus } = useTaskStore();

  useEffect(() => {
    loadTasks(filterStatus ?? undefined);
  }, [loadTasks, filterStatus]);

  const groupedTasks = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done"),
  };

  return (
    <div className="h-full flex flex-col bg-bear-list">
      <div className="px-3 pt-3 pb-2 border-b border-bear-border">
        <h2 className="text-[13px] font-medium text-bear-text mb-2">Tasks</h2>

        {/* Filter bar */}
        <div className="flex gap-1">
          {([null, "todo", "in_progress", "done"] as (TaskStatus | null)[]).map((status) => (
            <button
              key={status ?? "all"}
              onClick={() => setFilterStatus(status)}
              className={clsx(
                "px-2 py-0.5 text-[11px] rounded transition-colors",
                filterStatus === status
                  ? "bg-bear-active text-bear-text"
                  : "text-bear-text-muted hover:text-bear-text hover:bg-bear-hover"
              )}
            >
              {status ? STATUS_LABELS[status] : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="px-3 py-4 text-[12px] text-bear-text-muted text-center">Loading...</p>
        )}

        {!isLoading && tasks.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-bear-text-muted text-center">No tasks yet</p>
        )}

        {(["todo", "in_progress", "done"] as TaskStatus[]).map((status) => {
          const group = groupedTasks[status];
          if (filterStatus && filterStatus !== status) return null;
          if (group.length === 0) return null;

          return (
            <div key={status}>
              <p className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-bear-text-muted font-medium bg-bear-sidebar/50">
                {STATUS_LABELS[status]} ({group.length})
              </p>
              {group.map((task) => (
                <div key={task.id} className="px-3 py-2 border-b border-bear-border/50 group">
                  <div className="flex items-start gap-2">
                    {task.status !== "done" && (
                      <button
                        onClick={() => completeTask(task.id)}
                        className="mt-0.5 w-3.5 h-3.5 rounded-full border border-bear-border hover:border-green-500 shrink-0 transition-colors"
                        title="Complete"
                      />
                    )}
                    {task.status === "done" && (
                      <span className="mt-0.5 w-3.5 h-3.5 rounded-full bg-green-500 shrink-0 flex items-center justify-center text-white text-[9px]">
                        &#10003;
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={clsx(
                        "text-[12px]",
                        task.status === "done" ? "text-bear-text-muted line-through" : "text-bear-text"
                      )}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={clsx("text-[10px] font-medium", PRIORITY_COLORS[task.priority])}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className="text-[10px] text-bear-text-muted">{task.due_date}</span>
                        )}
                        <span className="text-[10px] text-bear-text-muted">
                          {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-[11px] text-bear-text-muted hover:text-red-400 transition-opacity"
                      title="Delete"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="border-t border-bear-border">
        <TaskCreateForm />
      </div>
    </div>
  );
}
