import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { DosMachine } from './dos.js';
import { RetroAudio } from './audio.js';

// Bundled OFL terminal face; no external font request is needed while playing.
const terminalFont = new FontFace('VT323', 'url(/assets/fonts/VT323-Regular.ttf)');
terminalFont.load().then(font => document.fonts.add(font)).catch(() => {});

const $ = (selector) => document.querySelector(selector);
const el = {
  canvas: $('#scene'), intro: $('#intro'), begin: $('#begin'), loading: $('#loading'),
  loadingTitle: $('#loading-title'), loadingDetail: $('#loading-detail'), loadingProgress: $('#loading-progress'),
  taskText: $('#task-text'), taskNumber: $('#task-number'), taskProgress: $('#task-progress'),
  objective: $('#objective'), controls: $('#controls'), focusNotice: $('#focus-notice'),
  pcPower: $('#pc-power'), monitorPower: $('#monitor-power'), diskToggle: $('#disk-toggle'),
  screenFocus: $('#screen-focus'), returnDesk: $('#return-desk'), help: $('#help-panel'),
  helpToggle: $('#help-toggle'), soundToggle: $('#sound-toggle'), lampToggle: $('#lamp-toggle'),
  hoverLabel: $('#hover-label'), notification: $('#notification'),
  secretNote: $('#secret-note'), secretNoteClose: $('#secret-note-close'),
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {
  loaded: false, started: false, pcOn: false, monitorOn: false, diskInserted: false,
  diskMoving: false, screenFocused: false, lampOn: true, sound: true, driveActive: false,
  task: 0, milestones: new Set(), pointerDown: null, hover: null,
};
const audio = new RetroAudio();
let toastTimer, driveTimer, cameraTransition, diskAnimation, model, screenMesh, diskObject;
let diskRest, diskRestQuaternion, diskInsertPosition, diskInsertQuaternion, lampBulb, monitorLED, powerLED, driveLED;

function notify(message, duration = 3400) {
  if (!message) return;
  el.notification.textContent = message;
  el.notification.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.notification.classList.remove('is-visible'), duration);
}

function pulseDrive(duration = 450) {
  state.driveActive = true;
  clearTimeout(driveTimer);
  driveTimer = setTimeout(() => { state.driveActive = false; }, duration);
}

function updateObjective() {
  const milestones = state.milestones;
  const machine = dos.state;
  let number = 0;
  let text = 'Power on the PC and monitor.';
  if (!state.pcOn) {
    if (milestones.has('score-saved') && !state.diskInserted) { number = 6; text = 'Done.'; }
    else if (milestones.has('score-saved')) { number = 5; text = 'Remove the disk.'; }
  } else if (!state.monitorOn) {
    text = 'Turn on the monitor.';
  } else if (machine.bootBlocked) {
    number = 1;
    text = state.diskInserted ? 'Remove the data disk.' : 'Press any key to continue.';
  } else if (machine.mode === 'boot') {
    number = 1; text = 'Starting DOS.';
  } else if (machine.mode === 'game') {
    number = 4;
    text = machine.game?.phase === 'title' ? 'Press Enter to play.' : 'Playing.';
    if (machine.game?.phase === 'name') text = 'Enter your initials.';
    if (machine.game?.phase === 'result') { number = 5; text = 'Score saved.'; }
  } else if (milestones.has('score-saved')) {
    number = 5; text = 'Score saved.';
  } else if (!state.diskInserted) {
    number = 1; text = 'Insert the disk.';
  } else if (milestones.has('disk-listed')) {
    number = 3; text = 'Run STAR.';
  } else {
    number = 2; text = 'Explore the disk.';
  }
  state.task = number;
  el.taskText.textContent = text;
  el.taskNumber.textContent = `${String(Math.min(number + 1, 6)).padStart(2, '0')} / 06`;
  el.taskProgress.style.width = `${Math.min((number + 1) / 6, 1) * 100}%`;
}

