// Frontend embedding generation using @huggingface/transformers (WASM)
// This module provides client-side embedding for search queries

let pipeline: unknown = null;

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Dynamic import to avoid loading the model until needed
    const { pipeline: createPipeline } = await import(
      "@huggingface/transformers"
    );

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
  } catch {
    // Fallback: return empty embedding if model fails to load
    return [];
  }
}
