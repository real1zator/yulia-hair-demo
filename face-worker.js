let tracker;

self.onmessage = async ({ data }) => {
  if (data.type === 'start') {
    try {
      const { createFaceTracker } = await import('./face-tracker.js?v=ar');
      tracker = await createFaceTracker(new OffscreenCanvas(1, 1));
      self.postMessage({ type: 'ready', triangles: tracker.triangles });
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message });
    }
  }
  if (data.type === 'frame') {
    try {
      const points = tracker.estimate(data.image, data.time);
      self.postMessage({ type: 'face', points }, points ? [points.buffer] : []);
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message });
    } finally {
      data.image.close();
    }
  }
};
