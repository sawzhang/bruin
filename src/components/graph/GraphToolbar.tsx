interface GraphToolbarProps {
  depth: number;
  maxNodes: number;
  onDepthChange: (depth: number) => void;
  onMaxNodesChange: (maxNodes: number) => void;
  onCenter: () => void;
}

export function GraphToolbar({
  depth,
  maxNodes,
  onDepthChange,
  onMaxNodesChange,
  onCenter,
}: GraphToolbarProps) {
  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-bear-bg border-b border-bear-border text-[12px]">
      <label className="flex items-center gap-1.5 text-bear-text-secondary">
        Depth:
        <select
          value={depth}
          onChange={(e) => onDepthChange(Number(e.target.value))}
          className="bg-bear-bg border border-bear-border rounded px-1.5 py-0.5 text-bear-text outline-none"
        >
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-bear-text-secondary">
        Max nodes:
        <input
          type="range"
          min={10}
          max={500}
          step={10}
          value={maxNodes}
          onChange={(e) => onMaxNodesChange(Number(e.target.value))}
          className="w-20"
        />
        <span className="text-bear-text w-8">{maxNodes}</span>
      </label>

      <button
        onClick={onCenter}
        className="px-2 py-0.5 rounded border border-bear-border text-bear-text-secondary hover:bg-bear-hover hover:text-bear-text transition-colors"
      >
        Center on note
      </button>
    </div>
  );
}
