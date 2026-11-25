import * as THREE from 'three';

const pointCount = 468;
const fittedEyePosition = new THREE.Vector3(-.006, 1.305, .100);

export function createFaceHairScene(hair, triangles) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  camera.position.z = 2000;
  const rig = new THREE.Group();
  scene.add(rig);
  hair.position.copy(fittedEyePosition).negate();
  rig.add(hair);

  const blockerMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
  const blockerGeometry = new THREE.BufferGeometry();
  const faceBuffer = new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3).setUsage(THREE.DynamicDrawUsage);
  blockerGeometry.setAttribute('position', faceBuffer);
  blockerGeometry.setIndex(triangles);
  const blocker = new THREE.Mesh(blockerGeometry, blockerMaterial);
  blocker.frustumCulled = false;
  blocker.renderOrder = -2;
  scene.add(blocker);
  const upperBodyBlocker = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), blockerMaterial);
  upperBodyBlocker.position.set(0, -.28, -.095);
  upperBodyBlocker.scale.set(.172, .185, .091);
  upperBodyBlocker.renderOrder = -3;
  rig.add(upperBodyBlocker);

  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const target = new THREE.Vector3();
  const travel = new THREE.Vector3();
  const point = new THREE.Vector3();
  const other = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const pose = new THREE.Quaternion();
  let present = false;

  function place(points, videoWidth, videoHeight, rendererWidth, rendererHeight) {
    if (!points || points.length < pointCount * 3 || !videoWidth || !videoHeight) {
      present = false;
      rig.visible = blocker.visible = false;
      return false;
    }
    const cover = Math.max(rendererWidth / videoWidth, rendererHeight / videoHeight);
    camera.left = -rendererWidth / (2 * cover);
    camera.right = -camera.left;
    camera.top = rendererHeight / (2 * cover);
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();

    function read(index, vector) {
      const cursor = index * 3;
      return vector.set(
        (points[cursor] - .5) * videoWidth,
        (.5 - points[cursor + 1]) * videoHeight,
        -points[cursor + 2] * videoWidth,
      );
    }
    read(454, right).sub(read(234, other));
    read(10, up).sub(read(152, other));
    const across = right.length(), height = up.length();
    right.normalize();
    up.normalize();
    forward.crossVectors(right, up).normalize();
    if (forward.z < .25 || across < 30 || height < 30) {
      present = false;
      rig.visible = blocker.visible = false;
      return false;
    }
    up.crossVectors(forward, right).normalize();
    pose.setFromRotationMatrix(basis.makeBasis(right, up, forward));
    read(33, target).add(read(263, other)).multiplyScalar(.5);
    const eyeDepth = target.z;
    target.z = 0;
    const size = THREE.MathUtils.lerp(across / .143, height / .149, .62);
    const factor = present ? .43 : 1;
    rig.position.lerp(target, factor);
    rig.quaternion.slerp(pose, factor);
    rig.scale.setScalar(THREE.MathUtils.lerp(rig.scale.x, size, factor));
    travel.copy(rig.position).sub(target);
    for (let i = 0; i < pointCount; i++) {
      read(i, point).add(travel);
      faceBuffer.setXYZ(i, point.x, point.y, point.z - eyeDepth + 1.1);
    }
    faceBuffer.needsUpdate = true;
    blocker.visible = triangles.length > 0;
    rig.visible = true;
    present = true;
    return true;
  }

  return {
    scene,
    camera,
    place,
    dispose() {
      hair.position.set(0, 0, 0);
      rig.remove(hair);
      blockerGeometry.dispose();
      upperBodyBlocker.geometry.dispose();
      blockerMaterial.dispose();
    },
  };
}
