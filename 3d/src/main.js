// Wedding island: a small low-poly Okinawa island for the 3D wedding page.
// Rebuild app.js after editing (three.js is bundled in):
//   npx esbuild 3d/src/main.js --bundle --minify --format=esm --outfile=3d/app.js
import * as THREE from 'three';

const canvas = document.getElementById('scene');
const body = document.body;
const IMG = '../images/';

function giveUp() { body.classList.add('no3d'); window.__islandReady = true; }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  giveUp();
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;          // refreshed every few frames in the loop

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xDFE7EB, 70, 170);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);

// ---------- materials & helpers ----------
const grad = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;
const mats = new Map();
function toon(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: grad }, extra)));
  return mats.get(key);
}
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const rand = (a, b) => a + Math.random() * (b - a);
const loader = new THREE.TextureLoader();
function tex(url) {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// signs use the main page's serif; `spacing` is letter spacing in px (drawn per letter, works everywhere)
function textTexture(text, { w = 512, h = 128, size = 64, color = '#3B4747', bg = null, border = null, font = "'Cormorant Garamond'",
  weight = 600, style = '', spacing = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const css = `${style} ${weight} ${size}px ${font}`.trim();
  const draw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    if (bg) {
      g.fillStyle = bg;
      g.beginPath(); if (g.roundRect) g.roundRect(6, 6, w - 12, h - 12, 20); else g.rect(6, 6, w - 12, h - 12); g.fill();
      if (border) { g.lineWidth = 4; g.strokeStyle = border; g.stroke(); }
    }
    g.fillStyle = color;
    g.font = `${css}, 'LXGW WenKai TC', serif`;
    g.textBaseline = 'middle';
    const y = h / 2 + 2, chars = [...text];
    if (!spacing) { g.textAlign = 'center'; g.fillText(text, w / 2, y); }
    else {
      const ws = chars.map(ch => g.measureText(ch).width);
      let x = w / 2 - (ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)) / 2;
      g.textAlign = 'left';
      chars.forEach((ch, i) => { g.fillText(ch, x, y); x += ws[i] + spacing; });
    }
    t.needsUpdate = true;
  };
  draw();
  if (document.fonts) document.fonts.load(css, text).then(draw, () => {});
  return t;
}

// ---------- light ----------
scene.add(new THREE.HemisphereLight(0xF7F6F0, 0xE2DBC8, 1.7));
const sun = new THREE.DirectionalLight(0xFFF5E8, 1.5);
sun.position.set(14, 24, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 80 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun);

// ---------- sea (lighter lagoon colour near the island) ----------
const SEA_Y = -0.1;
const seaGeo = new THREE.PlaneGeometry(280, 280, 84, 84);
seaGeo.rotateX(-Math.PI / 2);
const seaBase = seaGeo.attributes.position.array.slice();
{
  const deep = new THREE.Color(0x8FB1C5), shallow = new THREE.Color(0xCDE1E3), c = new THREE.Color();
  const cols = new Float32Array(seaGeo.attributes.position.count * 3);
  for (let i = 0; i < seaGeo.attributes.position.count; i++) {
    const d = Math.hypot(seaBase[i * 3], seaBase[i * 3 + 2]);
    c.copy(deep).lerp(shallow, THREE.MathUtils.smoothstep(24, 11, d));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  seaGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}
const sea = new THREE.Mesh(seaGeo, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 50, specular: 0xDDE8E6, flatShading: true }));
sea.position.y = SEA_Y;
sea.receiveShadow = true;
scene.add(sea);
function updateSea(t) {
  const p = seaGeo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const x = seaBase[i], z = seaBase[i + 2];
    p[i + 1] = Math.sin(x * 0.3 + t * 1.1) * 0.16 + Math.cos(z * 0.26 + t * 0.9) * 0.14 + Math.sin((x + z) * 0.13 + t * 0.6) * 0.08;
  }
  seaGeo.attributes.position.needsUpdate = true;
  seaGeo.computeVertexNormals();
}

// ---------- island ----------
function blob(r, h, seg, amp, seed) {
  const g = new THREE.CylinderGeometry(r, r * 1.06, h, seg, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (Math.hypot(x, z) < 1e-3) continue;
    const a = Math.atan2(z, x);
    const k = 1 + amp * (Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 5 + seed * 2) * 0.3 + Math.sin(a * 9 + seed * 3) * 0.15);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}
