import * as THREE from 'three';
import { GLTFLoader } from './assets/three/GLTFLoader.js';

const radians = Math.PI / 180;
const stageCenter = new THREE.Vector3(-.006, 1.112, .027);
const orbit = new THREE.Vector3();
const aim = new THREE.Vector3();

function studioLighting(scene) {
  scene.add(new THREE.HemisphereLight(0xfff0e2, 0x9b839f, 1.15));

  const key = new THREE.DirectionalLight(0xfff0e4, 2.15);
  key.position.set(-2.2, 3.7, 4.3);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdacfea, 1.03);
  fill.position.set(3.2, 1.1, 2.2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffdeb9, 2.55);
  rim.position.set(1.6, 2.7, -3.1);
  scene.add(rim);

  const shoulder = new THREE.DirectionalLight(0xe5d9ff, .62);
  shoulder.position.set(-2.2, .7, -1.5);
  scene.add(shoulder);
}

function frontLocks(material) {
  const segments = 36;
  const ribbons = 6;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ribbons * (segments + 1) * 2 * 3);
  const uvs = [];
  const indices = [];
  for (let ribbon = 0; ribbon < ribbons; ribbon++) {
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const start = ribbon * (segments + 1) * 2 + i * 2;
      const u = .085 + (ribbon % 3) * .032;
      uvs.push(u, .12 + t * .82, u + .08, .12 + t * .82);
      if (i) indices.push(start - 2, start - 1, start, start - 1, start + 1, start);
    }
  }
  const position = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const locks = new THREE.Mesh(geometry, material);
  locks.frustumCulled = false;
  locks.name = 'Face-framing locks over shoulders';

  return {
    mesh: locks,
    style(length, bend, frequency) {
      const ends = { 50: .975, 60: .889, 70: .811 };
      for (let ribbon = 0; ribbon < ribbons; ribbon++) {
        const side = ribbon < 3 ? -1 : 1;
        const layer = ribbon % 3 - 1;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const index = ribbon * (segments + 1) * 2 + i * 2;
          const sweep = THREE.MathUtils.smoothstep(t, .07, .54);
          const phase = t * frequency + (side === 1 ? .85 : .16) + layer * .18;
          const ripple = bend * sweep * Math.sin(phase) * .75;
          const width = (.004 + .019 * Math.pow(Math.sin(Math.PI * t), .52)) * (1 - .9 * Math.pow(t, 6));
          const x = -.006 + side * (.052 + .043 * sweep + ripple) + layer * .008 * sweep;
          const y = THREE.MathUtils.lerp(1.38, ends[length] + layer * .024 + (side === 1 ? .022 : 0), t);
          const z = .083 + .056 * sweep - .025 * t + layer * .006 + bend * sweep * Math.cos(phase) * .57;
          position.setXYZ(index, x - width, y, z - width * .27);
          position.setXYZ(index + 1, x + width, y, z + width * .27);
        }
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
    },
  };
}


