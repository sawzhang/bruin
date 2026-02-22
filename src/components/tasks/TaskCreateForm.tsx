import { useState } from "react";
import { useTaskStore } from "../../stores/taskStore";
import type { TaskPriority } from "../../types/task";

export function TaskCreateForm() {
  const { createTask } = useTaskStore();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask(title.trim(), undefined, priority);
    setTitle("");
    setPriority("medium");
  };

  return (
    <form onSubmit={handleSubmit} className="px-3 py-2 flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task..."
        className="flex-1 bg-transparent text-[12px] text-bear-text placeholder:text-bear-text-muted outline-none"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as TaskPriority)}
        className="bg-bear-hover border border-bear-border rounded px-1 py-0.5 text-[10px] text-bear-text outline-none"
      >
        <option value="low">Low</option>
        <option value="medium">Med</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
      <button
        type="submit"
        disabled={!title.trim()}
        className="px-2 py-0.5 text-[11px] bg-bear-accent text-white rounded disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
