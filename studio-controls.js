import { createStudio } from './studio-renderer.js?v=ar';

const panel = document.getElementById('preview');
const canvas = document.getElementById('look-canvas');
const caption = document.getElementById('view-caption');
const viewLabel = document.getElementById('studio-view');
const status = document.getElementById('studio-status');
const video = document.getElementById('studio-video');
const modelButton = document.getElementById('mode-model');
const liveButton = document.getElementById('mode-camera');
const deck = document.getElementById('studio-deck');
const hint = document.getElementById('viewer-hint');
const modelHint = hint.textContent;
let cameraSession, liveFrame, tracking = false;
const zoomOutput = document.getElementById('zoom-value');
const views = [...document.querySelectorAll('[data-view]')];
const zoomButtons = [...document.querySelectorAll('[data-zoom]')];
const reset = document.getElementById('reset-camera');
const textures = { straight: 'прямые волосы', wave: 'волнистые волосы', curl: 'локоны' };
const pointers = new Map();
const minimumZoom = .8, maximumZoom = 3;
const camera = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
const facing = ['Анфас', 'Правый профиль', 'Со спины', 'Левый профиль'];
let projector, selected, frame = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const shortestAngle = yaw => ((yaw + 180) % 360 + 360) % 360 - 180;

function updateReadout() {
  const turn = (Math.round(camera.yaw / 90) + 4) % facing.length;
  const pitch = Math.round(camera.pitch);
  viewLabel.textContent = facing[turn] + (Math.abs(pitch) >= 1 ? ' · ' + (pitch > 0 ? '↑ ' : '↓ ') + Math.abs(pitch) + '°' : '');
  zoomOutput.value = Math.round(camera.zoom * 100) + '%';
  zoomButtons[0].disabled = !projector || camera.zoom <= minimumZoom;
  zoomButtons[1].disabled = !projector || camera.zoom >= maximumZoom;
  views.forEach(button => {
    const target = Number(button.dataset.view);
    const nearest = Math.abs(shortestAngle(camera.yaw - target));
    const oppositeProfile = target === 90 && Math.abs(shortestAngle(camera.yaw + 90)) <= 20;
    button.setAttribute('aria-pressed', String(nearest <= 20 || oppositeProfile));
  });
  if (selected) {
    canvas.setAttribute('aria-label', facing[turn] + ', ' + selected.length + ' см, ' + selected.shade.label + ', ' + textures[selected.texture]);
  }
}

function paint() {
  frame = 0;
  if (tracking) {
    const visible = Boolean(liveFrame && projector?.renderFace(liveFrame.points, liveFrame.width, liveFrame.height));
    const state = visible ? 'face' : 'waiting';
    if (panel.dataset.tracking !== state) {
      panel.dataset.tracking = state;
      cameraNotice(visible ? '' : 'Смотрите в камеру. Оставьте в кадре лицо, макушку и плечи.');
    }
    viewLabel.textContent = 'Камера';
    canvas.setAttribute('aria-label', 'Выбранные 3D-волосы на изображении с камеры');
    return;
  }
  updateReadout();
  projector?.render(camera);
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(paint);
}

function setLook(options) {
  selected = options;
  caption.textContent = options.length + ' см · ' + options.shade.label;
  projector?.setLook(options);
  schedule();
}

function showError(message) {
  projector = undefined;
  panel.classList.remove('has-model');
  panel.removeAttribute('data-renderer');
  panel.setAttribute('aria-busy', 'false');
  status.textContent = message;
  status.hidden = false;
  [...views, ...zoomButtons, reset].forEach(button => { button.disabled = true; });
}

window.hairPreview = { update: setLook };
document.dispatchEvent(new Event('hair-preview-ready'));