const dos = new DosMachine({
  onChange(machine) {
    updateObjective();
    audio.setGameMusic(machine.mode === 'game' && machine.game?.phase === 'playing' && !document.hidden);
  },
  onEvent(event) {
    if (event.type === 'sound') {
      audio.play(event.sound);
      if (event.sound === 'disk') pulseDrive(440);
    } else if (event.type === 'milestone') {
      state.milestones.add(event.id);
      updateObjective();
    } else if (event.type === 'hint') {
      // The note and DOS itself carry the instructions. Surface only errors
      // whose consequence would otherwise be unclear outside the CRT.
      if (/本地存储|持久存储/.test(event.text)) notify('Storage unavailable. Scores last until this page closes.', 5000);
      else if (/软驱里没有盘/.test(event.text)) notify('No disk. Insert it, then press R to retry.', 4500);
      else if (/成绩需要写回/.test(event.text)) notify('Insert the game disk, then Enter to save.', 4500);
    }
    else if (event.type === 'score-saved') {
      if (event.drive === 'A') pulseDrive(800);
    }
  },
});

const renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.10;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#080d16');
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.025, 18);
const desktopView = {
  position: new THREE.Vector3(.74, 1.38, 1.53),
  target: new THREE.Vector3(-.015, .995, .045),
};
const introView = {
  position: new THREE.Vector3(.98, 1.52, 2.36),
  target: new THREE.Vector3(.01, 1.18, -.04),
};
camera.position.copy(introView.position);
const controls = new OrbitControls(camera, el.canvas);
controls.target.copy(introView.target);
controls.enableDamping = true;
controls.dampingFactor = .07;
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = .60;
controls.maxDistance = 2.50;
controls.minPolarAngle = Math.PI * .21;
controls.maxPolarAngle = Math.PI * .48;
controls.minAzimuthAngle = -.66;
controls.maxAzimuthAngle = .79;
controls.rotateSpeed = .42;
controls.zoomSpeed = .55;
controls.update();

// Small-scale occlusion makes key gaps, molded seams and contact with the desk legible.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ambientOcclusion = new GTAOPass(scene, camera, innerWidth, innerHeight);
ambientOcclusion.updateGtaoMaterial({ radius: .09, distanceExponent: 1.4, thickness: .035, samples: 12 });
ambientOcclusion.updatePdMaterial({ lumaPhi: 6, depthPhi: 2, normalPhi: 3, radius: 5, samples: 8 });
ambientOcclusion.blendIntensity = .7;
composer.addPass(ambientOcclusion);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .20, .40, 1.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass());

const pmrem = new THREE.PMREMGenerator(renderer);
const temporaryEnvironment = pmrem.fromScene(new RoomEnvironment(), .04);
scene.environment = temporaryEnvironment.texture;
scene.environmentIntensity = .10;
pmrem.dispose();

RectAreaLightUniformsLib.init();
// Entirely interior lighting: soft ceiling bounce, desk lamp, lava lamp and shelf light.
const ceiling = new THREE.SpotLight('#ffe1b2', 1.35, 5, 1.02, 1, 2);
ceiling.position.set(-.45, 2.35, 1.05);
ceiling.target.position.set(-.1, .75, -.05);
ceiling.castShadow = true;
ceiling.shadow.mapSize.set(2048, 2048);
ceiling.shadow.bias = -.00008;
ceiling.shadow.normalBias = .002;
ceiling.shadow.radius = 8;
ceiling.shadow.blurSamples = 12;
scene.add(ceiling, ceiling.target);
const interiorFill = new THREE.RectAreaLight('#c1cce4', .55, 1.4, 1.2);
interiorFill.position.set(.35, 1.65, 1.1);
interiorFill.lookAt(0, 1, -.1);
scene.add(interiorFill);
const roomBounce = new THREE.HemisphereLight('#7b94c4', '#4b342c', .12);
scene.add(roomBounce);
const deskLamp = new THREE.SpotLight('#ffcf8d', 2.6, 2.2, .92, .85, 2);
deskLamp.position.set(.59, 1.25, .05);
deskLamp.target.position.set(.46, .76, .22);
deskLamp.castShadow = true;
deskLamp.shadow.mapSize.set(1024, 1024);
deskLamp.shadow.bias = -.0002;
deskLamp.shadow.normalBias = .002;
deskLamp.shadow.radius = 4;
deskLamp.shadow.blurSamples = 8;
scene.add(deskLamp, deskLamp.target);
const lampBounce = new THREE.PointLight('#ffc477', .16, 1.5, 2);
lampBounce.position.copy(deskLamp.position);
scene.add(lampBounce);
const lavaLight = new THREE.PointLight('#ff702e', .28, 2.1, 2);
lavaLight.position.set(-1.015, .89, -.25);
scene.add(lavaLight);
const shelfLight = new THREE.PointLight('#719bf6', .18, 1.6, 2);
shelfLight.position.set(1.16, 1.09, -.23);
scene.add(shelfLight);
const lavaBlobs = [];
const screenGlow = new THREE.RectAreaLight('#bcd5eb', 0, .25, .18);
screenGlow.position.set(0, 1.16, .25);
screenGlow.lookAt(0, .81, .70);
scene.add(screenGlow);
const screenBounce = new THREE.PointLight('#b7cbe6', 0, 1.2, 2);
screenBounce.position.set(0, 1.12, .29);
scene.add(screenBounce);