const G = 0.75, SAND = 0.4;                                   // grass top / sand top
mesh(blob(11, 1.2, 64, 0.06, 1.3), toon(0xEFE4C9), 0, SAND - 0.6, 0, scene, false);
mesh(blob(9.3, 0.5, 64, 0.07, 2.1), toon(0xBACBA5), 0, G - 0.25, 0, scene, false);
const HILL = { x: -4.8, z: -2.8, r: 3.1, h: 0.7 };            // little hill under the chapel
const hill = mesh(blob(HILL.r, HILL.h, 32, 0.06, 4), toon(0xAEC29B), HILL.x, G + HILL.h / 2, HILL.z, scene, false);
const groundY = (x, z) => Math.hypot(x, z) < 8.9 ? G : SAND;

const clickables = [];
function tag(obj, stop) { obj.userData.stop = stop; clickables.push(obj); return obj; }

// ---------- palm trees ----------
const leafGeo = (() => {
  const g = new THREE.PlaneGeometry(2.0, 0.55, 6, 1);
  g.translate(1.0, 0, 0);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setY(i, 0.14 * x - 0.19 * x * x);
    p.setZ(i, p.getZ(i) * (1 - x / 2.3));
  }
  g.computeVertexNormals();
  return g;
})();
const palms = [];
function palm(x, z, h = 3.2, lean = 0.22, rot = 0) {
  const g = new THREE.Group();
  g.position.set(x, groundY(x, z), z);
  g.rotation.y = rot;
  const trunk = toon(0xB49C82), leaf = toon(0x7E9F7C, { side: THREE.DoubleSide });
  let px = 0, py = 0;
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const t = i / segs, sh = h / segs, a = lean * (0.5 + t);
    const m = mesh(cyl(0.14 - t * 0.04, 0.17 - t * 0.04, sh * 1.04, 7), trunk, px + Math.sin(a) * sh / 2, py + Math.cos(a) * sh / 2, 0, g);
    m.rotation.z = -a;
    px += Math.sin(a) * sh; py += Math.cos(a) * sh;
  }
  const crown = new THREE.Group();
  crown.position.set(px, py, 0);
  g.add(crown);
  for (let i = 0; i < 6; i++) {
    const l = mesh(leafGeo, leaf, 0, 0, 0, crown);
    l.rotation.y = (i / 6) * Math.PI * 2 + rand(-0.2, 0.2);
  }
  const nut = toon(0x8A7058);
  mesh(new THREE.IcosahedronGeometry(0.13, 0), nut, 0.12, -0.12, 0.08, crown);
  mesh(new THREE.IcosahedronGeometry(0.13, 0), nut, -0.08, -0.14, -0.1, crown);
  crown.userData.phase = rand(0, 6);
  palms.push(crown);
  scene.add(g);
  return g;
}
[[-7.6, 0.8, 3.3, 0.25, 0.4], [-6.9, 5.8, 2.8, 0.3, 1.2], [-2.4, 7.5, 3.1, 0.2, 2.2], [7.9, -1.6, 3.4, 0.28, 3.3],
 [6.6, 6.0, 2.9, 0.26, 4.1], [0.7, -6.7, 3.3, 0.2, 5.0], [-1.6, -6.4, 2.6, 0.3, 0.9], [7.6, -5.2, 3.0, 0.25, 2.7],
 [-8.6, -3.9, 2.9, 0.3, 5.6]].forEach(a => palm(...a));

