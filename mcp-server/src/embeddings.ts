// MCP server embedding generation using @huggingface/transformers
// Generates 384-dimensional embeddings using all-MiniLM-L6-v2

let pipeline: unknown = null;

export async function generateEmbedding(text: string): Promise<number[]> {
  const { pipeline: createPipeline } = await import("@huggingface/transformers");

  if (!pipeline) {
    pipeline = await createPipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }

  const result = await (pipeline as CallableFunction)(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(result.data as Float32Array);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}