const screenCanvas = document.createElement('canvas');
screenCanvas.width = 1024;
screenCanvas.height = 768;
const screenContext = screenCanvas.getContext('2d', { alpha: false });
const screenTexture = new THREE.CanvasTexture(screenCanvas);
screenTexture.colorSpace = THREE.SRGBColorSpace;
screenTexture.flipY = false;
screenTexture.minFilter = THREE.LinearFilter;
screenTexture.magFilter = THREE.LinearFilter;
screenTexture.generateMipmaps = false;
const screenMaterial = new THREE.MeshPhysicalMaterial({
  color: '#b9c5cb', map: screenTexture, emissive: '#ffffff', emissiveMap: screenTexture,
  emissiveIntensity: .88, roughness: .48, metalness: .0, clearcoat: 0,
  specularIntensity: .015, envMapIntensity: .12,
});
const screenOffMaterial = new THREE.MeshPhysicalMaterial({
  color: '#101914', metalness: .03, roughness: .18, clearcoat: 1,
  clearcoatRoughness: .09, envMapIntensity: .46,
});

const interactive = [];
const screenCenter = new THREE.Vector3(0, 1.155, .225);
const screenBox = new THREE.Box3();
const diskSlot = new THREE.Vector3(.145, .846, .223);

function findObject(name) {
  return model?.getObjectByName(name) || null;
}

function setLED(object, enabled, color = '#b9e572') {
  if (!object) return;
  object.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material.emissive) return;
      material.emissive.set(color);
      material.emissiveIntensity = enabled ? 2 : 0;
      if (material.color) material.color.set(enabled ? color : '#243420');
    });
  });
}

function addInteraction(object, label, action) {
  if (!object) return;
  object.traverse((child) => {
    if (child.isMesh) {
      child.userData.interaction = { label, action };
      interactive.push(child);
    }
  });
}

function createPickTarget(name, center, size, label, action) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  box.name = name;
  box.position.copy(center);
  box.userData.pickOnly = true;
  box.visible = false; // Raycaster can pick hidden proxies; they must not enter the AO depth pass.
  box.userData.interaction = { label, action };
  scene.add(box);
  interactive.push(box);
}