// ---------- chapel (婚禮資訊) ----------
function buildChapel() {
  const g = new THREE.Group();
  const white = toon(0xFBFAF5), roof = toon(0xC98F72), blue = toon(0xA3C0C0), wood = toon(0x8C735E), gold = toon(0xD4B272);
  mesh(box(2.4, 1.8, 3.2), white, 0, 0.9, 0, g);
  const r = mesh(new THREE.CylinderGeometry(1.56, 1.56, 3.4, 3, 1), roof, 0, 2.27, -0.05, g);
  r.rotation.x = -Math.PI / 2;
  r.scale.z = 0.6;
  for (const zz of [-0.9, 0.2]) for (const s of [-1, 1]) mesh(box(0.06, 0.7, 0.45), blue, s * 1.21, 1.05, zz, g);
  mesh(box(1.05, 3.3, 1.05), white, 0, 1.65, 1.75, g);                        // bell tower with the door
  const cap = mesh(new THREE.ConeGeometry(0.9, 1.25, 4), roof, 0, 3.92, 1.75, g);
  cap.rotation.y = Math.PI / 4;
  mesh(box(0.08, 0.6, 0.08), gold, 0, 4.8, 1.75, g);
  mesh(box(0.36, 0.08, 0.08), gold, 0, 4.9, 1.75, g);
  mesh(box(0.5, 0.55, 0.06), wood, 0, 2.75, 2.29, g);
  mesh(new THREE.SphereGeometry(0.16, 12, 8), gold, 0, 2.72, 2.2, g);
  const rose = mesh(cyl(0.22, 0.22, 0.06, 20), blue, 0, 2.0, 2.29, g);
  rose.rotation.x = Math.PI / 2;
  mesh(box(0.56, 0.95, 0.06), wood, 0, 0.47, 2.29, g);
  // shisa guardians from the invitation artwork
  for (const [file, sx] of [['05-風獅爺-左.png', -0.78], ['06-風獅爺-右.png', 0.78]]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(IMG + file) }));
    s.scale.set(0.62, 0.55, 1);
    s.position.set(sx, 0.3, 2.55);
    g.add(s);
  }
  g.position.set(HILL.x, G + HILL.h, HILL.z);
  g.rotation.y = 0.35;
  scene.add(g);
  tag(g, 'info');
  tag(hill, 'info');
}
buildChapel();

// ---------- hotel + garden pool (住宿) ----------
function buildHotel() {
  const g = new THREE.Group();
  const cream = toon(0xF2EDE1), teal = toon(0x87A3A3), glass = toon(0xC9DCDC), coral = toon(0xC98F72), white = toon(0xFBFAF5);
  mesh(box(4.4, 4.0, 2.2), cream, 0, 2.0, 0, g);
  mesh(box(4.7, 0.28, 2.5), teal, 0, 4.14, 0, g);
  mesh(box(1.2, 0.5, 1.0), cream, 1.3, 4.53, 0, g);
  const win = new THREE.InstancedMesh(box(0.52, 0.4, 0.06), glass, 30);
  const d = new THREE.Object3D();
  let n = 0;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
    d.position.set(-1.65 + col * 0.66, 1.25 + row * 0.6, 1.11);
    d.updateMatrix();
    win.setMatrixAt(n++, d.matrix);
  }
  g.add(win);
  for (let row = 0; row < 5; row++) mesh(box(4.25, 0.05, 0.22), white, 0, 1.0 + row * 0.6, 1.2, g, false);
  mesh(box(1.9, 0.12, 0.85), coral, 0, 0.95, 1.45, g);
  for (const s of [-0.8, 0.8]) mesh(cyl(0.04, 0.04, 0.9, 6), white, s, 0.45, 1.8, g);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.58), new THREE.MeshBasicMaterial({
    map: textTexture('HOTEL', { bg: '#FBFAF6', border: '#C4C3B6', color: '#3B4747', size: 70, spacing: 16 }), transparent: true }));
  sign.position.set(-0.7, 4.62, 1.27);
  g.add(sign);
  g.position.set(4.6, G, -3.4);
  g.rotation.y = -0.3;
  scene.add(g);
  tag(g, 'stay');

  // Garden Pool: five connected round pools
  const pool = new THREE.Group();
  mesh(box(5.0, 0.08, 2.0), toon(0xEEE7D7), 0, 0.04, 0, pool, false);
  const water = toon(0xA6D0D4, { emissive: 0x2E5E60, emissiveIntensity: 0.15 });
  [[-1.8, 0.25], [-0.85, -0.25], [0.1, 0.15], [1.05, -0.28], [1.95, 0.2]].forEach(([x, z]) => {
    mesh(cyl(0.62, 0.62, 0.06, 28), water, x, 0.1, z, pool, false);
    const rim = mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 28), white, x, 0.13, z, pool, false);
    rim.rotation.x = Math.PI / 2;
  });
  for (const [x, z, c] of [[-2.2, -0.7, 0xD8A9A2], [2.3, -0.65, 0xE0C48F]]) {
    mesh(cyl(0.025, 0.025, 0.9, 6), white, x, 0.45, z, pool);
    mesh(new THREE.ConeGeometry(0.42, 0.22, 8), toon(c), x, 0.95, z, pool);
  }
  pool.position.set(3.9, G, 0.3);
  pool.rotation.y = -0.2;
  scene.add(pool);
  tag(pool, 'stay');

  // the little public beach nearby
  const beach = new THREE.Group();
  mesh(cyl(0.03, 0.03, 1.3, 6), white, 0, 0.65, 0, beach);
  mesh(new THREE.ConeGeometry(0.75, 0.35, 8), toon(0xDDB1AA), 0, 1.35, 0, beach);
  mesh(box(0.7, 0.03, 1.3), toon(0xBFD4D6), 0.55, 0.02, 0.3, beach, false);
  beach.position.set(9.4, SAND, 3.1);
  beach.rotation.y = 0.6;
  scene.add(beach);
  tag(beach, 'stay');
}
buildHotel();

