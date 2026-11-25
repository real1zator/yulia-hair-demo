(() => {
  const view = document.getElementById('preview');
  const canvas = document.getElementById('hair-canvas');
  const hint = document.getElementById('viewer-hint');
  const buttons = [...document.querySelectorAll('.viewer-controls button')];
  const neutralAngle = Math.PI * .92;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let update = () => {};

  function fallback() {
    hint.textContent = 'На этом устройстве показан пример образа';
    view.classList.remove('has-model');
    canvas.hidden = true;
    buttons.forEach(button => { button.disabled = true; });
  }

  window.hairPreview = { update: options => update(options) };
  const T = window.THREE;
  if (!T) return fallback();

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return fallback();
  }
  view.classList.add('has-model');
  canvas.addEventListener('webglcontextlost', fallback, { once: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(1.7, devicePixelRatio || 1));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(29, 1, .1, 25);
  const sculpture = new T.Group();
  scene.add(sculpture);
  scene.add(new T.HemisphereLight(0xffebd8, 0x775061, 2.25));

  function light(color, intensity, x, y, z) {
    const source = new T.DirectionalLight(color, intensity);
    source.position.set(x, y, z);
    scene.add(source);
  }
  light(0xffe1b5, 2.7, -3, 5, 2);
  light(0xffc389, 3.1, 2.3, 4, -4);
  light(0xffe8dc, 1.1, 3, 2, 1);

  const skin = new T.MeshStandardMaterial({ color: 0xb47863, roughness: .64 });
  const facial = new T.MeshStandardMaterial({ color: 0x6e3c39, roughness: .66 });
  const garment = new T.MeshStandardMaterial({ color: 0x2d2325, roughness: .64 });
  const sphere = new T.SphereGeometry(1, 32, 24);

  function oval(material, x, y, z, width, height, depth, angle = 0) {
    const mesh = new T.Mesh(sphere, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.rotation.z = angle;
    sculpture.add(mesh);
    return mesh;
  }
  oval(skin, 0, 2.39, .037, .49, .645, .46);
  oval(skin, 0, 2.145, .15, .387, .405, .365);
  oval(skin, 0, 1.65, .025, .24, .45, .225);
  const torsoProfile = [
    // Height, shoulder width, front-to-back depth and shoulder slope.
    [.22, .58, .36, 0],
    [.24, .60, .37, 0],
    [.46, .64, .40, 0],
    [.67, .74, .41, 0],
    [.84, .89, .40, .012],
    [.99, .94, .36, .020],
    [1.12, .87, .31, .035],
    [1.23, .67, .25, .040],
    [1.32, .43, .23, .048],
    [1.39, .25, .22, .035],
    [1.41, .248, .22, .035],
  ];
  const fabricPath = new T.SplineCurve(torsoProfile.map(([y, width]) => new T.Vector2(width, y)));
  const torsoPoints = [], torsoIndices = [];
  const torsoRings = 44, torsoSections = 72;
  for (let ring = 0; ring <= torsoRings; ring++) {
    const t = ring / torsoRings;
    const curve = fabricPath.getPoint(t);
    const profile = Math.min(torsoProfile.length - 2, Math.floor(t * (torsoProfile.length - 1)));
    const from = torsoProfile[profile], to = torsoProfile[profile + 1];
    const blend = t * (torsoProfile.length - 1) - profile;
    const depth = T.MathUtils.lerp(from[2], to[2], blend);
    const slope = T.MathUtils.lerp(from[3], to[3], blend);
    for (let col = 0; col <= torsoSections; col++) {
      const turn = col / torsoSections * 2 * Math.PI;
      const side = Math.sin(turn);
      torsoPoints.push(curve.x * side, curve.y - slope * side * side, .032 + depth * Math.cos(turn));
      if (ring && col) {
        const i = ring * (torsoSections + 1) + col;
        torsoIndices.push(i, i - torsoSections - 1, i - 1, i - 1, i - torsoSections - 1, i - torsoSections - 2);
      }
    }
  }
  garment.side = T.DoubleSide;
  sculpture.add(new T.Mesh(geometry(torsoPoints, null, torsoIndices), garment));
  oval(skin, 0, 2.255, .48, .083, .135, .12);
  for (const sign of [-1, 1]) {
    oval(skin, .48 * sign, 2.261, .026, .085, .15, .083, sign * -.12);
    oval(skin, .24 * sign, 2.246, .37, .168, .17, .096);
    oval(facial, .207 * sign, 2.409, .453, .095, .014, .014, sign * .095);
    oval(facial, .21 * sign, 2.496, .452, .106, .016, .017, sign * .10);
  }
  oval(facial, 0, 2.097, .485, .102, .017, .017);
  oval(skin, 0, 2.065, .477, .092, .019, .025);

  const hair = new T.Group();
  const capMaterial = new T.MeshStandardMaterial({ color: 0x3f261c, roughness: .43, side: T.DoubleSide });
  const hairMaterial = new T.MeshPhysicalMaterial({
    vertexColors: true, roughness: .42, metalness: .04,
    clearcoat: .39, clearcoatRoughness: .43, side: T.DoubleSide,
  });
  const detailMaterial = new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .46 });
  sculpture.add(hair);

  const capPoints = [], capIndices = [];
  const rings = 22, sections = 66;
  for (let row = 0; row <= rings; row++) {
    for (let col = 0; col <= sections; col++) {
      const t = (col / sections) * Math.PI * 2;
      const front = (1 + Math.cos(t)) * .5;
      const edge = 2.05 - .87 * Math.pow(front, 3);
      const phi = .001 + edge * row / rings;
      capPoints.push(.531 * Math.sin(phi) * Math.sin(t), 2.407 + .675 * Math.cos(phi), .035 + .506 * Math.sin(phi) * Math.cos(t));
      if (row && col) {
        const i = row * (sections + 1) + col;
        capIndices.push(i, i - 1, i - sections - 1, i - 1, i - sections - 2, i - sections - 1);
      }
    }
  }
  function geometry(positions, colors, indices) {
    const mesh = new T.BufferGeometry();
    mesh.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    if (colors) mesh.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    if (indices) {
      mesh.setIndex(indices);
      mesh.computeVertexNormals();
    }
    return mesh;
  }
  hair.add(new T.Mesh(geometry(capPoints, null, capIndices), capMaterial));
  const strands = new T.Mesh(new T.BufferGeometry(), hairMaterial);
  const detail = new T.LineSegments(new T.BufferGeometry(), detailMaterial);
  hair.add(strands, detail);

  function rand(number) {
    const value = Math.sin(number * 127.1 + 27.1) * 43758.5453;
    return value - Math.floor(value);
  }

  function buildHair({ length, shade, texture, weight }) {
    const color = new T.Color(shade.color);
    capMaterial.color.copy(color).multiplyScalar(.69);
    const positions = [], colors = [], indices = [], detailPoints = [], detailColors = [];
    const amount = Math.round(460 + (weight - 100) * 2.1);
    const steps = 30;
    const wave = texture === 'curl' ? .195 : texture === 'wave' ? .109 : .013;
    const frequency = texture === 'curl' ? 16.8 : 10.1;
    const drop = 1.13 + (length - 50) * .039;
    const bulk = 1 + (weight - 150) / 550;

    for (let strand = 0; strand < amount; strand++) {
      const angle = .62 + 5.04 * rand(strand + 1);
      const start = .12 + rand(strand + 705) * 1.42;
      const depth = rand(strand + 1600);
      const end = 2.18 + (rand(strand + 2371) - .5) * 2.3;
      const phase = angle * 1.7 + depth * 2.2;
      const tone = color.clone().multiplyScalar(.51 + depth * 1.07 + rand(strand + 864) * .37);
      const warm = new T.Color(shade.highlight);
      tone.lerp(warm, rand(strand + 909) ** 3 * .49);
      let previous;
      const offset = positions.length / 3;

      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const scalp = Math.min(1, t / .29);
        const phi = start + (2.03 - start) * scalp;
        const theta = angle + (end - angle) * Math.pow(t, .84) * .66;
        const free = Math.max(0, (t - .275) / .725);
        const curl = wave * Math.pow(free, .83);
        const swing = Math.sin(phase + free * frequency);
        const spread = (.53 + free * (.12 + depth * .21)) * bulk;
        const x = spread * Math.sin(theta) * Math.sin(phi) + curl * swing;
        const y = 2.41 + .68 * Math.cos(phi) - drop * Math.pow(free, .95) * (.79 + .22 * depth);
        const z = .037 + (.528 + depth * .118 + free * .223) * Math.cos(theta) * Math.sin(phi) + curl * .77 * Math.cos(phase + free * frequency);
        const temp = [x, y, z];
        const ribbon = (.006 + depth * .007) * (1 - .85 * Math.pow(t, 6));
        positions.push(x - ribbon, y, z, x + ribbon, y, z + ribbon * .23);
        const luster = 1 + .26 * Math.sin(phi * 3.6 + free * 9 + depth);
        colors.push(tone.r * luster, tone.g * luster, tone.b * luster, tone.r * luster * .8, tone.g * luster * .8, tone.b * luster * .8);
        if (previous) {
          const index = offset + step * 2;
          indices.push(index - 2, index - 1, index, index - 1, index + 1, index);
          if (strand % 2 === 0) {
            detailPoints.push(...previous, ...temp);
            detailColors.push(tone.r * 1.44, tone.g * 1.44, tone.b * 1.44, tone.r, tone.g, tone.b);
          }
        }
        previous = temp;
      }
    }
    strands.geometry.dispose();
    detail.geometry.dispose();
    strands.geometry = geometry(positions, colors, indices);
    detail.geometry = geometry(detailPoints, detailColors);
  }

  let desired = neutralAngle, angle = neutralAngle, frame = 0, drag = null;
  let visible = false;
  function paint() {
    frame = 0;
    angle += (desired - angle) * (reducedMotion.matches || drag ? 1 : .2);
    sculpture.rotation.y = angle;
    renderer.render(scene, camera);
    if (Math.abs(desired - angle) > .002) schedule();
  }
  function schedule() {
    if (visible && !frame) frame = requestAnimationFrame(paint);
  }
  function resize() {
    const { clientWidth: width, clientHeight: height } = view;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.position.set(0, 1.63, camera.aspect < 1 ? 7.3 : 6.8);
    camera.lookAt(0, 1.6, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    schedule();
  }

  new ResizeObserver(resize).observe(view);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  }).observe(view);
  resize();

  buttons[0].addEventListener('click', () => { desired -= Math.PI / 5; schedule(); });
  buttons[1].addEventListener('click', () => {
    desired = neutralAngle + Math.round((angle - neutralAngle) / (Math.PI * 2)) * Math.PI * 2;
    schedule();
  });
  buttons[2].addEventListener('click', () => { desired += Math.PI / 5; schedule(); });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    drag = { id: event.pointerId, x: event.clientX, angle: desired };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    desired = drag.angle + (event.clientX - drag.x) * .012;
    schedule();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => { if (drag?.id === event.pointerId) drag = null; });
  }
  let pending = 0;
  update = options => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => { buildHair(options); schedule(); });
  };
})();