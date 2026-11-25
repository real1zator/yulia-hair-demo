(() => {
  const panel = document.getElementById('preview');
  const canvas = document.getElementById('look-canvas');
  const context = canvas.getContext('2d');
  const caption = document.getElementById('view-caption');
  const hint = document.getElementById('viewer-hint');
  const modes = [...document.querySelectorAll('[data-view]')];
  const views = ['Спереди', 'Сбоку', 'Сзади'];
  const textures = { straight: 'прямые волосы', wave: 'волнистые волосы', curl: 'локоны' };
  const assets = new Map();
  let activeView = 0;
  let requestId = 0;
  let options;
  let drag;

  if (!context) {
    hint.textContent = 'Для просмотра ракурсов откройте примерочную в другом браузере.';
    modes.forEach(button => { button.disabled = true; });
    return;
  }

  function getSheet(file) {
    if (!assets.has(file)) {
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
    }
    return assets.get(file);
  }

  async function render() {
    if (!options) return;
    const { length, shade, texture } = options;
    const column = activeView;
    const row = [50, 60, 70].indexOf(length);
    const file = texture + '-' + shade.id;
    const version = ++requestId;
    panel.setAttribute('aria-busy', 'true');
    try {
      const sheet = await getSheet(file);
      if (version !== requestId) return;
      const width = Math.floor(sheet.naturalWidth / 3);
      const height = Math.floor(sheet.naturalHeight / 3);
      canvas.width = width - 2;
      canvas.height = height - 2;
      context.drawImage(sheet, column * width + 1, row * height + 1, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      canvas.setAttribute('aria-label', views[column] + ', ' + length + ' см, ' + shade.label.toLowerCase() + ', ' + textures[texture]);
      caption.textContent = length + ' см · ' + shade.label;
      panel.classList.add('has-photo');
      hint.textContent = 'Смахните фото или выберите ракурс';
      if (canvas.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        canvas.getAnimations?.().forEach(animation => animation.cancel());
        canvas.animate([{ opacity: .76 }, { opacity: 1 }], { duration: 230, easing: 'ease-out' });
      }
    } catch {
      if (version !== requestId) return;
      panel.classList.remove('has-photo');
      caption.textContent = 'Кадр недоступен';
      hint.textContent = 'Кадр не загрузился. Выберите ракурс, чтобы повторить.';
    } finally {
      if (version === requestId) panel.setAttribute('aria-busy', 'false');
    }
  }

  function select(index) {
    activeView = (views.length + index) % views.length;
    modes.forEach((button, position) => button.setAttribute('aria-pressed', String(position === activeView)));
    render();
  }

  modes.forEach((button, index) => button.addEventListener('click', () => select(index)));
  panel.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    panel.setPointerCapture(event.pointerId);
  });
  panel.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag = null;
    if (Math.abs(dx) >= 30 && Math.abs(dx) > Math.abs(dy)) select(activeView + (dx < 0 ? 1 : -1));
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    panel.addEventListener(type, event => { if (drag?.id === event.pointerId) drag = null; });
  }

  window.hairPreview = {
    update(next) {
      options = next;
      render();
    },
  };
})();