// ---------- clock (當天流程) ----------
const hands = {};
function buildClock() {
  const g = new THREE.Group();
  const wood = toon(0xA88C72), white = toon(0xFBFAF5), coral = toon(0xC98F72), ink = toon(0x26302F);
  mesh(cyl(0.12, 0.15, 2.6, 8), wood, 0, 1.3, 0, g);
  const face = new THREE.Group();
  face.position.set(0, 2.95, 0);
  g.add(face);
  const disc = mesh(cyl(0.85, 0.85, 0.2, 32), white, 0, 0, 0, face);
  disc.rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.86, 0.1, 8, 32), coral, 0, 0, 0, face);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    mesh(box(0.06, i % 3 ? 0.08 : 0.16, 0.03), ink, Math.sin(a) * 0.66, Math.cos(a) * 0.66, 0.11, face, false).rotation.z = -a;
  }
  const hg = box(0.08, 0.42, 0.03); hg.translate(0, 0.19, 0);
  const mg = box(0.05, 0.6, 0.03); mg.translate(0, 0.28, 0);
  hands.h = mesh(hg, ink, 0, 0, 0.13, face, false);
  hands.m = mesh(mg, coral, 0, 0, 0.15, face, false);
  mesh(new THREE.ConeGeometry(0.55, 0.5, 6), coral, 0, 4.1, 0, g);
  mesh(box(1.0, 0.35, 0.5), toon(0xC9AF90), 0, 0.18, 0.3, g);
  g.position.set(0.3, G, 1.2);
  scene.add(g);
  tag(g, 'schedule');

  // BBQ grill for the evening
  const bbq = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mesh(cyl(0.025, 0.025, 0.55, 5), ink, Math.cos(a) * 0.2, 0.27, Math.sin(a) * 0.2, bbq);
  }
  mesh(cyl(0.36, 0.26, 0.26, 16), toon(0x4B504F), 0, 0.64, 0, bbq);
  mesh(cyl(0.34, 0.34, 0.03, 16), toon(0xBDBCB4), 0, 0.78, 0, bbq, false);
  bbq.position.set(7.0, G, 1.5);
  scene.add(bbq);
  tag(bbq, 'schedule');
  return bbq;
}
const bbq = buildClock();
const smoke = [];
for (let i = 0; i < 4; i++) {
  const s = mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xFBFAF5, transparent: true, opacity: 0.7 }), 0, 0, 0, bbq, false);
  s.userData.off = i / 4;
  smoke.push(s);
}