function setupModel(gltf) {
  model = gltf.scene;
  model.name = '1994_DeskScene';
  scene.add(model);
  const finishedMaterials = new Set();
  model.traverse((object) => {
    if (!object.isMesh) return;
    if (object.name.startsWith('Lava_Blob')) lavaBlobs.push({object, base: object.position.y, phase: lavaBlobs.length * 1.7});
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material.name?.startsWith('ABS_Ivory') && !finishedMaterials.has(material)) {
        // Submillimetre variations in molded ABS roughness, without painted dirt.
        material.roughness = .58;
        material.onBeforeCompile = shader => {
          shader.vertexShader = 'varying vec3 vMoldPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMoldPosition = position;');
          shader.fragmentShader = 'varying vec3 vMoldPosition;\n' + shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            float moldGrain = fract(sin(dot(floor(vMoldPosition * 1800.0), vec3(12.9898,78.233,37.719))) * 43758.5453);
            roughnessFactor = clamp(roughnessFactor + (moldGrain - .5) * .055, .0, 1.0);`);
        };
        material.customProgramCacheKey = () => 'molded-abs-v1';
        finishedMaterials.add(material);
      }
      if (material.map) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (material.normalMap) material.normalMap.anisotropy = 4;
      if (material.name?.toLowerCase().includes('glass')) {
        object.castShadow = false;
        material.envMapIntensity = .5;
        if (material.name.startsWith('Lava_Glass')) {
          material.transmission = .82;
          material.thickness = .07;
          material.roughness = .12;
          material.attenuationColor.set('#ffbe74');
          material.attenuationDistance = .12;
        }
      }
    });
  });
  const textureLoader = new THREE.TextureLoader();
  const woodColor = textureLoader.load('/assets/textures/dark_wood_diff_2k.jpg');
  const woodRoughness = textureLoader.load('/assets/textures/dark_wood_rough_2k.jpg');
  const woodNormal = textureLoader.load('/assets/textures/dark_wood_nor_gl_2k.jpg');
  woodColor.colorSpace = THREE.SRGBColorSpace;
  [woodColor, woodRoughness, woodNormal].forEach((texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.flipY = false;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  });
  const woodMaterial = new THREE.MeshPhysicalMaterial({
    name: 'Wood_Physical', color: '#c3c3bf', map: woodColor, roughnessMap: woodRoughness,
    normalMap: woodNormal, normalScale: new THREE.Vector2(.16, .16), roughness: .92,
    metalness: 0, clearcoat: .04, clearcoatRoughness: .32, envMapIntensity: .65,
  });
  model.traverse((object) => {
    if (object.isMesh && /^Wood_export(?:\.\d+)?$/.test(object.material?.name || '')) object.material = woodMaterial;
  });
  screenMesh = findObject('Screen_Surface');
  if (!screenMesh) throw new Error('Required model object Screen_Surface was not found.');
  screenMesh.material = screenOffMaterial;
  screenMesh.castShadow = false;
  screenMesh.receiveShadow = false;
  screenBox.setFromObject(screenMesh);
  screenBox.getCenter(screenCenter);
  screenGlow.position.copy(screenCenter).add(new THREE.Vector3(0, 0, .028));
  screenGlow.lookAt(screenCenter.x, .81, screenCenter.z + .60);
  screenBounce.position.copy(screenCenter).add(new THREE.Vector3(0, -.012, .072));

  diskObject = findObject('Floppy_Disk');
  if (!diskObject) throw new Error('Required model object Floppy_Disk was not found.');
  diskRest = diskObject.position.clone();
  diskRestQuaternion = diskObject.quaternion.clone();
  const insertTarget = findObject('Floppy_Insert_Target');
  diskInsertPosition = insertTarget ? insertTarget.getWorldPosition(new THREE.Vector3()) : diskSlot.clone();
  diskInsertQuaternion = insertTarget ? insertTarget.getWorldQuaternion(new THREE.Quaternion()) : diskRestQuaternion.clone();
  diskObject.parent.worldToLocal(diskInsertPosition);
  if (insertTarget) diskInsertQuaternion.premultiply(diskObject.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  const slotObject = findObject('Drive_Slot') || findObject('Floppy_Slot');
  if (slotObject) new THREE.Box3().setFromObject(slotObject).getCenter(diskSlot);
  lampBulb = findObject('DeskLamp_Bulb');
  if (lampBulb) {
    new THREE.Box3().setFromObject(lampBulb).getCenter(deskLamp.position);
    deskLamp.position.y -= .015;
    lampBounce.position.copy(deskLamp.position);
    deskLamp.target.position.set(deskLamp.position.x - .09, .752, deskLamp.position.z + .15);
  }
  powerLED = findObject('Power_LED');
  monitorLED = findObject('Monitor_LED');
  driveLED = findObject('Drive_LED');
  [powerLED, monitorLED, driveLED].filter(Boolean).forEach((object) => object.traverse((child) => {
    if (child.isMesh) child.material = child.material.clone();
  }));
  setLED(powerLED, false);
  setLED(monitorLED, false);
  setLED(driveLED, false);
  addInteraction(findObject('PC_Power_Button'), () => state.pcOn ? 'PC off' : 'PC on', togglePC);
  addInteraction(findObject('Monitor_Power_Button'), () => state.monitorOn ? 'Monitor off' : 'Monitor on', toggleMonitor);
  addInteraction(findObject('Drive_Eject_Button'), () => state.diskInserted ? 'Eject disk' : 'Insert disk', toggleDisk);
  addInteraction(diskObject, () => state.diskInserted ? 'Eject disk' : 'Insert disk', toggleDisk);
  addInteraction(screenMesh, 'Use computer', focusScreen);
  addInteraction(findObject('Lamp_Switch'), () => state.lampOn ? 'Lamp off' : 'Lamp on', toggleLamp);
  addInteraction(findObject('Command_Note'), 'Read note', () => toggleHelp(true));
  addInteraction(findObject('Secret_Note'), 'Read scribble', () => toggleSecretNote(true));
  addInteraction(findObject('DeskLamp_Shade') || findObject('DeskLamp_Base') || lampBulb, () => state.lampOn ? 'Lamp off' : 'Lamp on', toggleLamp);
  for (const [name, fallbackSize, label, action] of [
    ['PC_Power_Button', [.040, .032, .016], () => state.pcOn ? 'PC off' : 'PC on', togglePC],
    ['Monitor_Power_Button', [.027, .027, .016], () => state.monitorOn ? 'Monitor off' : 'Monitor on', toggleMonitor],
    ['Drive_Eject_Button', [.027, .025, .020], () => state.diskInserted ? 'Eject disk' : 'Insert disk', toggleDisk],
    ['Lamp_Switch', [.032, .025, .032], () => state.lampOn ? 'Lamp off' : 'Lamp on', toggleLamp],
  ]) {
    const object = findObject(name);
    if (object) {
      const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
      center.z += .005;
      createPickTarget(`${name}_HitArea`, center, fallbackSize, label, action);
    }
  }
  state.loaded = true;
  el.begin.disabled = false;
  el.loadingProgress.style.width = '100%';
  setTimeout(() => el.loading.classList.add('is-complete'), 250);
  window.dispatchEvent(new CustomEvent('desk:ready'));
}

function loadModel() {
  const loader = new GLTFLoader();
  loader.load('/assets/desk-scene.glb', (gltf) => {
    try { setupModel(gltf); } catch (error) { loadError(error); }
  }, (event) => {
    const percent = event.total ? Math.min(95, Math.round(event.loaded / event.total * 95)) : 32;
    el.loadingProgress.style.width = `${percent}%`;
  }, loadError);
}
function loadError(error) {
  console.error('Scene load failed:', error);
  el.loadingTitle.textContent = 'Room unavailable';
  el.loadingDetail.textContent = 'Reload to try again.';
  $('#reload-scene').hidden = false;
}
$('#reload-scene').addEventListener('click', () => location.reload());
loadModel();

function animateCamera(position, target, duration = 1000) {
  controls.enabled = false;
  cameraTransition = {
    start: performance.now(), duration: reducedMotion ? 1 : duration,
    fromPosition: camera.position.clone(), toPosition: position.clone(),
    fromTarget: controls.target.clone(), toTarget: target.clone(),
  };
}

function beginExperience() {
  if (!state.loaded) return;
  audio.unlock();
  if (!state.started) {
    state.started = true;
    el.intro.classList.add('is-leaving');
    setTimeout(() => { el.intro.hidden = true; }, reducedMotion ? 1 : 650);
    el.objective.hidden = false;
    el.controls.hidden = false;
    animateCamera(desktopView.position, desktopView.target, 1200);
    updateObjective();
  }
}

function togglePC() {
  if (!state.loaded) return;
  beginExperience();
  state.pcOn = !state.pcOn;
  if (state.pcOn) {
    dos.powerOn();
  } else {
    dos.powerOff();
  }
  $('#pc-indicator').classList.toggle('is-on', state.pcOn);
  setLED(powerLED, state.pcOn);
  updateObjective();
}

function toggleMonitor() {
  if (!state.loaded) return;
  beginExperience();
  state.monitorOn = !state.monitorOn;
  if (!state.monitorOn) dos.releaseKeys();
  audio.play('power');
  $('#monitor-indicator').classList.toggle('is-on', state.monitorOn);
  screenMesh.material = state.monitorOn && state.pcOn ? screenMaterial : screenOffMaterial;
  setLED(monitorLED, state.monitorOn);
  updateObjective();
}

function toggleDisk() {
  if (!state.loaded || state.diskMoving) return;
  beginExperience();
  if (state.diskInserted && state.driveActive) {
    notify('Drive busy. Wait for the light to go out.');
    return;
  }
  const inserting = !state.diskInserted;
  state.diskMoving = true;
  // The disk is a named parent with all of its geometry. Animate that parent so
  // the shutter, label, and shell remain attached throughout the gesture.
  const finalPosition = diskInsertPosition.clone();
  const lifted = diskRest.clone().add(new THREE.Vector3(-.08, .105, -.03));
  const nearDrive = diskObject.parent.localToWorld(finalPosition.clone()).add(new THREE.Vector3(0, 0, .105));
  diskObject.parent.worldToLocal(nearDrive);
  diskAnimation = {
    start: performance.now(), duration: reducedMotion ? 1 : 1500, inserting,
    points: inserting ? [diskRest.clone(), lifted, nearDrive, finalPosition] : [finalPosition, nearDrive, lifted, diskRest.clone()],
    fromQuaternion: diskObject.quaternion.clone(),
    toQuaternion: inserting ? diskInsertQuaternion.clone() : diskRestQuaternion.clone(),
  };
  if (!inserting) {
    state.diskInserted = false;
    dos.setDisk(false);
  }
  audio.play('disk');
}

function focusScreen() {
  if (!state.loaded || state.screenFocused) return;
  beginExperience();
  state.screenFocused = true;
  document.body.classList.add('screen-active');
  el.screenFocus.hidden = true;
  el.returnDesk.hidden = false;
  el.focusNotice.hidden = false;
  const screenSize = screenBox.getSize(new THREE.Vector3());
  const fitHeightDistance = screenSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * .73);
  const fitWidthDistance = screenSize.x / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * .84);
  const distance = Math.max(fitHeightDistance, fitWidthDistance, .35);
  const focusPosition = screenCenter.clone().add(new THREE.Vector3(0, .002, distance));
  animateCamera(focusPosition, screenCenter, 950);
  el.canvas.focus({ preventScroll: true });
  el.hoverLabel.hidden = true;
  if (!state.pcOn || !state.monitorOn) notify('Turn on the PC and monitor to type.');
}

function returnToDesk() {
  if (!state.started) return;
  state.screenFocused = false;
  dos.releaseKeys();
  document.body.classList.remove('screen-active');
  el.screenFocus.hidden = false;
  el.returnDesk.hidden = true;
  el.focusNotice.hidden = true;
  animateCamera(desktopView.position, desktopView.target, 950);
  el.canvas.blur();
}

function toggleLamp() {
  audio.unlock();
  state.lampOn = !state.lampOn;
  deskLamp.visible = state.lampOn;
  lampBounce.visible = state.lampOn;
  el.lampToggle.setAttribute('aria-pressed', String(state.lampOn));
  el.lampToggle.setAttribute('aria-label', state.lampOn ? 'Turn lamp off' : 'Turn lamp on');
  el.lampToggle.title = state.lampOn ? 'Turn lamp off' : 'Turn lamp on';
  if (lampBulb) lampBulb.traverse((object) => {
    if (object.isMesh && object.material.emissive) object.material.emissiveIntensity = state.lampOn ? 2 : 0;
  });
  audio.play('key');
}

function toggleHelp(force) {
  const open = force ?? el.help.hidden;
  el.help.hidden = !open;
  if (open) el.secretNote.hidden = true;
  el.helpToggle.setAttribute('aria-expanded', String(open));
  if (open) { dos.releaseKeys(); $('#help-close').focus({ preventScroll: true }); }
  else if (state.screenFocused) el.canvas.focus({ preventScroll: true });
}

function toggleSecretNote(force) {
  const open = force ?? el.secretNote.hidden;
  el.secretNote.hidden = !open;
  if (open) {
    el.help.hidden = true;
    el.helpToggle.setAttribute('aria-expanded', 'false');
    el.hoverLabel.hidden = true;
    dos.releaseKeys();
    el.secretNoteClose.focus({ preventScroll: true });
  } else el.canvas.focus({ preventScroll: true });
}

el.begin.addEventListener('click', beginExperience);
el.pcPower.addEventListener('click', togglePC);
el.monitorPower.addEventListener('click', toggleMonitor);
el.diskToggle.addEventListener('click', toggleDisk);
el.screenFocus.addEventListener('click', focusScreen);
el.returnDesk.addEventListener('click', returnToDesk);
el.lampToggle.addEventListener('click', toggleLamp);
el.helpToggle.addEventListener('click', () => toggleHelp());
$('#help-close').addEventListener('click', () => toggleHelp(false));
el.secretNoteClose.addEventListener('click', () => toggleSecretNote(false));
$('#reset-view').addEventListener('click', () => {
  if (state.screenFocused) returnToDesk();
  else animateCamera(state.started ? desktopView.position : introView.position, state.started ? desktopView.target : introView.target);
});
$('.identity').addEventListener('click', (event) => { event.preventDefault(); $('#reset-view').click(); });
el.soundToggle.addEventListener('click', () => {
  audio.unlock();
  state.sound = !state.sound;
  audio.setEnabled(state.sound);
  el.soundToggle.setAttribute('aria-pressed', String(state.sound));
  el.soundToggle.setAttribute('aria-label', state.sound ? 'Mute sound' : 'Unmute sound');
  el.soundToggle.title = state.sound ? 'Mute sound' : 'Unmute sound';
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function hitAt(event) {
  const bounds = el.canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactive, false)[0];
  if (!hit) return null;
  // An interaction cannot be activated through the back of a monitor or case.
  const blockers = raycaster.intersectObject(model, true);
  const nearestBlocker = blockers.find((entry) => !entry.object.userData.pickOnly && entry.object.visible);
  if (nearestBlocker && nearestBlocker.distance + .028 < hit.distance) return null;
  return hit.object.userData.interaction;
}
el.canvas.addEventListener('pointermove', (event) => {
  if (!state.loaded || state.screenFocused || cameraTransition || state.pointerDown) {
    el.hoverLabel.hidden = true;
    return;
  }
  const interaction = hitAt(event);
  state.hover = interaction;
  el.canvas.style.cursor = interaction ? 'pointer' : 'grab';
  el.hoverLabel.hidden = !interaction;
  if (interaction) {
    el.hoverLabel.querySelector('p').textContent = typeof interaction.label === 'function' ? interaction.label() : interaction.label;
    el.hoverLabel.style.left = `${Math.min(event.clientX + 18, innerWidth - 185)}px`;
    el.hoverLabel.style.top = `${event.clientY + 19}px`;
  }
});
el.canvas.addEventListener('pointerdown', (event) => {
  audio.unlock();
  state.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
  el.canvas.style.cursor = state.screenFocused ? 'default' : 'grabbing';
});
el.canvas.addEventListener('pointerup', (event) => {
  const down = state.pointerDown;
  state.pointerDown = null;
  if (!down || !state.loaded) return;
  const click = Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6 && performance.now() - down.time < 500;
  if (click && !cameraTransition) {
    if (state.screenFocused) el.canvas.focus({ preventScroll: true });
    else hitAt(event)?.action();
  }
  el.canvas.style.cursor = state.screenFocused ? 'default' : 'grab';
});
el.canvas.addEventListener('pointerleave', () => { el.hoverLabel.hidden = true; state.pointerDown = null; });

function onKey(event) {
  if (event.type === 'keyup') { dos.handleKey(event); return; }
  if (!el.secretNote.hidden) {
    if (event.key === 'Escape') { toggleSecretNote(false); event.preventDefault(); }
    return;
  }
  if (!state.screenFocused || !state.pcOn || !state.monitorOn || !el.help.hidden) return;
  if (document.activeElement !== el.canvas && document.activeElement !== document.body) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Tab') return;
  const handled = dos.handleKey(event);
  if (handled) event.preventDefault();
}
window.addEventListener('keydown', onKey);
window.addEventListener('keyup', onKey);
window.addEventListener('blur', () => {
  dos.releaseKeys();
});
document.addEventListener('visibilitychange', () => {
  const machine = dos.state;
  audio.setGameMusic(machine.mode === 'game' && machine.game?.phase === 'playing' && !document.hidden);
  if (!document.hidden && audio.context) audio.unlock();
});

const smoothstep = (t) => t * t * (3 - 2 * t);
const bezier = new THREE.Vector3();
let lastScreenFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!reducedMotion) {
    lavaBlobs.forEach(({object, base, phase}) => { object.position.y = base + Math.sin(now * .00031 + phase) * .006; });
    lavaLight.intensity = .28 + Math.sin(now * .00052) * .012;
  }
  if (cameraTransition) {
    const t = THREE.MathUtils.clamp((now - cameraTransition.start) / cameraTransition.duration, 0, 1);
    const ease = smoothstep(t);
    camera.position.lerpVectors(cameraTransition.fromPosition, cameraTransition.toPosition, ease);
    controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.toTarget, ease);
    camera.lookAt(controls.target);
    if (t === 1) {
      cameraTransition = null;
      controls.enabled = !state.screenFocused;
    }
  } else if (!state.screenFocused) controls.update();
  if (diskAnimation) {
    const animation = diskAnimation;
    // An input event can occur after this RAF timestamp was sampled.
    const t = THREE.MathUtils.clamp((now - animation.start) / animation.duration, 0, 1);
    const segment = Math.min(2, Math.floor(t * 3));
    const localT = smoothstep(Math.min(1, t * 3 - segment));
    bezier.lerpVectors(animation.points[segment], animation.points[segment + 1], localT);
    diskObject.position.copy(bezier);
    diskObject.quaternion.slerpQuaternions(animation.fromQuaternion, animation.toQuaternion, smoothstep(t));
    if (t >= 1) {
      state.diskMoving = false;
      state.diskInserted = animation.inserting;
      dos.setDisk(state.diskInserted);
      diskAnimation = null;
      el.diskToggle.querySelector('span').textContent = state.diskInserted ? 'Eject disk' : 'Insert disk';
      el.diskToggle.title = state.diskInserted ? 'Eject disk' : 'Insert disk';
      el.diskToggle.setAttribute('aria-label', el.diskToggle.title);
      pulseDrive(state.pcOn ? 550 : 0);
      if (dos.state.bootBlocked) notify(state.diskInserted ? 'Remove the data disk to boot.' : 'Disk out. Press any key at the screen.', 4500);
      updateObjective();
    }
  }
  if (now - lastScreenFrame >= 1000 / 40) {
    dos.render(screenContext, screenCanvas.width, screenCanvas.height, now);
    screenTexture.needsUpdate = true;
    lastScreenFrame = now;
  }
  const screenOn = state.pcOn && state.monitorOn;
  if (screenMesh && screenMesh.material !== (screenOn ? screenMaterial : screenOffMaterial)) screenMesh.material = screenOn ? screenMaterial : screenOffMaterial;
  screenGlow.intensity = screenOn ? .55 : 0;
  screenBounce.intensity = screenOn ? .018 : 0;
  setLED(driveLED, state.pcOn && state.driveActive, '#dabc70');
  composer.render();
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  if (state.screenFocused) {
    state.screenFocused = false;
    focusScreen();
  }
});

// Read-only diagnostics for visual verification in development.
window.__DESK__ = {
  state, dos, audio, scene, camera, renderer, controls, composer, ambientOcclusion,
  get model() { return model; },
  get screenCenter() { return screenCenter.clone(); },
  get lights() { return { ceiling, interiorFill, roomBounce, deskLamp, lampBounce, lavaLight, shelfLight, screenGlow }; },
};
