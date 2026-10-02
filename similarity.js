// Full 48-dimensional cosine similarities. Normalized vectors are supplied by the scene.
export function fillSimilarityRows(normalized, result, start, end) {
  const count = 1000, dims = 48;
  for (let row = start; row < end; row++) {
    for (let col = row; col < count; col++) {
      let dot = 0;
      for (let d = 0; d < dims; d++) dot += normalized[row * dims + d] * normalized[col * dims + d];
      result[row * count + col] = dot;
      result[col * count + row] = dot;
    }
  }
}
export async function similarityOnMainThread(normalized) {
  const result = new Float32Array(1000000);
  for (let start = 0; start < 1000; start += 25) {
    fillSimilarityRows(normalized, result, start, Math.min(start + 25, 1000));
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return result;
}