// ---------- shirt stall (服裝) ----------
function buildStall() {
  const g = new THREE.Group();
  const white = toon(0xF6F2E8), wood = toon(0xA88C72);
  mesh(box(2.0, 0.8, 0.8), white, 0, 0.4, -0.3, g);
  for (const [x, z] of [[-0.95, -0.65], [0.95, -0.65], [-0.95, 0.55], [0.95, 0.55]]) mesh(cyl(0.05, 0.05, 2.1, 6), wood, x, 1.05, z, g);
  const sc = document.createElement('canvas');
  sc.width = 128; sc.height = 8;
  const sg = sc.getContext('2d');
  for (let i = 0; i < 8; i++) { sg.fillStyle = i % 2 ? '#F7F5EF' : '#C98F72'; sg.fillRect(i * 16, 0, 16, 8); }
  const stripes = new THREE.CanvasTexture(sc);
  stripes.colorSpace = THREE.SRGBColorSpace;
  const awn = mesh(box(2.4, 0.12, 1.5), new THREE.MeshToonMaterial({ map: stripes, gradientMap: grad }), 0, 2.15, -0.05, g);
  awn.rotation.x = 0.12;
  const bar = mesh(cyl(0.03, 0.03, 1.9, 6), wood, 0, 1.75, 0.55, g);
  bar.rotation.z = Math.PI / 2;
  for (const [file, x] of [['08-花襯衫-藍.png', -0.45], ['07-花襯衫-粉.png', 0.45]]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(IMG + file) }));
    s.scale.set(0.72, 0.57, 1);
    s.position.set(x, 1.38, 0.56);
    g.add(s);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({
    map: textTexture('ALOHA', { bg: '#FBFAF6', border: '#C4C3B6', color: '#2C5A6B', size: 66, spacing: 12 }), transparent: true }));
  sign.position.set(0, 2.45, 0.72);
  g.add(sign);
  g.position.set(-4.5, G, 3.4);
  g.rotation.y = 0.45;
  scene.add(g);
  tag(g, 'dress');
}
buildStall();

// ---------- photo spot with the couple's photos (照片) ----------
function buildPhotoSpot() {
  const g = new THREE.Group();
  const white = toon(0xFBFAF5), wood = toon(0xA88C72);
  const hs = new THREE.Shape();
  hs.moveTo(0.25, 0.25);
  hs.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  hs.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  hs.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  hs.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  hs.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  hs.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 16 });
  hg.center();
  const heart = mesh(hg, toon(0xE2ADB0), 0, 3.05, -0.35, g);
  heart.rotation.z = Math.PI;
  heart.scale.setScalar(1.6);
  heart.userData.beat = true;
  mesh(cyl(0.05, 0.05, 2.3, 6), wood, 0, 1.15, -0.4, g);
  const photos = ['01-首圖-甩婚紗-mobile.jpg', '11-尾圖-相擁-mobile.jpg'];
  photos.forEach((file, i) => {
    const f = new THREE.Group();
    const side = i ? 1 : -1;
    f.position.set(side * 1.15, 1.35, 0);
    f.rotation.y = -side * 0.28;
    mesh(box(2.0, 1.42, 0.1), white, 0, 0, 0, f);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 1.23), new THREE.MeshBasicMaterial({ map: tex(IMG + file), toneMapped: false }));
    photo.position.z = 0.056;
    f.add(photo);
    for (const lx of [-0.6, 0.6]) {
      const leg = mesh(cyl(0.035, 0.035, 1.25, 6), wood, lx, -0.95, -0.12, f);
      leg.rotation.x = 0.12;
    }
    g.add(f);
  });
  g.position.set(2.8, G, 4.9);
  g.rotation.y = -0.15;
  scene.add(g);
  tag(g, 'photo');
  return heart;
}
const heart = buildPhotoSpot();

// ---------- stepping-stone paths and flowers ----------
{
  const hub = new THREE.Vector2(0.3, 2.0);
  const ends = [[-3.4, -0.3], [2.2, 0.1], [-3.4, 2.9], [2.3, 3.8], [6.3, 1.9]];
  const pts = [];
  for (const [ex, ez] of ends) {
    const e = new THREE.Vector2(ex, ez), len = hub.distanceTo(e);
    for (let s = 0.9; s < len - 0.3; s += 0.75) pts.push(hub.clone().lerp(e, s / len));
  }
  const stones = new THREE.InstancedMesh(cyl(0.26, 0.28, 0.06, 10), toon(0xEDE6D5), pts.length);
  const d = new THREE.Object3D();
  pts.forEach((p, i) => { d.position.set(p.x, G + 0.02, p.y); d.rotation.y = rand(0, 3); d.updateMatrix(); stones.setMatrixAt(i, d.matrix); });
  stones.receiveShadow = true;
  scene.add(stones);

  const keepOut = [[HILL.x, HILL.z, HILL.r + 0.3], [4.6, -3.4, 3.2], [3.9, 0.3, 2.8], [0.3, 1.2, 1.2], [-4.5, 3.4, 1.8], [2.8, 4.9, 2.2], [7.0, 1.5, 0.8]];
  const colors = [0xE2A6A6, 0xF3DADA, 0xE9D6A8, 0xFBFAF5, 0xD9A27C].map(c => new THREE.Color(c));
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), toon(0xFFFFFF), 90);
  let n = 0;
  while (n < 90) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 8.3, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
    d.position.set(x, G + 0.08, z); d.rotation.set(0, 0, 0); d.scale.setScalar(rand(0.7, 1.3)); d.updateMatrix();
    fl.setMatrixAt(n, d.matrix);
    fl.setColorAt(n, colors[n % colors.length]);
    n++;
  }
  scene.add(fl);
}

