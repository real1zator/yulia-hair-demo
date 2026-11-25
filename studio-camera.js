function workerTracker(signal) {
  const worker = new Worker(new URL('./face-worker.js?v=ar', import.meta.url));
  let waiting;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    worker.terminate();
    waiting?.reject(new DOMException('Session stopped', 'AbortError'));
    signal.removeEventListener('abort', close);
  }
  signal.addEventListener('abort', close, { once: true });
  worker.onmessage = ({ data }) => {
    if (!waiting) return;
    const pending = waiting;
    waiting = undefined;
    if (data.type === 'error') pending.reject(new Error(data.message));
    else pending.resolve(data);
  };
  worker.onerror = event => {
    event.preventDefault();
    waiting?.reject(new Error(event.message || 'Tracking worker unavailable'));
  };
  const submit = (data, transfer = []) => new Promise((resolve, reject) => {
    if (closed) return reject(new DOMException('Session stopped', 'AbortError'));
    waiting = { resolve, reject };
    worker.postMessage(data, transfer);
  });

  return submit({ type: 'start' }).then(({ triangles }) => ({
    triangles,
    async sample(source, time) {
      const image = await createImageBitmap(source);
      if (closed) {
        image.close();
        return null;
      }
      return (await submit({ type: 'frame', image, time }, [image])).points;
    },
    close,
  }), error => {
    close();
    throw error;
  });
}

async function startTracker(signal) {
  if (typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function') {
    try {
      return await workerTracker(signal);
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  const { createFaceTracker } = await import('./face-tracker.js?v=ar');
  signal.throwIfAborted();
  const tracker = await createFaceTracker();
  return { triangles: tracker.triangles, sample: tracker.estimate, close: tracker.close };
}

export async function openStudioCamera(video, signal, callbacks) {
  let stream, tracker, frame = 0, closed = false;
  const capture = document.createElement('canvas');
  const context = capture.getContext('2d', { alpha: false });
  if (!context) throw Error('Video capture is unavailable');

  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop());
    tracker?.close();
    if (video.srcObject === stream) {
      video.pause();
      video.srcObject = null;
    }
    signal.removeEventListener('abort', close);
  }
  signal.addEventListener('abort', close, { once: true });
  try {
    signal.throwIfAborted();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'user' }, width: { ideal: 960 }, height: { ideal: 720 } },
    });
    if (signal.aborted) {
      stream.getTracks().forEach(track => track.stop());
      signal.throwIfAborted();
    }
    video.srcObject = stream;
    await video.play();
    callbacks.onPreparing();
    const detector = await startTracker(signal);
    if (signal.aborted) {
      detector.close();
      signal.throwIfAborted();
    }
    tracker = detector;
    callbacks.onReady(tracker.triangles);
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (closed) return;
      close();
      callbacks.onError(new DOMException('Camera stopped', 'NotReadableError'));
    }, { once: true }));

    let last = -Infinity, lastVideoTime = -1;
    async function tick(time) {
      if (closed) return;
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime && time - last >= 62) {
        last = time;
        lastVideoTime = video.currentTime;
        const { videoWidth: width, videoHeight: height } = video;
        const scale = Math.min(1, 640 / Math.max(width, height));
        const w = Math.round(width * scale), h = Math.round(height * scale);
        if (capture.width !== w || capture.height !== h) {
          capture.width = w;
          capture.height = h;
        }
        try {
          context.drawImage(video, 0, 0, w, h);
          const points = await tracker.sample(capture, time);
          if (!closed) callbacks.onFrame(points, width, height);
        } catch (error) {
          if (!closed) {
            close();
            callbacks.onError(error);
          }
          return;
        }
      }
      if (!closed) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  } catch (error) {
    close();
    throw error;
  }
}
