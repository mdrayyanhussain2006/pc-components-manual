/* PC Anatomy - FINAL browser/WebGL runtime validation (isolated test).
 * Loads build/export/pc_anatomy_web_final.glb (meshopt-compressed) with
 * three.js GLTFLoader + MeshoptDecoder. The GLB is the sole source of
 * truth for node transforms and animation; this file never edits poses.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const GLB_URL = "./pc_anatomy_web_final.glb";

// ------------------------------------------------------------------ HUD
const $ = (id) => document.getElementById(id);
const fatalEl = $("fatal");

function fatal(message, err) {
  fatalEl.textContent = message;
  fatalEl.style.display = "flex";
  if (err !== undefined) console.error(message, err);
}

function setStat(id, value, ok = true) {
  const el = $(id);
  el.textContent = String(value);
  el.className = ok ? "ok" : "bad";
}

// ------------------------------------------------------------- renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: $("app"),
    antialias: true,
  });
} catch (err) {
  fatal("WEBGL RENDERER FAILED", err);
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------------------------------------------------------------- scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x232328);
scene.fog = new THREE.Fog(0x232328, 4.0, 9.0);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.001,
  100
);
camera.position.set(0.55, 0.42, 0.7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.target.set(0.0, 0.2, 0.0);

// ------------------------------------------------------------- lighting
const hemi = new THREE.HemisphereLight(0xdfe6f0, 0x2a2a30, 0.9);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(1.4, 2.2, 1.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 8;
key.shadow.camera.left = -0.9;
key.shadow.camera.right = 0.9;
key.shadow.camera.top = 0.9;
key.shadow.camera.bottom = -0.9;
key.shadow.bias = -0.0002;
scene.add(key);

const fill = new THREE.DirectionalLight(0xbcd0ff, 0.6);
fill.position.set(-1.6, 0.9, -0.7);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffe2c0, 0.5);
rim.position.set(-0.4, 1.3, -1.8);
scene.add(rim);

// shadow-catcher floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 6),
  new THREE.ShadowMaterial({ opacity: 0.35 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// -------------------------------------------------------- meshopt check
let meshoptReady = false;
try {
  await MeshoptDecoder.ready;
  meshoptReady = true;
  setStat("d-meshopt", "YES");
  console.log("[MESHOPT] MeshoptDecoder ready:", MeshoptDecoder);
} catch (err) {
  setStat("d-meshopt", "NO");
  fatal("MESHOPT DECODER FAILED", err);
  throw err; // stop - no silent fallback
}

// ------------------------------------------------------------ GLB load
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

let gltf = null;
let mixer = null;
let currentAction = null;
let globalSpeed = 1.0;
const clipByName = new Map();

try {
  gltf = await loader.loadAsync(GLB_URL);
} catch (err) {
  setStat("d-glb", "NO");
  fatal("GLB LOAD FAILED", err);
  throw err;
}

setStat("d-glb", "YES");
console.log("[GLB] loaded:", GLB_URL);
scene.add(gltf.scene);

// glTF-JSON-level logical counts (the 29-node / 25-mesh contract);
// the runtime traversal below additionally sees per-primitive child
// meshes created by GLTFLoader, which is expected.
const gltfJson = gltf.parser.json;
setStat("d-nodes", gltfJson.nodes.length);
setStat("d-meshes", gltfJson.meshes.length);
console.log("[GLTF] logical node count (json):", gltfJson.nodes.length,
  gltfJson.nodes.map((n) => n.name));
console.log("[GLTF] logical mesh count (json):", gltfJson.meshes.length);
console.log("[GLTF] extensionsUsed:", gltfJson.extensionsUsed);

gltf.scene.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});

// ---------------------------------------------------------- frame model
const box = new THREE.Box3().setFromObject(gltf.scene);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
const maxDim = Math.max(size.x, size.y, size.z);
camera.near = maxDim / 1000;
camera.far = maxDim * 100;
camera.updateProjectionMatrix();
camera.position
  .copy(center)
  .add(new THREE.Vector3(maxDim * 1.25, maxDim * 0.95, maxDim * 1.6));
controls.target.copy(center);
controls.update();
floor.position.y = box.min.y - 0.001;

// --------------------------------------------------------------- stats
const nodeNames = [];
let meshCount = 0;
const materialSet = new Set();
gltf.scene.traverse((o) => {
  nodeNames.push(o.name || "(unnamed)");
  if (o.isMesh) {
    meshCount += 1;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => materialSet.add(m));
  }
});

setStat("d-mats", materialSet.size);
setStat("d-anims", gltf.animations.length);

console.log("[NODES] runtime object count (incl. per-primitive children):",
  nodeNames.length);
console.log("[NODES] runtime object names:", nodeNames);
console.log("[MESHES] runtime mesh object count:", meshCount);
console.log("[MATERIALS] count:", materialSet.size,
  [...materialSet].map((m) => m.name));

const top = gltf.scene.children.map((c) => c.name);
console.log("[NODES] top-level:", top);

const REQUIRED = [
  "PC_ROOT", "CASE", "CASE_SIDE_PANEL", "MOTHERBOARD", "CPU", "CPU_COOLER",
  "RAM_01", "RAM_02", "RAM_03", "RAM_04", "GPU", "M2_SSD", "STORAGE",
  "PSU", "CASE_FAN_01", "CASE_FAN_02", "CASE_FAN_03",
  "CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER",
  "CABLE_24PIN_CONN_MB", "CABLE_24PIN_CONN_PSU",
  "CABLE_CPU_POWER_CONN_MB", "CABLE_CPU_POWER_CONN_PSU",
  "CABLE_GPU_POWER_CONN_GPU", "CABLE_GPU_POWER_CONN_PSU",
  "CABLES", "FANS", "RAM",
];
const present = new Set(nodeNames);
const missing = REQUIRED.filter((n) => !present.has(n));
console.log("[NODES] required component check:",
  missing.length === 0 ? "ALL PRESENT" : "MISSING: " + missing.join(", "));

// ---------------------------------------------------------- animations
mixer = new THREE.AnimationMixer(gltf.scene);
gltf.animations.forEach((clip) => clipByName.set(clip.name, clip));

console.log("[ANIM] clip count:", gltf.animations.length);
console.log("[ANIM] clip names:", gltf.animations.map((c) => c.name));

const animList = $("anim-list");
gltf.animations
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name))
  .forEach((c) => {
    const li = document.createElement("li");
    li.textContent = `${c.name}  (${c.duration.toFixed(3)}s)`;
    animList.appendChild(li);
  });

// ------------------------------------------- stage button -> clip map
// Resolved by INSPECTING gltf.animations (exact match first, then a
// substring fallback) - exported names are never assumed.
const STAGES = [
  { label: "ASSEMBLED", resolve: () => null, kind: "reset" },
  { label: "OPEN_CASE", candidates: ["PC_Disassembly_CASE_SIDE_PANEL"] },
  { label: "MOTHERBOARD_OUT", candidates: ["PC_Disassembly_MOTHERBOARD"] },
  { label: "CPU_COOLER_OUT", candidates: ["PC_Disassembly_CPU_COOLER"] },
  { label: "CPU_OUT", candidates: ["PC_Disassembly_CPU"] },
  { label: "RAM_OUT", candidates: ["PC_Disassembly_RAM_01"] },
  { label: "GPU_OUT", candidates: ["PC_Disassembly_GPU"] },
  { label: "STORAGE_OUT", candidates: ["PC_Disassembly_STORAGE"] },
  { label: "PSU_OUT", candidates: ["PC_Disassembly_PSU"] },
  { label: "SECONDARY_OUT", candidates: ["PC_Disassembly_M2_SSD"] },
  { label: "FINAL_EXPLODE", candidates: ["FINAL_EXPLODE", "EXPLODE", "PC_Disassembly_CASE_FAN_01"] },
  { label: "RESET", resolve: () => null, kind: "reset" },
];

function resolveClip(candidates) {
  for (const c of candidates) {
    if (clipByName.has(c)) return clipByName.get(c);
  }
  // substring fallback
  for (const c of candidates) {
    const hit = gltf.animations.find((a) => a.name.includes(c));
    if (hit) return hit;
  }
  return null;
}

// Cable disconnect verification: plays the motherboard extraction clip
// at normal speed so the 24PIN / CPU_POWER / GPU_POWER sequences
// (connected -> disconnect -> clear -> extraction) can be watched.
const cableClip = resolveClip(["PC_Disassembly_MOTHERBOARD"]);

console.log("[MAP] stage -> exported clip:");
const stageButtons = [];
const grid = $("stage-grid");

for (const stage of STAGES) {
  const btn = document.createElement("button");
  btn.textContent = stage.label;
  let clip = null;
  if (stage.kind !== "reset") {
    clip = resolveClip(stage.candidates);
    console.log(`[MAP]   ${stage.label} -> ${clip ? clip.name : "(no matching clip)"}`);
    if (!clip) btn.classList.add("warn");
  } else {
    console.log(`[MAP]   ${stage.label} -> (restores frame-1 assembled pose)`);
  }
  btn.addEventListener("click", () => {
    stageButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (stage.kind === "reset") restoreAssembled(stage.label);
    else playClip(clip, stage.label);
  });
  grid.appendChild(btn);
  stageButtons.push(btn);
}

const cableBtn = document.createElement("button");
cableBtn.textContent = "TEST CABLE DISCONNECT";
cableBtn.className = "wide cable";
cableBtn.addEventListener("click", () => {
  stageButtons.forEach((b) => b.classList.remove("active"));
  cableBtn.classList.add("active");
  if (cableClip) playClip(cableClip, "TEST CABLE DISCONNECT", 1.0);
  else console.error("[CABLE] no motherboard extraction clip found");
});
grid.appendChild(cableBtn);

const speedInput = $("speed");
speedInput.addEventListener("input", () => {
  globalSpeed = parseFloat(speedInput.value);
  $("speed-val").textContent = globalSpeed + "x";
  if (currentAction) currentAction.timeScale = globalSpeed;
});

// ------------------------------------------------------- playback logic
function playClip(clip, label, forcedSpeed) {
  if (!clip) {
    console.warn(`[STAGE] ${label}: no exported clip matched`);
    $("now-playing").textContent = `${label}: NO CLIP`;
    return;
  }
  const prev = currentAction;
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.timeScale = forcedSpeed !== undefined ? forcedSpeed : globalSpeed;
  if (prev && prev !== action) {
    prev.fadeOut(0.25);
    action.fadeIn(0.25);
  }
  action.play();
  currentAction = action;
  $("now-playing").textContent = `playing: ${clip.name}`;
  console.log(`[STAGE] ${label} -> playing "${clip.name}" (${clip.duration.toFixed(2)}s)`);
}

// Every exported clip spans the full timeline and starts from the
// authored assembled pose at t=0, so sampling t=0 of all clips restores
// the assembled state without touching node transforms manually.
// (three r180 AnimationAction has no setTime(); play frozen + update(0)
// + stop writes the t=0 pose into every animated property instead.)
function restoreAssembled(label) {
  mixer.stopAllAction();
  const snaps = [];
  for (const clip of gltf.animations) {
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = 0; // frozen at t=0
    action.play();
    snaps.push(action);
  }
  mixer.update(0); // sample the assembled frame-1 pose of every clip
  for (const a of snaps) a.stop();
  currentAction = null;
  $("now-playing").textContent = `${label}: assembled pose restored`;
  console.log(`[STAGE] ${label}: restored frame-1 assembled pose via clip t=0`);
}

mixer.addEventListener("finished", (e) => {
  console.log(`[ANIM] finished: ${e.action.getClip().name}`);
});

// ------------------------------------------------------------ FPS + loop
const clock = new THREE.Clock();
let frames = 0;
let fpsTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);

  frames += 1;
  fpsTimer += delta;
  if (fpsTimer >= 0.5) {
    $("fps").textContent = Math.round(frames / fpsTimer);
    frames = 0;
    fpsTimer = 0;
  }
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log("[READY] runtime validation harness initialized. Start with ASSEMBLED.");