// ---------- clouds, plane with banner, petals ----------
const clouds = [];
{
  const cg = new THREE.IcosahedronGeometry(1, 1), cm = toon(0xFBFAF5);
  const puff = [[0, 0, 0, 1], [1.1, -0.15, 0.1, 0.75], [-1.05, -0.2, 0, 0.7], [0.45, 0.45, -0.1, 0.7], [-0.4, 0.35, 0.2, 0.6]];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    for (const [x, y, z, r] of puff) { const m = new THREE.Mesh(cg, cm); m.position.set(x, y, z); m.scale.setScalar(r); g.add(m); }
    const a = (i / 7) * Math.PI * 2 + rand(-0.3, 0.3);
    g.userData = { a, r: rand(44, 64), y: rand(7, 14), s: rand(0.00006, 0.0001) };
    g.scale.setScalar(rand(1.2, 2.0));
    scene.add(g);
    clouds.push(g);
  }
}
const plane = new THREE.Group();
{
  const white = toon(0xFBFAF5), coral = toon(0xC98F72), ink = toon(0x26302F);
  const fus = mesh(new THREE.CapsuleGeometry(0.26, 1.2, 4, 10), white, 0, 0, 0, plane);
  fus.rotation.z = Math.PI / 2;
  mesh(box(0.4, 0.06, 2.4), coral, 0.1, 0, 0, plane);
  mesh(box(0.3, 0.5, 0.06), coral, -0.75, 0.3, 0, plane);
  mesh(box(0.25, 0.05, 0.8), coral, -0.75, 0.05, 0, plane);
  const prop = mesh(box(0.04, 0.75, 0.1), ink, 0.88, 0, 0, plane, false);
  plane.userData.prop = prop;
  const bt = textTexture('See you in Okinawa!', { w: 1024, h: 160, size: 92, color: '#3B4747', bg: '#FBFAF6', border: '#C4C3B6', style: 'italic', weight: 500 });
  for (const flip of [0, Math.PI]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.7), new THREE.MeshBasicMaterial({ map: bt, transparent: true }));
    b.position.set(-3.6, 0, 0);
    b.rotation.y = flip;
    plane.add(b);
  }
  scene.add(plane);
}
const PETALS = 70;
const petals = new THREE.InstancedMesh((() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.12);
  s.bezierCurveTo(-0.1, -0.05, -0.08, 0.1, -0.03, 0.12);
  s.lineTo(0, 0.08); s.lineTo(0.03, 0.12);
  s.bezierCurveTo(0.08, 0.1, 0.1, -0.05, 0, -0.12);
  return new THREE.ShapeGeometry(s);
})(), new THREE.MeshBasicMaterial({ color: 0xFCE6EC, side: THREE.DoubleSide }), PETALS);
const pState = Array.from({ length: PETALS }, () => ({ x: rand(-13, 13), y: rand(0, 14), z: rand(-13, 13), v: rand(0.4, 0.8), r: rand(0, 6), s: rand(0.8, 1.4) }));
scene.add(petals);