function groom(mesh) {
  const geo = mesh.geometry;
  const position = geo.getAttribute('position');
  const originals = position.array.slice();
  position.setUsage(THREE.DynamicDrawUsage);
  const texture = mesh.material.map;
  const hairMaterial = new THREE.MeshPhysicalMaterial({
    map: texture,
    side: THREE.DoubleSide,
    roughness: .48,
    metalness: 0,
    alphaTest: .30,
    alphaToCoverage: true,
    specularIntensity: .34,
    sheen: .23,
    sheenRoughness: .78,
    sheenColor: new THREE.Color(0xbf8c6b),
  });
  mesh.material.dispose();
  mesh.material = hairMaterial;
  mesh.name = 'Fitted long hair';
  const front = frontLocks(hairMaterial);
  mesh.parent.add(front.mesh);
  mesh.frustumCulled = false;
  let previousShape;

  return ({ length, texture: style, shade }) => {
    const pigment = new THREE.Color(shade.color);
    const brightness = .2126 * pigment.r + .7152 * pigment.g + .0722 * pigment.b;
    const gain = THREE.MathUtils.lerp(1.72, 1.20, THREE.MathUtils.smoothstep(brightness, .075, .4));
    hairMaterial.color.copy(pigment).multiplyScalar(gain);
    hairMaterial.sheenColor.set(shade.color).lerp(new THREE.Color(0xffe2c6), .16);
    const shape = length + '/' + style;
    if (shape === previousShape) return;
    previousShape = shape;

    const lengthFactor = { 50: .88, 60: 1.05, 70: 1.23 }[length];
    const bend = { straight: 0, wave: .015, curl: .022 }[style];
    const frequency = style === 'curl' ? 26 : 15;
    front.style(length, bend, frequency);
    for (let i = 0; i < position.count; i++) {
      const px = originals[i * 3];
      const py = originals[i * 3 + 1];
      const pz = originals[i * 3 + 2];
      const fall = Math.max(0, 1.273 - py);
      const strand = Math.min(1, fall / .435);
      const flow = THREE.MathUtils.smoothstep(strand, 0, .28);
      const phase = frequency * strand + px * 6 + pz * 6;
      const side = Math.tanh((px + .006) * 47);
      const dx = side * bend * flow * Math.sin(phase);
      const dz = bend * flow * Math.cos(phase) * .78;
      const xx = px + dx;
      const yy = py - fall * (lengthFactor - 1) + bend * flow * Math.sin(phase) * .11;
      const back = 1 - THREE.MathUtils.smoothstep(pz, -.02, .046);
      const overShirt = THREE.MathUtils.smoothstep(1.246 - py, .01, .12);
      const overScalp = THREE.MathUtils.smoothstep(py, 1.24, 1.32);
      const zz = pz + dz * (1 - .28 * overShirt) - back * (.045 * overShirt + .013 * overScalp);
      position.setXYZ(i, xx, yy, zz);
    }
    position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };
}

export async function createStudio(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: 'low-power',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .96;
  renderer.setClearColor(0, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(29, 1, .035, 8);
  studioLighting(scene);

  const loader = new GLTFLoader();
  const portraitUrl = new URL('./assets/model/portrait.glb', import.meta.url);
  const hairUrl = new URL('./assets/model/hair.glb', import.meta.url);
  let portrait, hairFile;
  try {
    [portrait, hairFile] = await Promise.all([
      loader.loadAsync(portraitUrl.href),
      loader.loadAsync(hairUrl.href),
    ]);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  portrait.scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.name.includes('eyebrow')) {
      mesh.position.z += .0031;
      mesh.material.color.set('#655041');
      mesh.material.alphaTest = .18;
    }
  });
  scene.add(portrait.scene);
  scene.add(hairFile.scene);
  let setHair;
  hairFile.scene.traverse(mesh => { if (mesh.isMesh) setHair = groom(mesh); });
  if (!setHair) throw Error('Hair geometry unavailable');
  scene.updateMatrixWorld(true);

  let width = 0, height = 0, ratio = 0;
  let zoomedTarget = 1.30;
  return {
    setLook(options) {
      zoomedTarget = options.length === 70 ? 1.245 : 1.30;
      setHair(options);
    },
    render({ yaw, pitch, zoom, panX, panY }) {
      const nextWidth = canvas.clientWidth;
      const nextHeight = canvas.clientHeight;
      if (!nextWidth || !nextHeight) return;
      const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
      if (width !== nextWidth || height !== nextHeight || ratio !== nextRatio) {
        width = nextWidth;
        height = nextHeight;
        ratio = nextRatio;
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
      }
      const close = THREE.MathUtils.clamp((zoom - 1) / 2, 0, 1);
      const distance = 1.42 / zoom * Math.max(1, .86 / camera.aspect);
      const azimuth = yaw * radians;
      const elevation = pitch * radians;
      const level = Math.cos(elevation);
      aim.copy(stageCenter);
      aim.y = THREE.MathUtils.lerp(aim.y, zoomedTarget, close);
      orbit.set(Math.sin(azimuth) * level, Math.sin(elevation), Math.cos(azimuth) * level);
      camera.position.copy(aim).addScaledVector(orbit, distance);
      camera.lookAt(aim);
      camera.setViewOffset(width, height, -panX * width / 2, panY * height / 2, width, height);
      renderer.render(scene, camera);
    },
  };
}
