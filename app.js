(() => {
  const services = [
    { id: 'capsule', name: 'Капсульное', price: 12000, duration: '3–4 часа', group: 'extension' },
    { id: 'micro', name: 'Микрокапсулы', price: 15500, duration: 'около 4 часов', group: 'extension' },
    { id: 'tape', name: 'Ленточное', price: 9000, duration: '2 часа', group: 'extension' },
    { id: 'hollywood', name: 'Голливудское', price: 10500, duration: '2,5 часа', group: 'extension' },
    { id: 'fix-capsule', name: 'Коррекция капсул', price: 8500, duration: 'около 3 часов', group: 'care' },
    { id: 'fix-tape', name: 'Коррекция лент', price: 6500, duration: '2 часа', group: 'care' },
    { id: 'remove', name: 'Снятие', price: 3000, duration: '1–1,5 часа', group: 'care' },
    { id: 'tone', name: 'Тонирование', price: 3500, duration: '1 час', group: 'care' },
  ];
  const hairPrice = { 50: 7500, 60: 9900, 70: 12800 };
  const shades = [
    { id: 'noir', label: 'Чёрный', color: '#181618' },
    { id: 'espresso', label: 'Эспрессо', color: '#342528' },
    { id: 'chestnut', label: 'Каштан', color: '#5d3225' },
    { id: 'caramel', label: 'Карамель', color: '#975b35' },
    { id: 'copper', label: 'Медный', color: '#ba6131' },
    { id: 'rusy', label: 'Русый', color: '#89715c' },
    { id: 'blond', label: 'Медовый блонд', color: '#c69a66' },
    { id: 'ash', label: 'Пепельный блонд', color: '#c6b8a2' },
  ];
  const textures = { straight: 'Прямые', wave: 'Волны', curl: 'Локоны' };
  const looks = [
    { title: 'Гладкий эспрессо', length: 50, shade: 'espresso', texture: 'straight', position: 0 },
    { title: 'Каштановые волны', length: 60, shade: 'chestnut', texture: 'wave', position: 50 },
    { title: 'Медовые локоны', length: 70, shade: 'blond', texture: 'curl', position: 100 },
  ];
  const state = { method: 'capsule', length: 50, shade: 'chestnut', texture: 'wave', weight: 150 };
  const filters = { all: 'Весь прайс', extension: 'Наращивание', care: 'Уход', material: 'Волосы' };
  const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
  const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kaliningrad', year: 'numeric', month: '2-digit', day: '2-digit' });
  const formatDate = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
  const $ = id => document.getElementById(id);
  const serviceById = id => services.find(service => service.id === id);
  const shadeById = id => shades.find(shade => shade.id === id);
  const price = value => money.format(value);
  let currentFilter = 'all';
  let booking;

  const option = (label, key, value) => '<button class="option" type="button" aria-pressed="false" data-' + key + '="' + value + '">' + label + '</button>';

  $('method').innerHTML = services.filter(service => service.group === 'extension').map(service =>
    '<option value="' + service.id + '">' + service.name + ' · ' + price(service.price) + '</option>'
  ).join('');
  $('length-options').innerHTML = Object.keys(hairPrice).map(length => option(length + ' см', 'length', length)).join('');
  $('texture-options').innerHTML = Object.entries(textures).map(([id, label]) => option(label, 'texture', id)).join('');
  $('shade-options').innerHTML = shades.map(shade =>
    '<button class="swatch" type="button" aria-pressed="false" aria-label="' + shade.label + '" title="' + shade.label + '" style="--swatch:' + shade.color + '" data-shade="' + shade.id + '"><i aria-hidden="true"></i><span>' + shade.label + '</span></button>'
  ).join('');
  $('price-filters').innerHTML = Object.entries(filters).map(([id, label]) => option(label, 'filter', id)).join('');
  $('look-list').innerHTML = looks.map((look, index) =>
    '<button class="look-card" type="button" data-look="' + index + '" aria-label="Примерить образ «' + look.title + '»">' +
      '<span class="look-photo" aria-hidden="true" style="background-position:' + look.position + '% center"></span>' +
      '<span class="look-meta"><span><strong>' + look.title + '</strong><small>' + look.length + ' см · ' + textures[look.texture].toLowerCase() + '</small></span><span aria-hidden="true">↗</span></span>' +
    '</button>'
  ).join('');

  function renderOptions() {
    const service = serviceById(state.method);
    const shade = shadeById(state.shade);
    const material = hairPrice[state.length] * state.weight / 100;
    const total = price(service.price + material);
    $('weight-value').textContent = state.weight + ' г';
    $('weight').value = state.weight;
    $('method').value = state.method;
    $('shade-name').textContent = shade.label;
    $('estimate-work').textContent = price(service.price);
    $('estimate-hair').textContent = price(material);
    $('estimate-total').textContent = total;
    $('dock-label').textContent = service.name + ' · ' + state.length + ' см';
    $('dock-total').textContent = total;
    for (const key of ['length', 'shade', 'texture']) {
      document.querySelectorAll('button[data-' + key + ']').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset[key] === String(state[key])));
      });
    }
  }

  function updateImage() {
    window.hairPreview?.update({ ...state, shade: shadeById(state.shade) });
  }

  function priceRow(name, priceText, action, attribute, value) {
    return '<article class="price-row"><h3>' + name + '</h3><p>' + priceText + '</p><button type="button" data-' + attribute + '="' + value + '">' + action + '</button></article>';
  }

  function renderPrices() {
    const serviceRows = services.filter(service => currentFilter === 'all' || service.group === currentFilter)
      .map(service => priceRow(service.name, price(service.price) + ' · ' + service.duration, 'Записаться', 'book', service.id));
    const hairRows = ['all', 'material'].includes(currentFilter) ?
      Object.entries(hairPrice).map(([length, value]) => priceRow('Славянские волосы · ' + length + ' см', price(value) + ' / 100 г', 'Примерить', 'add-length', length)) : [];
    $('price-list').innerHTML = [...serviceRows, ...hairRows].join('');
    $('price-filters').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === currentFilter)));
  }

  function openBooking(serviceId) {
    const selected = serviceById(serviceId || state.method);
    const material = selected.group === 'extension' ? hairPrice[state.length] * state.weight / 100 : 0;
    const details = material ? ' · ' + state.length + ' см · ' + state.weight + ' г · ' + shadeById(state.shade).label + ' · ' + textures[state.texture].toLowerCase() : '';
    booking = { service: selected.name, details, amount: selected.price + material };
    $('booking-summary').textContent = booking.service + booking.details + ' · ориентир ' + price(booking.amount);
    const form = $('booking-form');
    form.reset();
    form.elements.date.min = calendar.format(new Date());
    $('booking-result').hidden = true;
    form.hidden = false;
    $('booking-error').textContent = '';
    $('copy-status').textContent = '';
    $('booking').showModal();
  }

  $('method').addEventListener('change', event => { state.method = event.target.value; renderOptions(); });
  $('weight').addEventListener('input', event => { state.weight = Number(event.target.value); renderOptions(); });
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-book')) return openBooking(button.dataset.book);
    if (button.dataset.filter) { currentFilter = button.dataset.filter; renderPrices(); return; }
    if (button.dataset.look !== undefined || button.dataset.addLength) {
      if (button.dataset.addLength) state.length = Number(button.dataset.addLength);
      else {
        const { length, shade, texture } = looks[Number(button.dataset.look)];
        Object.assign(state, { length, shade, texture });
      }
      renderOptions();
      updateImage();
      $('atelier').scrollIntoView();
      return;
    }
    const key = ['length', 'shade', 'texture'].find(type => button.dataset[type]);
    if (key) {
      state[key] = key === 'length' ? Number(button.dataset[key]) : button.dataset[key];
      renderOptions();
      updateImage();
    }
  });

  $('close-booking').addEventListener('click', () => $('booking').close());
  $('booking-form').addEventListener('submit', event => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    fields.name = fields.name.trim();
    fields.contact = fields.contact.trim();
    const phone = fields.contact.replace(/[\s()+-]/g, '');
    if (fields.name.length < 2 || !(/^\d{10,15}$/.test(phone) || /^@[a-z\d_]{5,32}$/i.test(fields.contact))) {
      $('booking-error').textContent = 'Укажите имя и телефон или Telegram в формате @username.';
      return;
    }
    if (fields.date < calendar.format(new Date())) {
      $('booking-error').textContent = 'Выберите дату начиная с сегодняшнего дня.';
      return;
    }
    const row = { ...booking, ...fields };
    try {
      localStorage.setItem('yulia-hair-demo-request', JSON.stringify(row));
    } catch {
      $('booking-error').textContent = 'Браузер заблокировал сохранение. Попробуйте открыть демо в обычной вкладке.';
      return;
    }
    $('booking-text').value = [
      'Здравствуйте! Хочу записаться к Юлии.',
      row.service + row.details,
      'Ориентировочная стоимость — ' + price(row.amount),
      'Желаемая дата — ' + formatDate.format(new Date(row.date + 'T12:00:00Z')) + ' · ' + row.time,
      'Имя — ' + row.name,
      'Связь — ' + row.contact,
    ].join('\n');
    event.currentTarget.hidden = true;
    $('booking-result').hidden = false;
    $('share-booking').hidden = !navigator.share;
    $('copy-booking').focus();
  });
  $('copy-booking').addEventListener('click', async () => {
    const text = $('booking-text');
    try {
      await navigator.clipboard.writeText(text.value);
      $('copy-status').textContent = 'Заявка скопирована.';
    } catch {
      text.focus();
      text.select();
      $('copy-status').textContent = document.execCommand('copy') ? 'Заявка скопирована.' : 'Текст выделен. Скопируйте его с помощью браузера.';
    }
  });
  $('share-booking').addEventListener('click', async () => {
    try { await navigator.share({ title: 'Запись к Юлии', text: $('booking-text').value }); }
    catch (error) { if (error.name !== 'AbortError') $('copy-status').textContent = 'Скопируйте текст заявки, чтобы отправить его вручную.'; }
  });

  const menu = $('menu-button');
  const nav = $('navigation');
  function setMenu(open) {
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    nav.classList.toggle('open', open);
  }
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') === 'false'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); }
  });

  renderOptions();
  updateImage();
  renderPrices();
  if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const animation = gsap.timeline({ defaults: { ease: 'power3.out' } });
    animation.from('.hero-visual img', { scale: 1.075, opacity: .65, duration: 1.35 }, 0)
      .from('.hero-inner > *', { y: 16, opacity: 0, duration: .68, stagger: .077, clearProps: 'transform,opacity' }, .17);
  }
})();