// ---------- stops, markers, camera ----------
const STOPS = {
  info:     { label: '婚禮資訊', at: [HILL.x, G + HILL.h + 5.0, HILL.z], look: [HILL.x, 2.4, HILL.z], th: -0.55, ph: 0.95, r: 15 },
  schedule: { label: '當天流程', at: [0.3, G + 4.6, 1.2], look: [0.3, 2.3, 1.2], th: 0.08, ph: 1.0, r: 12 },
  dress:    { label: '服裝', at: [-4.5, G + 3.0, 3.4], look: [-4.5, 1.4, 3.4], th: -0.65, ph: 1.0, r: 11.5 },
  stay:     { label: '住宿', at: [4.6, G + 5.5, -3.4], look: [4.3, 2.2, -1.8], th: 0.55, ph: 0.95, r: 16.5 },
  photo:    { label: '照片', at: [2.8, G + 4.2, 4.9], look: [2.8, 1.8, 4.9], th: 0.3, ph: 1.02, r: 11.5 },
};
const marksEl = document.getElementById('marks');
const marks = {};
for (const [id, s] of Object.entries(STOPS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mk';
  b.dataset.stop = id;
  const ic = document.querySelector(`.menu button[data-stop="${id}"] .ic`);
  b.innerHTML = `<span class="mk-b"><span class="i">${ic ? ic.innerHTML : ''}</span>${s.label}<span class="ck"></span></span>`;
  b.addEventListener('click', e => { e.stopPropagation(); window.openStop && window.openStop(id); });
  marksEl.appendChild(b);
  marks[id] = { el: b, v: new THREE.Vector3(...s.at) };
}
window.dispatchEvent(new Event('wedding:marks'));

const view = { tx: 0, ty: 1, tz: 0.8, r: 40, th: -0.6, ph: 0.85, ox: 0, oy: 0 };
const goal = { tx: 0, ty: 1, tz: 0.8, r: 40, th: -0.6, ph: 0.85, ox: 0, oy: 0 };
let mode = 'title', current = null, lastTouch = 0;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
function fitR() {
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), th = tv * camera.aspect;
  return clamp(Math.max(10.5 / th * 0.9, 12 / tv), 20, 60);
}
function mapGoal() { Object.assign(goal, { tx: 0, ty: 0.9, tz: 0.8, r: fitR(), ph: 0.98 }); }
function stopGoal(id) {
  const s = STOPS[id];
  goal.tx = s.look[0]; goal.ty = s.look[1]; goal.tz = s.look[2];
  goal.r = s.r * (camera.aspect < 0.8 ? 1.1 : 1);
  goal.ph = s.ph;
  goal.th = view.th + wrap(s.th - view.th);
}
function rLimits() {
  if (mode === 'stop') { const r0 = STOPS[current].r * (camera.aspect < 0.8 ? 1.1 : 1); return [r0 * 0.6, r0 * 1.7]; }
  const f = fitR(); return [f * 0.5, f * 1.25];
}
window.addEventListener('wedding:start', () => { mode = 'map'; mapGoal(); });
window.addEventListener('wedding:open', e => { mode = 'stop'; current = e.detail.id; stopGoal(current); lastTouch = performance.now(); });
window.addEventListener('wedding:close', () => { mode = 'map'; current = null; mapGoal(); lastTouch = performance.now(); });

// drag to turn, pinch / wheel to zoom, tap to open a spot
const pointers = new Map();
let moved = 0, pinch = 0;
const dist2 = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) moved = 0;
  if (pointers.size === 2) pinch = dist2();
  lastTouch = performance.now();
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p || mode === 'title') return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1) {
    moved += Math.abs(dx) + Math.abs(dy);
    goal.th -= dx * 0.006;
    goal.ph = clamp(goal.ph - dy * 0.004, 0.5, 1.3);
  } else if (pointers.size === 2) {
    const d = dist2(), [lo, hi] = rLimits();
    goal.r = clamp(goal.r * pinch / d, lo, hi);
    pinch = d;
    moved += 20;
  }
  lastTouch = performance.now();
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size === 0 && moved < 8 && e.type === 'pointerup' && mode !== 'title') tap(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const [lo, hi] = rLimits();
  goal.r = clamp(goal.r * (1 + e.deltaY * 0.001), lo, hi);
  lastTouch = performance.now();
}, { passive: false });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function tap(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObjects(clickables, true)) {
    let o = h.object;
    while (o && !o.userData.stop) o = o.parent;
    if (o) { window.openStop && window.openStop(o.userData.stop); return; }
  }
}

const dlg = document.getElementById('dlg');
function panelGoal() {
  if (mode !== 'stop' || !dlg.classList.contains('open')) { goal.ox = 0; goal.oy = 0; return; }
  const r = dlg.getBoundingClientRect();
  if (r.width > window.innerWidth * 0.8) { goal.ox = 0; goal.oy = Math.max(0, window.innerHeight - r.top) / 2; }
  else { goal.oy = 0; goal.ox = Math.max(0, window.innerWidth - r.left) / 2; }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 50 : 40;
  camera.updateProjectionMatrix();
  if (mode === 'title') goal.r = fitR() * 1.15;
  else if (mode === 'map') goal.r = fitR();
  else if (current) stopGoal(current);
}
window.addEventListener('resize', resize);
resize();
view.r = goal.r;

