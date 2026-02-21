import { useEffect, useRef, useState, useCallback } from "react";
import * as d3Force from "d3-force";
import * as d3Zoom from "d3-zoom";
import * as d3Selection from "d3-selection";
import * as d3Drag from "d3-drag";
import { useGraphStore } from "../../stores/graphStore";
import { useNoteStore } from "../../stores/noteStore";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphNode, GraphEdge } from "../../types/graph";

interface SimNode extends d3Force.SimulationNodeDatum {
  id: string;
  title: string;
  link_count: number;
  tags: string[];
}

interface SimLink extends d3Force.SimulationLinkDatum<SimNode> {
  link_type: string;
}

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function getNodeColor(tags: string[]): string {
  if (tags.length === 0) return "#94a3b8";
  // Deterministic color from first tag
  let hash = 0;
  for (const c of tags[0]) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function KnowledgeGraphView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const graph = useGraphStore((s) => s.graph);
  const isLoading = useGraphStore((s) => s.isLoading);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const selectNote = useNoteStore((s) => s.selectNote);
  const selectedNoteId = useNoteStore((s) => s.selectedNoteId);

  const [depth, setDepth] = useState(2);
  const [maxNodes, setMaxNodes] = useState(200);

  useEffect(() => {
    loadGraph(selectedNoteId ?? undefined, depth, maxNodes);
  }, [loadGraph, selectedNoteId, depth, maxNodes]);

  const handleCenter = useCallback(() => {
    loadGraph(selectedNoteId ?? undefined, depth, maxNodes);
  }, [loadGraph, selectedNoteId, depth, maxNodes]);

  useEffect(() => {
    if (!graph || !svgRef.current) return;
    if (graph.nodes.length === 0) return;

    const svg = d3Selection.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom
    const zoom = d3Zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Prepare data
    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = graph.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        link_type: e.link_type,
      }));

    // Simulation
    const simulation = d3Force
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3Force
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(80),
      )
      .force("charge", d3Force.forceManyBody().strength(-200))
      .force("center", d3Force.forceCenter(width / 2, height / 2))
      .force("collide", d3Force.forceCollide(30));

    // Draw edges
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", (d) => (d.link_type === "wiki_link" ? 1.0 : 0.3))
      .attr("stroke-width", 1);

    // Draw nodes
    const node = g
      .append("g")
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => Math.max(6, Math.min(20, 6 + d.link_count * 2)))
      .attr("fill", (d) => getNodeColor(d.tags))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        selectNote(d.id);
      });

    // Drag behavior
    const drag = d3Drag
      .drag<SVGCircleElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Labels
    const label = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.title.length > 20 ? d.title.slice(0, 20) + "..." : d.title)
      .attr("font-size", "10px")
      .attr("fill", "currentColor")
      .attr("dx", 12)
      .attr("dy", 4)
      .style("pointer-events", "none");

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);

      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
      label.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    return () => {
      simulation.stop();
    };
  }, [graph, selectNote]);

  return (
    <div className="h-full flex flex-col bg-bear-bg">
      <GraphToolbar
        depth={depth}
        maxNodes={maxNodes}
        onDepthChange={setDepth}
        onMaxNodesChange={setMaxNodes}
        onCenter={handleCenter}
      />
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-bear-text-muted text-[13px]">
            Loading graph...
          </div>
        )}
        {!isLoading && graph && graph.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-bear-text-muted text-[13px]">
            No connections found. Link notes using [[Note Title]] syntax.
          </div>
        )}
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ color: "var(--bear-text-secondary, #6b7280)" }}
        />
      </div>
    </div>
  );
}
