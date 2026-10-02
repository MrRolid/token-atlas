import {fillSimilarityRows} from './similarity.js';
self.onmessage = ({data}) => {
  const result = new Float32Array(1000000);
  fillSimilarityRows(new Float32Array(data), result, 0, 1000);
  self.postMessage(result.buffer, [result.buffer]);
};
