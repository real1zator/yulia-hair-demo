(() => {
  const panel = document.getElementById('preview');
  const caption = document.getElementById('view-caption');
  const viewLabel = document.getElementById('studio-view');
  const hint = document.getElementById('viewer-hint');
  const zoomOutput = document.getElementById('zoom-value');
  const views = [...document.querySelectorAll('[data-view]')];
  const zoomButtons = [...document.querySelectorAll('[data-zoom]')];
  const reset = document.getElementById('reset-camera');
  const textures = { straight: 'прямые волосы', wave: 'волнистые волосы', curl: 'локоны' };
  const assets = new Map(), pointers = new Map();
  const minimumZoom = .8, maximumZoom = 3;
  const camera = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
  const renderer = window.hairStudioRenderer;
  let projector;
  let frame = 0, version = 0;
  let selected, sheet, shown;

  try {
    projector = renderer.create(document.getElementById('look-canvas'), location.protocol === 'file:');
    panel.dataset.renderer = projector.mode;
  } catch {
    hint.textContent = 'Для просмотра ракурсов откройте примерочную в другом браузере.';
    panel.setAttribute('aria-busy', 'false');
    [...views, ...zoomButtons, reset].forEach(button => { button.disabled = true; });
    return;
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const shortestAngle = yaw => ((yaw + 180) % 360 + 360) % 360 - 180;

  function updateReadout() {
    const current = renderer.activeView(camera.yaw);
    const pitch = Math.round(camera.pitch);
    viewLabel.textContent = current.name + (Math.abs(pitch) >= 1 ? ' · ' + (pitch > 0 ? '↑ ' : '↓ ') + Math.abs(pitch) + '°' : '');
    zoomOutput.value = Math.round(camera.zoom * 100) + '%';
    zoomButtons[0].disabled = camera.zoom <= minimumZoom;
    zoomButtons[1].disabled = camera.zoom >= maximumZoom;
    views.forEach(button => {
      const target = Number(button.dataset.view);
      const nearest = Math.abs(shortestAngle(camera.yaw - target));
      const mirror = target === 90 && Math.abs(shortestAngle(camera.yaw + 90)) <= 20;
      button.setAttribute('aria-pressed', String(nearest <= 20 || mirror));
    });
    if (shown) {
      const name = current.name + ', ' + shown.length + ' см, ' + shown.shade.label + ', ' + textures[shown.texture];
      document.getElementById('look-canvas').setAttribute('aria-label', name);
    }
  }

  function paint() {
    frame = 0;
    updateReadout();
    if (sheet && shown && projector.render(sheet, camera, [50, 60, 70].indexOf(shown.length))) schedule();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function getSheet(file) {
    if (assets.has(file)) {
      const cached = assets.get(file);
      assets.delete(file);
      assets.set(file, cached);
      return cached;
    }
    const loaded = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = 'assets/preview/' + file + '.webp';
    }).catch(error => {
      assets.delete(file);
      throw error;
    });
    assets.set(file, loaded);
    if (assets.size > 6) assets.delete(assets.keys().next().value);
    return loaded;
  }

  const instructions = hint.textContent;
  async function loadLook() {
    if (!selected) return;
    const target = selected;
    const current = ++version;
    panel.setAttribute('aria-busy', 'true');
    try {
      const image = await getSheet(target.texture + '-' + target.shade.id);
      if (current !== version) return;
      sheet = image;
      shown = target;
      caption.textContent = target.length + ' см · ' + target.shade.label;
      panel.classList.add('has-photo');
      hint.textContent = instructions;
      schedule();
    } catch {
      if (current !== version) return;
      sheet = shown = undefined;
      panel.classList.remove('has-photo');
      caption.textContent = 'Кадр недоступен';
      hint.textContent = 'Изображение не загрузилось. Выберите ракурс, чтобы повторить.';
    } finally {
      if (current === version) panel.setAttribute('aria-busy', 'false');
    }
  }

  function constrainPan() {
    const boundary = Math.max(0, (camera.zoom - 1) * .92);
    camera.panX = clamp(camera.panX, -boundary, boundary);
    camera.panY = clamp(camera.panY, -boundary, boundary);
  }

  function move(dx, dy) {
    camera.panX += dx * 2 / Math.max(1, panel.clientWidth);
    camera.panY -= dy * 2 / Math.max(1, panel.clientHeight);
    constrainPan();
    schedule();
  }

  function rotate(dx, dy) {
    camera.yaw = shortestAngle(camera.yaw + dx);
    camera.pitch = clamp(camera.pitch + dy, -25, 25);
    schedule();
  }

  function zoomTo(factor) {
    camera.zoom = clamp(factor, minimumZoom, maximumZoom);
    constrainPan();
    schedule();
  }

  function resetView() {
    Object.assign(camera, { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 });
    schedule();
  }

  views.forEach(button => button.addEventListener('click', () => {
    camera.yaw = Number(button.dataset.view);
    camera.pitch = 0;
    if (!sheet) loadLook();
    schedule();
  }));
  zoomButtons.forEach(button => button.addEventListener('click', () => {
    zoomTo(Math.round((camera.zoom + Number(button.dataset.zoom) * .25) * 100) / 100);
  }));
  reset.addEventListener('click', resetView);
  panel.addEventListener('contextmenu', event => event.preventDefault());

  const details = event => ({ x: event.clientX, y: event.clientY, pan: event.button === 2 || event.shiftKey });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  panel.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 2 || pointers.size >= 2) return;
    pointers.set(event.pointerId, details(event));
    panel.focus({ preventScroll: true });
    panel.setPointerCapture(event.pointerId);
  });
  panel.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const next = details(event);
    const dx = next.x - previous.x, dy = next.y - previous.y;
    const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const priorDistance = distance(previous, other);
      if (priorDistance > 4) zoomTo(camera.zoom * distance(next, other) / priorDistance);
      move(dx * .5, dy * .5);
    } else if (previous.pan || event.shiftKey) {
      move(dx, dy);
    } else {
      rotate(dx * -.52, dy * -.30);
    }
    pointers.set(event.pointerId, { ...next, pan: previous.pan });
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    panel.addEventListener(type, event => {
      pointers.delete(event.pointerId);
    });
  }

  panel.addEventListener('wheel', event => {
    if (document.activeElement !== panel && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode ? 22 : 1);
    zoomTo(camera.zoom * Math.exp(-delta * .0025));
  }, { passive: false });

  panel.addEventListener('keydown', event => {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      if (event.shiftKey) move(step[0] * 16, -step[1] * 16);
      else rotate(step[0] * 12, step[1] * 7);
    } else if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      zoomTo(camera.zoom + (event.key === '-' ? -.25 : .25));
    } else if (event.key === 'Home') {
      event.preventDefault();
      resetView();
    }
  });

  if (window.ResizeObserver) new ResizeObserver(schedule).observe(panel);
  else window.addEventListener('resize', schedule);
  document.getElementById('look-canvas').addEventListener('webglcontextlost', event => {
    event.preventDefault();
    const fresh = document.getElementById('look-canvas').cloneNode();
    document.getElementById('look-canvas').replaceWith(fresh);
    projector = renderer.create(fresh, true);
    panel.dataset.renderer = projector.mode;
    schedule();
  }, { once: true });
  updateReadout();

  window.hairPreview = {
    update(options) {
      selected = options;
      loadLook();
    },
  };
})();
