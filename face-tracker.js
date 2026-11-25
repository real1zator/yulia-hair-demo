import { FaceLandmarker, FilesetResolver } from './assets/mediapipe/vision_bundle.mjs';

export async function createFaceTracker(canvas) {
  const wasmRoot = new URL('./assets/mediapipe/wasm', import.meta.url).href;
  const modelPath = new URL('./assets/mediapipe/face_landmarker.task', import.meta.url).href;
  const fileset = await FilesetResolver.forVisionTasks(wasmRoot);
  const tracker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
    ...(canvas ? { canvas } : {}),
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: .55,
    minFacePresenceConfidence: .52,
    minTrackingConfidence: .55,
  });

  const edges = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
  const triangles = [];
  for (let i = 0; i + 2 < edges.length; i += 3) {
    const [a, b, c] = [edges[i], edges[i + 1], edges[i + 2]];
    if (a.end === b.start && b.end === c.start && c.end === a.start) {
      triangles.push(a.start, b.start, c.start);
    }
  }

  // The face tessellation leaves the eyes open. Fill those openings for the depth mask.
  for (const eye of [FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE]) {
    const lower = eye.slice(0, 8);
    const upper = eye.slice(8);
    for (let i = 0; i < lower.length; i++) {
      const a = lower[i], b = upper[i];
      if (a.start !== b.start) triangles.push(a.start, b.start, a.end);
      if (a.end !== b.end) triangles.push(a.end, b.start, b.end);
    }
  }

  return {
    triangles,
    estimate(source, time) {
      const points = tracker.detectForVideo(source, time).faceLandmarks[0];
      if (!points) return null;
      const packed = new Float32Array(points.length * 3);
      points.forEach(({ x, y, z }, i) => packed.set([x, y, z], i * 3));
      return packed;
    },
    close() {
      tracker.close();
    },
  };
}
