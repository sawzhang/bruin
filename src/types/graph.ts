export interface GraphNode {
  id: string;
  title: string;
  link_count: number;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  link_type: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
