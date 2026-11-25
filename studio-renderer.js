(() => {
  const fullTurn = 360;
  const radians = Math.PI / 180;
  const views = [
    { column: 0, name: 'Анфас' },
    { column: 1, name: 'Правый профиль' },
    { column: 2, name: 'Со спины' },
    { column: 1, mirror: true, name: 'Левый профиль' },
  ];
  const viewAt = index => views[(index % views.length + views.length) % views.length];
  const normalYaw = yaw => (yaw % fullTurn + fullTurn) % fullTurn;
  const activeView = yaw => viewAt(Math.round(normalYaw(yaw) / 90));
  const nearest = yaw => Math.round(yaw / 90) * 90;

  function frame(sheet, view, row) {
    const width = Math.floor(sheet.naturalWidth / 3);
    const height = Math.floor(sheet.naturalHeight / 3);
    return [view.column * width + 1, row * height + 1, width - 2, height - 2];
  }

  function paintFlat(canvas) {
    const context = canvas.getContext('2d');
    if (!context) throw Error('Canvas unavailable');
    canvas.classList.add('flat-preview');
    let paintedImage, paintedView, paintedRow;
    return (sheet, { yaw, pitch, zoom, panX, panY }, row) => {
      const view = activeView(yaw);
      if (paintedImage !== sheet || paintedView !== view || paintedRow !== row) {
        const [x, y, width, height] = frame(sheet, view, row);
        canvas.width = width;
        canvas.height = height;
        context.save();
        if (view.mirror) {
          context.translate(width, 0);
          context.scale(-1, 1);
        }
        context.drawImage(sheet, x, y, width, height, 0, 0, width, height);
        context.restore();
        paintedImage = sheet;
        paintedView = view;
        paintedRow = row;
      }
      canvas.style.setProperty('--pitch', (-pitch * .66) + 'deg');
      canvas.style.setProperty('--relative-yaw', ((yaw - nearest(yaw)) * .4) + 'deg');
      canvas.style.setProperty('--zoom', zoom);
      canvas.style.setProperty('--pan-x', (panX * 50) + '%');
      canvas.style.setProperty('--pan-y', (-panY * 50) + '%');
    };
  }

  function createProgram(gl, vertex, fragment) {
    function shader(type, source) {
      const result = gl.createShader(type);
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(result));
      return result;
    }
    const program = gl.createProgram();
    const vertexShader = shader(gl.VERTEX_SHADER, vertex);
    const fragmentShader = shader(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    return program;
  }

  function photographRelief() {
    const vertices = [];
    const size = 44;
    for (let y = 0; y <= size; y++) {
      for (let x = 0; x <= size; x++) {
        const u = x / size * 2 - 1;
        const v = y / size * 2 - 1;
        const face = Math.exp(-((u / .33) ** 2 + ((v - .58) / .37) ** 2));
        const hair = Math.exp(-((u / .49) ** 2 + ((v - .32) / .65) ** 2));
        const body = Math.exp(-((u / .64) ** 2 + ((v + .37) / .73) ** 2));
        vertices.push(u, v, .19 * face + .12 * hair + .1 * body);
      }
    }
    const indices = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const a = y * (size + 1) + x;
        const c = a + size + 1;
        indices.push(a, a + 1, c, a + 1, c + 1, c);
      }
    }
    return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
  }

  function paintVolume(canvas, gl) {
    const vertex = [
      'attribute vec3 aVertex;',
      'uniform vec2 uRotation;',
      'uniform vec2 uFit;',
      'uniform vec2 uPan;',
      'uniform float uZoom;',
      'varying vec2 vLocal;',
      'void main() {',
      '  vLocal = aVertex.xy * 0.5 + 0.5;',
      '  vec3 p = aVertex;',
      '  p.y -= 0.20;',
      '  float cy = cos(uRotation.x), sy = sin(uRotation.x);',
      '  p = vec3(cy * p.x + sy * p.z, p.y, cy * p.z - sy * p.x);',
      '  float cx = cos(uRotation.y), sx = sin(uRotation.y);',
      '  p = vec3(p.x, cx * p.y - sx * p.z + 0.20, sx * p.y + cx * p.z);',
      '  vec2 position = p.xy * uZoom;',
      '  position.y -= 0.44 * (uZoom - 1.0);',
      '  float w = 1.0 - p.z * 0.31;',
      '  gl_Position = vec4(position * uFit + uPan * w, 0.0, w);',
      '}',
    ].join('\n');
    const fragment = [
      'precision mediump float;',
      'uniform sampler2D uSheet;',
      'uniform vec4 uFrame;',
      'uniform float uMirror;',
      'uniform float uAlpha;',
      'varying vec2 vLocal;',
      'void main() {',
      '  vec2 uv = vec2(mix(vLocal.x, 1.0 - vLocal.x, uMirror), vLocal.y);',
      '  vec3 color = texture2D(uSheet, uFrame.xy + uv * uFrame.zw).rgb;',
      '  float side = smoothstep(0.0, 0.085, vLocal.x) * smoothstep(0.0, 0.085, 1.0 - vLocal.x);',
      '  gl_FragColor = vec4(color, side * uAlpha);',
      '}',
    ].join('\n');
    const program = createProgram(gl, vertex, fragment);
    const { vertices, indices } = photographRelief();
    const location = name => gl.getUniformLocation(program, name);
    const fit = location('uFit'), rotation = location('uRotation'), zoom = location('uZoom'), pan = location('uPan');
    const crop = location('uFrame'), mirror = location('uMirror'), alpha = location('uAlpha');
    const vertexPosition = gl.getAttribLocation(program, 'aVertex');
    const vertexBuffer = gl.createBuffer(), indexBuffer = gl.createBuffer(), texture = gl.createTexture();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexPosition);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let sampledSheet, displayedAngle, previousAngle, angleChangedAt = 0;

    return (sheet, camera, row) => {
      if (sampledSheet !== sheet) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
        sampledSheet = sheet;
        previousAngle = undefined;
        displayedAngle = undefined;
      }
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const mediaAspect = sheet.naturalWidth / sheet.naturalHeight;
      const aspect = width / height;
      gl.uniform2f(fit, Math.min(1, mediaAspect / aspect) * .985, Math.min(1, aspect / mediaAspect) * .975);
      gl.uniform1f(zoom, camera.zoom);
      gl.uniform2f(pan, camera.panX, camera.panY);

      const yaw = normalYaw(camera.yaw);
      const target = Math.round(yaw / 90) % views.length;
      const now = performance.now();
      if (target !== displayedAngle) {
        previousAngle = displayedAngle;
        displayedAngle = target;
        angleChangedAt = now;
      }
      const fraction = Math.min(1, (now - angleChangedAt) / 115);
      const crossFade = previousAngle !== undefined && fraction < 1 && !motion.matches;
      if (crossFade) draw(previousAngle, 1);
      draw(displayedAngle, crossFade ? fraction : 1);
      return crossFade;
      function draw(index, opacity) {
        const view = viewAt(index);
        const [x, y, w, h] = frame(sheet, view, row);
        gl.uniform4f(crop, x / sheet.naturalWidth, 1 - (y + h) / sheet.naturalHeight, w / sheet.naturalWidth, h / sheet.naturalHeight);
        gl.uniform1f(mirror, Number(Boolean(view.mirror)));
        gl.uniform1f(alpha, opacity);
        const offset = (yaw - index * 90 + 540) % 360 - 180;
        gl.uniform2f(rotation, Math.max(-50, Math.min(50, offset)) * radians * .52, camera.pitch * radians * .85);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      }
    };
  }

  window.hairStudioRenderer = {
    create(canvas, forceFlat = false) {
      if (forceFlat) return { render: paintFlat(canvas), mode: 'flat' };
      try {
        const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
        if (gl) return { render: paintVolume(canvas, gl), mode: 'volume' };
      } catch {
        // A fresh canvas can provide the 2D context if WebGL setup failed.
        const replacement = canvas.cloneNode();
        canvas.replaceWith(replacement);
        canvas = replacement;
      }
      return { render: paintFlat(canvas), mode: 'flat' };
    },
    activeView,
  };
})();