// ---------- loop ----------
const tmp = new THREE.Vector3(), dummy = new THREE.Object3D();
let last = performance.now(), t = 0, frameNo = 0, ready = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; t += dt; frameNo++;

  if (mode === 'title') goal.th += dt * 0.12;
  else if (mode === 'map' && pointers.size === 0 && now - lastTouch > 5000) goal.th += dt * 0.05;
  panelGoal();
  const k = 1 - Math.exp(-dt * (pointers.size ? 12 : 3));
  for (const key of ['tx', 'ty', 'tz', 'r', 'ph', 'ox', 'oy']) view[key] += (goal[key] - view[key]) * k;
  view.th += wrap(goal.th - view.th) * k;

  const sp = Math.sin(view.ph);
  camera.position.set(view.tx + view.r * sp * Math.sin(view.th), view.ty + view.r * Math.cos(view.ph), view.tz + view.r * sp * Math.cos(view.th));
  camera.lookAt(view.tx, view.ty, view.tz);
  const W = window.innerWidth, H = window.innerHeight;
  if (Math.abs(view.ox) + Math.abs(view.oy) > 0.5) camera.setViewOffset(W, H, view.ox, view.oy, W, H);
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();

  updateSea(t);
  for (const c of palms) { c.rotation.z = Math.sin(t * 1.3 + c.userData.phase) * 0.06; c.rotation.x = Math.cos(t * 1.1 + c.userData.phase) * 0.04; }
  for (const c of clouds) { const u = c.userData; u.a += u.s * 60 * dt; c.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.3 + u.a) * 0.3, Math.sin(u.a) * u.r); }
  const pa = t * 0.2;
  plane.position.set(Math.cos(pa) * 17, 10.5 + Math.sin(t * 0.8) * 0.3, Math.sin(pa) * 17);
  plane.rotation.set(0.12, Math.atan2(-Math.cos(pa), -Math.sin(pa)), 0);
  plane.userData.prop.rotation.x = t * 30;
  hands.m.rotation.z = -t * 0.6;
  hands.h.rotation.z = -t * 0.05;
  const beat = 1.6 * (1 + Math.max(0, Math.sin(t * 3)) * 0.06);
  heart.scale.setScalar(beat);
  smoke.forEach(s => {
    const q = (t * 0.35 + s.userData.off) % 1;
    s.position.set(Math.sin(q * 6 + s.userData.off * 9) * 0.1, 0.85 + q * 1.3, 0);
    s.scale.setScalar(0.6 + q * 1.4);
    s.material.opacity = 0.65 * (1 - q);
  });
  pState.forEach((p, i) => {
    p.y -= p.v * dt; p.r += dt * 1.5;
    if (p.y < 0.2) { p.y = rand(10, 14); p.x = rand(-13, 13); p.z = rand(-13, 13); }
    dummy.position.set(p.x + Math.sin(t + i) * 0.4, p.y, p.z + Math.cos(t * 0.8 + i) * 0.4);
    dummy.rotation.set(p.r, p.r * 0.7, p.r * 0.4);
    dummy.scale.setScalar(p.s);
    dummy.updateMatrix();
    petals.setMatrixAt(i, dummy.matrix);
  });
  petals.instanceMatrix.needsUpdate = true;

  if (frameNo % 4 === 1) renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);

  for (const id in marks) {
    const m = marks[id];
    tmp.copy(m.v).project(camera);
    const hidden = tmp.z > 1 || tmp.x < -1.2 || tmp.x > 1.2 || tmp.y < -1.2 || tmp.y > 1.2;
    m.el.style.visibility = hidden ? 'hidden' : 'visible';
    if (!hidden) m.el.style.transform = `translate3d(${((tmp.x + 1) / 2) * W}px, ${((1 - tmp.y) / 2) * H}px, 0) translate(-50%, -100%)`;
  }

  if (!ready) { ready = true; window.__islandReady = true; body.classList.remove('no3d'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