async function initialize() {
  try {
    projector = await createStudio(canvas);
    if (selected) projector.setLook(selected);
    paint();
    panel.classList.add('has-model');
    panel.dataset.renderer = 'volume';
    panel.setAttribute('aria-busy', 'false');
    status.hidden = true;
    liveButton.disabled = false;
    canvas.addEventListener('webglcontextlost', () => {
      if (cameraSession) returnToModel();
      liveButton.disabled = true;
      showError('3D-сцена прервалась. Обновите страницу, чтобы восстановить просмотр.');
    }, { once: true });
  } catch {
    showError('3D-модель не загрузилась. Обновите страницу или откройте её в другом браузере.');
  }
}
initialize();


function cameraNotice(message) {
  status.textContent = message;
  status.hidden = !message;
}

function returnToModel(message = '') {
  cameraSession?.abort();
  cameraSession = undefined;
  liveFrame = undefined;
  tracking = false;
  projector?.disableCamera();
  panel.classList.remove('is-ar');
  delete panel.dataset.tracking;
  panel.setAttribute('aria-busy', 'false');
  video.hidden = true;
  deck.hidden = false;
  hint.textContent = modelHint;
  modelButton.setAttribute('aria-pressed', 'true');
  liveButton.setAttribute('aria-pressed', 'false');
  liveButton.disabled = !projector;
  cameraNotice(message);
  schedule();
}

function cameraError(error) {
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return 'Разрешите камеру в настройках браузера и снова нажмите «На себе».';
  }
  if (error.name === 'NotFoundError' || error.name === 'NotReadableError') {
    return 'Камера недоступна. Подключите её или закройте другое приложение, которое её использует.';
  }
  return 'Примерка с камерой не запустилась. Попробуйте ещё раз или продолжите на модели.';
}

async function startCamera() {
  if (cameraSession || !projector) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraNotice('Камера доступна в браузере по защищённой ссылке. Откройте онлайн-версию студии.');
    return;
  }

  const current = new AbortController();
  cameraSession = current;
  liveButton.disabled = true;
  panel.setAttribute('aria-busy', 'true');
  video.hidden = false;
  cameraNotice('Разрешите доступ к камере в браузере.');
  try {
    const { openStudioCamera } = await import('./studio-camera.js?v=ar');
    current.signal.throwIfAborted();
    await openStudioCamera(video, current.signal, {
      onPreparing() {
        cameraNotice('Загружаем отслеживание лица…');
      },
      onReady(triangles) {
        projector.enableCamera(triangles);
        panel.classList.add('is-ar');
        panel.dataset.tracking = 'waiting';
        tracking = true;
        panel.setAttribute('aria-busy', 'false');
        liveButton.disabled = false;
        modelButton.setAttribute('aria-pressed', 'false');
        liveButton.setAttribute('aria-pressed', 'true');
        deck.hidden = true;
        hint.textContent = 'Поворачивайте голову, чтобы рассмотреть образ. Кадры обрабатываются в браузере.';
        cameraNotice('Смотрите в камеру. Оставьте в кадре лицо, макушку и плечи.');
        schedule();
      },
      onFrame(points, width, height) {
        liveFrame = { points, width, height };
        schedule();
      },
      onError(error) {
        if (cameraSession === current) returnToModel(cameraError(error));
      },
    });
  } catch (error) {
    if (cameraSession === current) returnToModel(cameraError(error));
  }
}

modelButton.addEventListener('click', () => { if (cameraSession) returnToModel(); else if (projector) cameraNotice(''); });
liveButton.addEventListener('click', startCamera);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && cameraSession) returnToModel();
});
window.addEventListener('pagehide', () => {
  if (cameraSession) returnToModel();
});


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
  camera.pitch = clamp(camera.pitch + dy, -65, 75);
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
  if (tracking || !projector || (event.button !== 0 && event.button !== 2) || pointers.size >= 2) return;
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
  if (tracking) return;
  if (document.activeElement !== panel && !event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode ? 22 : 1);
  zoomTo(camera.zoom * Math.exp(-delta * .0025));
}, { passive: false });

panel.addEventListener('keydown', event => {
  if (tracking) return;
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
