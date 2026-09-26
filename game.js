// Scuba Explorer — 3D underwater world (three.js). Loaded as a classic script so index.html works from file://.
(async () => {
const $ = id => document.getElementById(id);
let THREE;
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0';
try { THREE = await import(`${CDN}/+esm`); }
catch (e) { $('loading').textContent = 'Could not load the 3D engine (three.js from cdn.jsdelivr.net). Check your internet connection and reload.'; return; }
const { Vector3, Color, Quaternion, Matrix4, Euler } = THREE;

const { species, sites, maldives } = REEF_DATA;
const SP = Object.fromEntries(species.map(s => [s.id, s]));
const REGION = { MV: 'Maldives', EG: 'Red Sea (Egypt)', ID: 'Indonesia', AU: 'Australia', PW: 'Palau' };
const isNative = sp => sp.regions === 'all' || (Array.isArray(sp.regions) && sp.regions.includes('MV'));

const FLOOR = 10935;
const ZONES = [
  [0, 30, 'Sunlit reef', 'Epipelagic'], [30, 200, 'Deep reef', 'Mesophotic'], [200, 1000, 'Twilight zone', 'Mesopelagic'],
  [1000, 4000, 'Midnight zone', 'Bathypelagic'], [4000, 6000, 'Abyss', 'Abyssopelagic'], [6000, FLOOR, 'Hadal trench', 'Hadalpelagic'],
];
const IUCN = { LC: ['Least Concern', '#3fa45b'], NT: ['Near Threatened', '#8fb03a'], VU: ['Vulnerable', '#e0a800'], EN: ['Endangered', '#e8702a'], CR: ['Critically Endangered', '#d8342c'], DD: ['Data Deficient', '#888'], NE: ['Not Evaluated', '#888'] };
const KIND = { fish: 'Bony fish', shark: 'Shark', ray: 'Ray', turtle: 'Sea turtle (reptile)', whale: 'Marine mammal', eel: 'Eel', jelly: 'Jellyfish', squid: 'Cephalopod', octopus: 'Cephalopod', cuttle: 'Cephalopod', seahorse: 'Bony fish', nautilus: 'Cephalopod', siphonophore: 'Siphonophore', pyrosome: 'Tunicate', crust: 'Crustacean', cuke: 'Echinoderm', star: 'Echinoderm', nudi: 'Sea slug', sunfish: 'Bony fish', clam: 'Mollusc', xeno: 'Single-celled organism' };
const SPEED = { fish: 0.7, shark: 1.1, ray: 0.9, turtle: 0.5, whale: 1.3, eel: 0.4, jelly: 0.12, squid: 0.6, octopus: 0.3, cuttle: 0.35, seahorse: 0.03, nautilus: 0.25, siphonophore: 0.05, pyrosome: 0.08, crust: 0.2, cuke: 0.1, nudi: 0.02, sunfish: 0.5 };
const CORAL = new Set(['brain', 'table', 'branch', 'fan', 'anemone', 'sponge', 'softcoral', 'black', 'glass', 'bamboo', 'crinoid', 'seapen', 'mushroom', 'massive', 'scroll', 'bubble', 'leather', 'cups', 'whip', 'digitate', 'grass', 'algae', 'tubes', 'xmas']);
const UPRIGHT = new Set([...CORAL, 'jelly', 'seahorse', 'star', 'clam', 'xeno']);

// ---------- helpers ----------
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };
const lighter = h => mix(h, '#ffffff', 0.45);
function stops(list, d) {
  if (d <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) if (d <= list[i][0]) return mix(list[i - 1][1], list[i][1], (d - list[i - 1][0]) / (list[i][0] - list[i - 1][0]));
  return list[list.length - 1][1];
}
function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
const h2 = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(h2(xi, zi), h2(xi + 1, zi), u), lerp(h2(xi, zi + 1), h2(xi + 1, zi + 1), u), v) * 2 - 1;
}
const fbm = (x, z) => vnoise(x, z) * 0.6 + vnoise(x * 2.1 + 5.2, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3 + 9.1) * 0.15;
const zoneOf = d => ZONES.find(z => d < z[1]) || ZONES[ZONES.length - 1];
const WATER = [[0, '#3fb4d6'], [15, '#2596bf'], [40, '#16709c'], [120, '#0b4470'], [300, '#062540'], [800, '#031222'], [1500, '#010812'], [5000, '#01040a'], [11000, '#000205']];
const ROCK = [[0, '#9a8c78'], [30, '#7a6e62'], [200, '#4a464a'], [1000, '#35333a'], [6000, '#26252a']];
let dayLight = 1;   // 1 by day; moonlight at night
const ambient = d => (d <= 0 ? 1 : Math.exp(-d * 0.015)) * dayLight;   // sunlight left (≈1% at 300 m by day)

// ---------- terrain: reef flat to the west (x < edge), a drop-off wall that falls to the trench floor ----------
// Each site can reshape it (TER: reef-top depth, how steeply it slopes away from the edge, how deep it gets, how sandy the floor is),
// carve cave pockets into the wall, and add structures — a wreck, a thila, overhangs, swim-throughs — see buildSite().
let TER = { top: 3, slope: 0.09, max: 14, sand: 0 };
const carves = [], structs = [];
const edgeX = z => 5 * Math.sin(z * 0.011) + 6 * fbm(z * 0.02, 3.1);
const flatK = (x, z) => { const f = TER.flat; if (!f) return 1; const q = ((x - f.x) / f.rx) ** 2 + ((z - f.z) / f.rz) ** 2; return 1 - 0.85 * (1 - smooth(0.5, 1, q)); };   // smooth sand under a wreck
const plateau = (x, z) => TER.top + Math.min(TER.max, Math.max(0, edgeX(z) - x) * TER.slope) + (1.4 * fbm(x * 0.05, z * 0.05) + 0.6 * fbm(x * 0.21, z * 0.21)) * flatK(x, z);
const topDepth = z => plateau(edgeX(z), z);
const wallRough = (d, z, top) => clamp((d - top) / 4, 0, 1) * (0.45 * vnoise(z * 0.6, d * 0.6) + 0.18 * vnoise(z * 2.2, d * 2.2));   // ledges & knobs
const wallRaw = (d, z) => { const top = topDepth(z); return edgeX(z) + (4 * Math.sin(d * 0.017 + z * 0.013) + 3 * fbm(d * 0.04, z * 0.04) + 1.3 * fbm(d * 0.17, z * 0.17)) * clamp((d - top) / 12, 0, 1) + wallRough(d, z, top); };
function carveAt(d, z) {   // how far a cave pocket cuts back into the wall here: steep sides, a rounded back
  let c = 0;
  for (const k of carves) { const a = (z - k.z) / k.rz, b = (d - k.d) / k.rd, q = a * a + b * b; if (q < 1) c = Math.max(c, k.depth * Math.pow(1 - q, 0.45)); }
  return c;
}
const wallX = (d, z) => wallRaw(d, z) - (carves.length ? carveAt(d, z) : 0);
function pushOut(p, m) { // keep a point out of the rock (and out of wrecks and other structures)
  const d = -p.y, z = p.z, e = edgeX(z);
  if (p.x < e + 25) {
    const top = topDepth(z);
    if (d <= top) { if (p.x < e) { const pd = plateau(p.x, z); if (d > pd - m) p.y = -(pd - m); } }
    else {
      const wx = wallX(d, z);
      if (p.x < wx + m) {
        const pd = p.x < e ? plateau(p.x, z) : top;
        if (d > pd - m) { if (wx + m - p.x < d - (pd - m)) p.x = wx + m; else p.y = -(pd - m); }
      }
    }
  }
  for (const st of structs) if (p.x > st.lo.x - m && p.x < st.hi.x + m && p.y > st.lo.y - m && p.y < st.hi.y + m && p.z > st.lo.z - m && p.z < st.hi.z + m) st.push(p, m);
  if (-p.y > FLOOR - m) p.y = -(FLOOR - m);
  if (p.y > -0.3) p.y = -0.3;
}

// ---------- renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2596bf, 0.02);
scene.background = new Color();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 600);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Bloom is optional: if the add-ons fail to load we simply render without it.
let composer = null, bloom = null;
try {
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all(['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass'].map(n => import(`${CDN}/examples/jsm/postprocessing/${n}.js/+esm`)));
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.5, 0.82); composer.addPass(bloom); composer.addPass(new OutputPass());
} catch { composer = null; }
const renderFrame = () => (composer && settings.bloom ? composer.render() : renderer.render(scene, camera));
function resize() { renderer.setSize(innerWidth, innerHeight, false); composer?.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// environment map: a bright surface above, blue water around, dark below — gives metal, glass, wet skin and scales real reflections
{
  const g = new THREE.SphereGeometry(10, 48, 24), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; const c = new Color(y > 0.75 ? '#ffffff' : y > 0 ? mix('#2a9ac8', '#dff6ff', (y / 0.75) ** 2) : mix('#2a9ac8', '#03101c', Math.min(1, -y * 1.6))); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.02).texture;
}
const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x203040, 1);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.5);
const torch = new THREE.SpotLight(0xfff0dd, 0, 55, 0.45, 0.6, 1.4);
const diverLamp = new THREE.PointLight(0xfff0dd, 0, 7, 1);
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
scene.add(hemi, sun, sun.target, torch, torch.target, diverLamp);

// ---------- geometry helpers ----------
const _e = new Euler(), _q = new Quaternion(), _v = new Vector3(), _v2 = new Vector3();
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { _e.set(rx, ry, rz, 'XYZ'); return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(_e), new Vector3(sx, sy, sz)); }
const patchUV = i => [504 / 512, 1 - (i * 16 + 8) / 320];  // 0 white 1 black 2 fin 3 tail 4 belly 5 accent 6 main 7 glow 8 iris
const BODY_UV = (u, v) => [u * 0.96, 0.2 + 0.8 * v];         // body texels sit above the fin bands
function part(g, { patch = null, m = null, w = 0, wFn = null, uvFn = null } = {}) {
  const flatFin = (patch === 2 || patch === 3) && g.type === 'ShapeGeometry';
  g = g.index ? g.toNonIndexed() : g;
  if (flatFin) finUV(g, patch === 3);
  else if (patch === null && !uvFn && g.attributes.uv) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, ...BODY_UV(u.getX(i), u.getY(i))); }
  if (m) g.applyMatrix4(m);
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position, n = pos.count;
  if (!flatFin && (patch !== null || uvFn || !g.attributes.uv)) {
    const a = new Float32Array(n * 2), [pu, pv] = patchUV(patch ?? 6);
    for (let i = 0; i < n; i++) { if (uvFn) { const [u, v] = uvFn(pos.getX(i), pos.getY(i), pos.getZ(i)); a[i * 2] = u; a[i * 2 + 1] = v; } else { a[i * 2] = pu; a[i * 2 + 1] = pv; } }
    g.setAttribute('uv', new THREE.BufferAttribute(a, 2));
  }
  const aw = new Float32Array(n); for (let i = 0; i < n; i++) aw[i] = wFn ? wFn(pos.getX(i), pos.getY(i), pos.getZ(i)) : w;
  g.setAttribute('aW', new THREE.BufferAttribute(aw, 1));
  return g;
}
// fins map onto a band of ray texture: rays run from the base (nearest the body axis, or the tail root) out to the edge
function finUV(g, tail) {
  const p = g.attributes.position, n = p.count, a = new Float32Array(n * 2);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, r0 = 1e9, r1 = -1e9;
  for (let i = 0; i < n; i++) { const x = p.getX(i), y = p.getY(i); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); r0 = Math.min(r0, Math.abs(y)); r1 = Math.max(r1, Math.abs(y)); }
  const [top, bot] = tail ? [0.098, 0.004] : [0.198, 0.104];
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i);
    const along = tail ? (x1 - x) / Math.max(1e-6, x1 - x0) : (Math.abs(y) - r0) / Math.max(1e-6, r1 - r0);
    const across = tail ? (y - y0) / Math.max(1e-6, y1 - y0) : (x - x0) / Math.max(1e-6, x1 - x0);
    a[i * 2] = across * 0.96; a[i * 2 + 1] = top - along * (top - bot);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(a, 2));
}
function merge(parts) {
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), W = new Float32Array(n);
  let o = 0;
  for (const p of parts) { const c = p.attributes.position.count; P.set(p.attributes.position.array, o * 3); N.set(p.attributes.normal.array, o * 3); U.set(p.attributes.uv.array, o * 2); W.set(p.attributes.aW.array, o); o += c; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('aW', new THREE.BufferAttribute(W, 1));
  g.computeBoundingSphere(); return g;
}
// a body swept along x: t 0→1 from nose to tail; u follows t, v goes round (belly at v = 0.5)
function loft(n, m, fx, fh, fw, fy = () => 0, pinch = 0, th0 = 0, th1 = Math.PI * 2) {   // pinch > 0 narrows the section toward the top and bottom (a fish's keeled back and belly); th0..th1 lofts only part of the way round
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = fx(t), h = fh(t), w = fw(t), y0 = fy(t);
    for (let j = 0; j <= m; j++) { const th = th0 + j / m * (th1 - th0), sn = Math.sin(th); pos.push(x, y0 + Math.cos(th) * h, sn * w * Math.pow(Math.abs(sn), pinch)); uv.push(t, th / (Math.PI * 2)); }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
function shape(pts) { const s = new THREE.Shape(); s.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) s.lineTo(pts[i], pts[i + 1]); return new THREE.ShapeGeometry(s); }
const sphere = (seg = 10) => new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.7 | 0));
function limb(from, dir, len, r0, r1, patch, seg = 5) { // tapered cylinder from a point along a direction; aW = 0 at base → 1 at tip
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 4); g.translate(0, len / 2, 0);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize())); g.translate(from.x, from.y, from.z);
  return part(g, { patch, wFn: (x, y, z) => clamp(_v.set(x, y, z).sub(from).length() / len, 0, 1) });
}
function eyes(P, x, y, z, r, white = true) {
  for (const s of [-1, 1]) {
    if (white) {   // a dark socket rim, a coloured iris set flush into the head and a black pupil (both glossy, see makeRM)
      P.push(part(sphere(12), { patch: 1, m: M(x, y, s * z * 0.86, 0, 0, 0, r * 1.12, r * 1.12, r * 0.5) }));
      P.push(part(sphere(14), { patch: 8, m: M(x, y, s * z * 0.9, 0, 0, 0, r, r, r * 0.55) }));
      P.push(part(sphere(10), { patch: 1, m: M(x + r * 0.05, y, s * (z * 0.9 + r * 0.3), 0, 0, 0, r * 0.5, r * 0.5, r * 0.3) }));
    } else P.push(part(sphere(10), { patch: 1, m: M(x + r * 0.1, y, s * (z + r * 0.1), 0, 0, 0, r) }));
  }
}
// flutter: the fin's aW runs 1 at the base → ~2 at the tip, so the fish shader can scull it (bony fish hover and steer with their pectorals)
function pectorals(P, x, y, z, len, patch, down = 0.35, flutter = false) {
  const L = len, g = () => flutter ? shape([0.025, 0, 0.005, 0.05 * L, -0.1 * L, 0.1 * L, -0.24 * L, 0.09 * L, -0.3 * L, 0.05 * L, -0.24 * L, 0.012 * L, -0.02, 0]) : shape([0.04, 0, -0.05, 0, -0.1 * L, 0.16 * L]);
  const wFn = flutter ? (px, py, pz) => 1 + clamp(Math.hypot(px - x, py - y, Math.abs(pz) - z) / (0.3 * L), 0, 0.99) : null;
  P.push(part(g(), { patch, wFn, m: M(x, y, z, Math.PI / 2 + down, 0, 0) }));
  P.push(part(g(), { patch, wFn, m: M(x, y, -z, -(Math.PI / 2 + down), 0, 0) }));
}

// ---------- body builders (unit length along x, nose at +x) ----------
function tailShape(kind, Ht) {
  if (kind === 'round') { const s = new THREE.Shape(); s.moveTo(-0.28, 0.03); s.quadraticCurveTo(-0.52, Ht, -0.5, 0); s.quadraticCurveTo(-0.52, -Ht, -0.28, -0.03); return new THREE.ShapeGeometry(s); }
  if (kind === 'lunate') { const s = new THREE.Shape(); s.moveTo(-0.28, 0.02); s.quadraticCurveTo(-0.38, Ht * 0.6, -0.52, Ht * 1.15); s.quadraticCurveTo(-0.42, 0, -0.52, -Ht * 1.15); s.quadraticCurveTo(-0.38, -Ht * 0.6, -0.28, -0.02); return new THREE.ShapeGeometry(s); }
  const L = kind === 'lyre' ? 0.6 : 0.5, k = kind === 'lyre' ? 1.25 : 1;
  return shape([-0.28, 0.03, -L, Ht * k, -0.43, 0, -L, -Ht * k, -0.28, -0.03]);
}
const BUILD = {
  fish(sp) {
    const f = sp.f || {}, H = f.h || 0.4, P = [], rat = !!f.rattail, x1 = rat ? -0.5 : -0.3;
    const wr = f.w || (H > 0.55 ? 0.3 : H < 0.22 ? 0.66 : 0.44);
    // separate back and belly outlines: the forehead climbs steeply from a low snout to the dorsal origin, the belly is fuller and flatter,
    // and the body narrows to a slim caudal peduncle before flaring slightly into the tail
    const tm = H > 0.55 ? 0.42 : 0.38, ped = rat ? 0.03 : f.box ? 0.3 : 0.14, snout = f.box ? 2.6 : f.snout ?? (H > 0.55 ? 1.7 : 2);
    const rise = (t, m, e) => { const u = clamp(t / m, 0, 1); return Math.pow(1 - Math.pow(1 - u, snout), e); };
    const fall = t => { const v = clamp((t - tm) / (0.96 - tm), 0, 1); return 1 - (1 - ped) * Math.pow(v, rat ? 0.9 : 1.15) + (rat ? 0 : 0.06 * smooth(0.93, 1, t)); };
    const hump = t => f.hump ? f.hump * 0.1 * H * Math.exp(-(((t - 0.1) / 0.1) ** 2)) : 0;
    const upper = t => H / 2 * (t < tm ? rise(t, tm, 0.95) : fall(t)) * 1.06 + hump(t), lower = t => H / 2 * (t < tm ? rise(t, tm, 1.3) : fall(t)) * 0.94;   // a straight forehead line down to a pointed snout
    const fh = t => (upper(t) + lower(t)) / 2, fy = t => (upper(t) - lower(t)) / 2, fw = t => Math.max(0.003, fh(t) * wr * (f.box ? 1.6 : 1) * (1 + 0.12 * (1 - smooth(0, 0.3, t))));
    const tOf = x => clamp((0.5 - x) / (0.5 - x1), 0, 1), top = x => fy(tOf(x)) + fh(tOf(x)), bot = x => fy(tOf(x)) - fh(tOf(x));
    P.push(part(loft(36, 28, t => 0.5 - t * (0.5 - x1), fh, fw, fy, f.box || f.blob ? 0 : 0.35)));
    if (!f.lobed && !f.tripod) for (const s of [-1, 1]) P.push(part(shape([0.03, 0, -0.1, 0, -0.08, -Math.max(0.05, H * 0.28)]), { patch: 2, m: M(0.1, bot(0.1) * 0.85, s * fw(tOf(0.1)) * 0.35, s * 0.35, 0, 0) }));
    if (!rat) P.push(part(tailShape(f.tail || 'fork', Math.max(0.09, H * 0.55)), { patch: 3 }));
    const d = f.dorsal;
    const contourFin = (xa, xb, hmax, below, peak = 0.6, spiny = false) => {   // fin whose base follows the body outline
      const pts = [], N = spiny ? 40 : 14;
      for (let i = 0; i <= N; i++) { const x = lerp(xa, xb, i / N); pts.push(x, below ? bot(x) * 0.9 : top(x) * 0.9); }
      for (let i = N; i >= 0; i--) {
        const u = i / N, x = lerp(xa, xb, u) - hmax * 0.25 * u;
        let k = Math.pow(u < peak ? Math.sin(u / peak * Math.PI / 2) : Math.cos((u - peak) / (1 - peak) * Math.PI / 2), 0.7);
        if (spiny) { const v = (u - 0.48) / 0.52; k = u < 0.48 ? (0.35 + 0.4 * Math.sin(u / 0.48 * Math.PI / 2)) * (i % 2 ? 0.8 : 1.06) : 0.3 + 0.72 * Math.sin(Math.PI * Math.pow(Math.max(0, v), 0.75)) * (1 - 0.3 * v); }   // spine tips poke out of the membrane, a notch, then the rounded soft rays
        pts.push(x, below ? bot(x) - hmax * k : top(x) + hmax * k);
      }
      return part(shape(pts), { patch: 2 });
    };
    if (d === 'spiky') {
      for (let i = 0; i < 9; i++) { const x = 0.25 - i * 0.055; P.push(part(shape([x + 0.012, top(x) * 0.9, x - 0.012, top(x) * 0.9, x - 0.03, top(x) + H * 1.2]), { patch: i % 2 ? 4 : 5 })); }
      const fan = () => shape([0, 0, -0.32, 0.2, -0.42, 0.02, -0.34, -0.16]);
      P.push(part(fan(), { patch: 4, m: M(0.16, bot(0.16) * 0.3, fh(0.3) * wr * 0.8, 1.2, 0, -0.2) }), part(fan(), { patch: 4, m: M(0.16, bot(0.16) * 0.3, -fh(0.3) * wr * 0.8, -1.2, 0, -0.2) }));
    } else if (d === 'sail') P.push(part(shape([0.32, top(0.32) * 0.9, -0.26, top(-0.26) * 0.8, -0.1, top(0) + H * 1.6, 0.2, top(0) + H * 1.5]), { patch: 2 }));
    else if (d === 'tall') P.push(part(shape([0.3, top(0.3) * 0.9, 0.14, top(0.14) * 0.9, 0.2, top(0.2) + H * 1.3]), { patch: 2 }));
    else if (d === 'long') P.push(part(shape([0.36, top(0.36) * 0.9, 0.3, top(0.3) + H * 0.3, -0.26, top(-0.26) + H * 0.15, -0.28, top(-0.28) * 0.8]), { patch: 2 }));
    else if (d === 'streamer') P.push(part(shape([0.12, top(0.12) * 0.9, 0.02, top(0.02) * 0.9, -0.6, top(0) + H * 1.1]), { patch: 0 }), part(shape([0.12, bot(0.12) * 0.9, -0.2, bot(-0.2) * 0.8, -0.1, bot(0) - H * 0.5]), { patch: 5 }));
    else if (d === 'bat') P.push(part(shape([0.2, top(0.2) * 0.9, -0.26, top(-0.26) * 0.8, -0.2, top(0) + H * 0.9]), { patch: 2 }), part(shape([0.1, bot(0.1) * 0.9, -0.26, bot(-0.26) * 0.8, -0.2, bot(0) - H * 0.9]), { patch: 2 }));
    else if (!rat || f.blob) {
      if (H >= 0.33) P.push(contourFin(0.22, -0.27, H * (H > 0.6 ? 0.3 : 0.38), false, 0.7, true));          // reef fish: long spiny + soft dorsal
      else P.push(contourFin(0.14, -0.04, H * 0.55, false, 0.35), contourFin(-0.12, -0.24, H * 0.3, false, 0.4)); // streamlined: two dorsals
    }
    if (!rat && !['bat', 'streamer', 'spiky'].includes(d)) P.push(contourFin(H >= 0.33 ? 0.02 : -0.1, -0.26, H * (H > 0.6 ? 0.26 : H >= 0.33 ? 0.22 : 0.3), true, 0.55));
    if (d !== 'spiky') pectorals(P, 0.2, lerp(bot(0.2), top(0.2), 0.3), fw(tOf(0.2)) * 0.95, Math.max(0.5, H * 1.4), 2, 1.2, true);   // fanned back along the flank
    const ex = rat ? 0.4 : 0.36, et = tOf(ex), er = Math.max(0.013, H * 0.075) * (f.eyeBig ? 1.6 : 1);
    if (f.dome) for (const s of [-1, 1]) P.push(part(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 8), { patch: 5, m: M(0.36, top(0.36), s * 0.018) }));
    else eyes(P, ex, fy(et) + fh(et) * 0.3, fw(et) * 0.85, er);
    if (f.teeth) for (let i = 0; i < 4; i++) { const long = f.teeth === 2, x = 0.47 - i * 0.025; P.push(part(new THREE.ConeGeometry(H * (long ? 0.04 : 0.025), H * (long ? 0.55 : 0.14), 4), { patch: 0, m: M(x, (long ? -1 : 1) * H * 0.02, (i % 2 ? 1 : -1) * fw(tOf(x)) * 0.6, long ? 0 : Math.PI, 0, 0) })); }
    if (f.lure) { const a = new Vector3(0.35, top(0.35), 0), b = new Vector3(0.6, top(0.35) + 0.2, 0); P.push(limb(a, b.clone().sub(a), a.distanceTo(b), 0.006, 0.004, 2)); P.push(part(sphere(8), { patch: 7, m: M(b.x, b.y, 0, 0, 0, 0, 0.035) })); }
    if (f.bill) P.push(part(new THREE.ConeGeometry(H * 0.06, 0.4, 6), { patch: 6, m: M(0.68, 0, 0, 0, 0, -Math.PI / 2) }));
    if (f.tripod) { P.push(limb(new Vector3(0.05, bot(0.05), 0.02), new Vector3(0.05, -1, 0.05), 0.45, 0.006, 0.004, 4), limb(new Vector3(0.05, bot(0.05), -0.02), new Vector3(0.05, -1, -0.05), 0.45, 0.006, 0.004, 4), limb(new Vector3(-0.45, 0, 0), new Vector3(-0.05, -1, 0), 0.45, 0.006, 0.004, 4)); }
    if (f.lobed) for (const [x, y, z, rx] of [[0.14, bot(0.14) * 0.6, 1, 0.5], [0.14, bot(0.14) * 0.6, -1, -0.5], [-0.02, bot(-0.02), 0.6, 0.3], [-0.02, bot(-0.02), -0.6, -0.3], [-0.2, top(-0.2), 0, 0], [-0.2, bot(-0.2), 0, 0]]) P.push(part(sphere(8), { patch: 6, m: M(x, y, z * fw(tOf(x)), rx, 0, 0, 0.07, 0.03, 0.015) }));
    if (f.spines) { const R = rng(hash(sp.id)); for (let i = 0; i < 50; i++) { const t = 0.1 + R() * 0.75, th = R() * Math.PI * 2, n = new Vector3(0, Math.cos(th), Math.sin(th)); const p = new Vector3(0.5 - t * 0.8, fy(t) + Math.cos(th) * fh(t), Math.sin(th) * fw(t)); const g = new THREE.ConeGeometry(0.008, 0.05, 4); g.translate(0, 0.025, 0); g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), n)); g.translate(p.x, p.y, p.z); P.push(part(g, { patch: 5 })); } }
    if (f.blob) P.push(part(sphere(8), { patch: 4, m: M(0.47, -H * 0.12, 0, 0, 0, 0, 0.06, 0.08, 0.05) }));
    return { P, mode: 1, amp: 0.05 };
  },
  shark(sp) {
    const f = sp.f || {}, P = [], H = f.h || (f.whale ? 0.12 : 0.1), longT = f.thresher || f.zebra, x1 = longT ? -0.02 : -0.3;
    const wr = f.wobbe ? 2.4 : f.whale || f.mega ? 1.15 : 0.85;
    const prof = t => t < 0.33 ? Math.pow(Math.sin(t / 0.33 * Math.PI / 2), f.hammer || f.whale || f.wobbe ? 0.35 : 0.6) : 1 - 0.88 * Math.pow((t - 0.33) / 0.67, 1.3);
    const fh = t => H / 2 * prof(t), fw = t => H / 2 * prof(t) * wr * (f.whale && t < 0.3 ? 1.2 : 1), tOf = x => clamp((0.5 - x) / (0.5 - x1), 0, 1);
    P.push(part(loft(32, 20, t => 0.5 - t * (0.5 - x1), fh, fw)));
    if (f.thresher) P.push(part(shape([x1 + 0.02, H * 0.05, -0.52, H * 0.4, -0.48, H * 0.2, x1 - 0.05, -H * 0.1, x1 - 0.02, -H * 0.55, x1 + 0.02, -H * 0.05]), { patch: 3 }));
    else if (f.zebra) P.push(part(shape([x1 + 0.02, H * 0.35, -0.5, 0.01, x1 + 0.02, -H * 0.25]), { patch: 3 }));
    else P.push(part(shape([x1 + 0.02, 0.012, -0.5, H * (f.wobbe ? 0.4 : 1.35), -0.42, 0, -0.44, -H * (f.wobbe ? 0.2 : 0.7), x1 + 0.02, -0.012]), { patch: 3 }));
    const dx = f.nurse ? -0.1 : 0.04, ty = fh(tOf(dx)) * 0.9, ay = ty + H * (f.tall ? 1.7 : f.nurse ? 0.5 : f.wobbe ? 0.3 : 1.05);
    P.push(part(shape([dx + 0.06, ty, dx - 0.09, ty, dx - 0.06, ay]), { patch: 2 }));
    if (f.tips) for (const s of [-1, 1]) P.push(part(shape([dx - 0.04, ay - H * 0.3, dx - 0.075, ay - H * 0.25, dx - 0.06, ay + 0.002]), { patch: 5, m: M(0, 0, s * 0.002) }));
    if (!f.sixgill) P.push(part(shape([-0.17, fh(tOf(-0.2)) * 0.9, -0.25, fh(tOf(-0.2)) * 0.8, -0.24, fh(tOf(-0.2)) + H * 0.35]), { patch: 2 }));
    const pf = f.longFins ? 1.9 : f.whale ? 1.3 : f.wobbe ? 0.7 : 1;
    pectorals(P, 0.22, -fh(tOf(0.22)) * 0.45, fw(tOf(0.22)) * 0.6, pf, 2, f.wobbe ? 0 : 0.35);
    for (let i = 0; i < (f.sixgill ? 6 : 5) && !f.wobbe; i++) { const x = 0.33 - i * 0.018, t = tOf(x); for (const s of [-1, 1]) P.push(part(new THREE.BoxGeometry(0.003, fh(t) * 0.9, 0.002), { patch: 1, m: M(x, 0, s * fw(t) * 0.97) })); }
    if (f.hammer) { P.push(part(new THREE.BoxGeometry(0.07, H * 0.22, H * 3.2), { patch: 6, m: M(0.47, 0, 0) })); for (const s of [-1, 1]) P.push(part(sphere(8), { patch: 1, m: M(0.47, 0, s * H * 1.6, 0, 0, 0, H * 0.08) })); }
    else for (const s of [-1, 1]) P.push(part(sphere(8), { patch: 1, m: M(0.41, fh(tOf(0.41)) * 0.2, s * fw(tOf(0.41)) * 0.85, 0, 0, 0, H * (f.eyeBig ? 0.12 : 0.055)) }));
    if (f.goblin) P.push(part(new THREE.ConeGeometry(H * 0.18, 0.15, 8), { patch: 6, m: M(0.56, H * 0.15, 0, 0, 0, -Math.PI / 2, 1, 1, 0.4) }));
    if (f.mega || f.whale) P.push(part(new THREE.BoxGeometry(0.02, H * 0.08, fw(0.05) * 1.8), { patch: 1, m: M(0.485, -H * 0.12, 0) }));
    if (f.wobbe) for (let i = 0; i < 12; i++) P.push(part(new THREE.ConeGeometry(0.006, 0.04, 4), { patch: 5, m: M(0.48 - (i >> 1) * 0.02, -H * 0.2, (i % 2 ? 1 : -1) * fw(tOf(0.45 - (i >> 1) * 0.02)), 0, 0, Math.PI) }));
    return { P, mode: 1, amp: f.wobbe ? 0.01 : 0.045 };
  },
  ray(sp) {
    const f = sp.f || {}, P = [], xn = f.sting ? 0.3 : 0.28, xt = f.sting ? -0.3 : -0.26;
    const wz = t => 0.5 * (f.sting ? Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) : t < 0.42 ? Math.sin(t / 0.42 * Math.PI / 2) ** 0.9 : 1 - ((t - 0.42) / 0.58) ** 0.7);
    const hy = t => 0.045 * Math.sqrt(Math.max(0.02, Math.sin(Math.PI * t)));
    P.push(part(loft(20, 20, t => xn - t * (xn - xt), hy, t => Math.max(0.004, wz(t)))));
    const tl = f.eagle ? 1.1 : f.sting ? 0.55 : 0.3;
    P.push(part(new THREE.CylinderGeometry(0.004, 0.009, tl, 5), { patch: f.sting ? 5 : 6, m: M(xt - tl / 2 + 0.02, 0, 0, 0, 0, Math.PI / 2) }));
    if (f.manta) for (const s of [-1, 1]) P.push(part(new THREE.BoxGeometry(0.1, 0.008, 0.035), { patch: 6, m: M(xn + 0.02, -0.01, s * 0.09, 0, s * 0.25, 0) }));
    if (f.eagle) P.push(part(sphere(10), { patch: 6, m: M(xn + 0.02, 0, 0, 0, 0, 0, 0.08, 0.035, 0.06) }));
    for (const s of [-1, 1]) P.push(part(sphere(6), { patch: 1, m: M(xn - 0.05, 0.03, s * 0.07, 0, 0, 0, 0.012) }));
    return { P, mode: 3, amp: f.manta ? 0.35 : f.eagle ? 0.4 : 0.08 };
  },
  turtle(sp) {   // heart-shaped domed carapace over a flat plastron, a scaly head with a beak, long swept-back front flippers
    const P = [], hawk = !!sp.f?.hawk, x0 = 0.38, x1 = -0.44;
    const wd = t => 0.34 * Math.pow(Math.sin(Math.PI * clamp(Math.pow(t, 0.85), 0, 1)), 0.55), ht = t => 0.12 * Math.pow(Math.sin(Math.PI * t), 0.6), hb = t => 0.035 * Math.pow(Math.sin(Math.PI * t), 0.4);
    P.push(part(loft(24, 26, t => x0 - t * (x0 - x1), t => (ht(t) + hb(t)) / 2, t => Math.max(0.004, wd(t)), t => (ht(t) - hb(t)) / 2)));
    P.push(part(new THREE.CylinderGeometry(0.045, 0.06, 0.12, 10), { patch: 2, m: M(0.41, 0, 0, 0, 0, Math.PI / 2 - 0.12) }));           // neck
    P.push(part(sphere(14), { patch: 2, m: M(0.5, 0.012, 0, 0, 0, -0.1, hawk ? 0.1 : 0.085, 0.052, 0.06) }));                          // head
    P.push(part(new THREE.ConeGeometry(0.025, hawk ? 0.07 : 0.045, 8), { patch: 1, m: M(hawk ? 0.61 : 0.595, -0.008, 0, 0, 0, -Math.PI / 2 - 0.35, 1, 1, 0.8) }));   // beak
    eyes(P, 0.54, 0.03, 0.05, 0.013, false);
    const front = () => shape([0.05, 0, 0.03, 0.08, -0.04, 0.24, -0.15, 0.4, -0.2, 0.45, -0.17, 0.36, -0.09, 0.18, -0.05, 0]);
    const rear = () => shape([0.03, 0, 0.0, 0.08, -0.07, 0.12, -0.12, 0.08, -0.08, 0]);
    for (const s of [-1, 1]) {
      P.push(part(front(), { patch: 2, w: 1, m: M(0.22, -0.01, s * 0.26, s * Math.PI / 2, 0, 0) }));
      P.push(part(rear(), { patch: 2, w: 2, m: M(-0.34, -0.005, s * 0.12, s * Math.PI / 2, 0, 0) }));
    }
    return { P, mode: 7, amp: 0.9 };
  },
  whale(sp) {
    const f = sp.f || {}, P = [], x1 = -0.4;
    const H = f.sperm ? 0.2 : f.dugong ? 0.22 : f.orca || f.sealion ? 0.2 : f.dolphin || f.humpback ? 0.17 : 0.12;
    const prof = t => f.sperm ? (t < 0.3 ? Math.pow(Math.min(1, t / 0.04), 0.3) : 1 - 0.85 * ((t - 0.3) / 0.7) ** 1.3) : t < 0.3 ? Math.pow(Math.sin(t / 0.3 * Math.PI / 2), 0.5) : 1 - 0.88 * ((t - 0.3) / 0.7) ** 1.4;
    const fh = t => H / 2 * prof(t), fw = t => fh(t) * 0.9, tOf = x => clamp((0.5 - x) / (0.5 - x1), 0, 1);
    P.push(part(loft(22, 16, t => 0.5 - t * (0.5 - x1), fh, fw)));
    if (f.sealion) for (const s of [-1, 1]) P.push(part(shape([x1, 0, -0.52, 0.06, -0.5, -0.04]), { patch: 2, m: M(0, 0, s * 0.03, Math.PI / 2, 0, 0) }));
    else P.push(part(shape([x1 + 0.02, 0.02, -0.52, H * (f.dugong ? 0.9 : 1.1), -0.47, 0, -0.52, -H * (f.dugong ? 0.9 : 1.1), x1 + 0.02, -0.02]), { patch: 3, m: M(0, 0, 0, Math.PI / 2, 0, 0) }));
    const ty = x => fh(tOf(x)) * 0.92;
    if (f.dolphin || f.orca) P.push(part(shape([0.04, ty(0.04), -0.1, ty(-0.1), -0.08, ty(0) + H * (f.orca ? 1.2 : 0.55)]), { patch: 2 }));
    else if (f.blue || f.humpback || f.sperm) P.push(part(shape([-0.15, ty(-0.15), -0.22, ty(-0.22), -0.21, ty(-0.18) + H * 0.25]), { patch: 2 }));
    const pl = f.humpback ? 2.1 : f.sealion ? 1.3 : f.orca ? 0.9 : f.sperm ? 0.45 : 0.7;
    pectorals(P, 0.28, -fh(tOf(0.28)) * 0.5, fw(tOf(0.28)) * 0.7, pl, f.humpback ? 4 : 2, 0.5);
    if (f.dolphin) P.push(part(new THREE.CylinderGeometry(H * 0.1, H * 0.14, 0.08, 8), { patch: 6, m: M(0.53, -H * 0.12, 0, 0, 0, Math.PI / 2) }));
    for (const s of [-1, 1]) P.push(part(sphere(6), { patch: 1, m: M(f.sperm ? 0.2 : 0.4, f.sperm ? -H * 0.2 : 0, s * fw(tOf(f.sperm ? 0.2 : 0.4)) * 0.9, 0, 0, 0, H * 0.05) }));
    return { P, mode: 2, amp: 0.06 };
  },
  eel(sp) {
    const f = sp.f || {}, P = [];
    if (f.moray) return BUILD.moray(sp);
    const R = f.moray ? 0.045 : f.frilled ? 0.05 : f.gulper ? 0.028 : f.oar ? 0.05 : f.garden ? 0.03 : 0.028;
    const fh = t => R * (f.gulper ? (t < 0.12 ? 2.5 : 1 - t * 0.9) : f.oar ? 1 - t * 0.7 : 1 - t * 0.6) * (t < 0.04 ? Math.sqrt(t / 0.04) : 1);
    const fw = t => Math.max(0.002, fh(t) * (f.oar ? 0.25 : 1));
    P.push(part(loft(32, 10, t => 0.5 - t, fh, fw)));
    for (const s of [-1, 1]) P.push(part(sphere(6), { patch: f.garden ? 1 : 0, m: M(0.47, R * 0.35, s * fw(0.03) * 0.8, 0, 0, 0, R * 0.25) }));
    if (f.oar) { P.push(part(shape([0.5, R * 0.8, -0.5, R * 0.3, -0.5, R * 0.9, 0.45, R * 1.9]), { patch: 5 })); for (let i = 0; i < 6; i++) P.push(limb(new Vector3(0.46 - i * 0.012, R, 0), new Vector3(-0.3, 1, 0), R * (4 - i * 0.4), 0.004, 0.002, 5)); }
    if (f.frilled) for (let i = 0; i < 6; i++) P.push(part(new THREE.TorusGeometry(fh(0.1) * 1.02, 0.004, 4, 12), { patch: 5, m: M(0.4 - i * 0.012, 0, 0, 0, Math.PI / 2, 0) }));
    if (f.gulper) for (const s of [-1, 1]) P.push(part(shape([0.46, 0, 0.62, s * 0.06, 0.6, s * 0.01]), { patch: 6 }));
    if (f.moray) P.push(part(new THREE.BoxGeometry(0.05, 0.004, fw(0.03) * 1.6), { patch: 1, m: M(0.47, -R * 0.2, 0) }));
    if (f.garden) { const g = merge(P); g.applyMatrix4(M(0, 0.5, 0, 0, 0, Math.PI / 2)); return { geo: g, mode: 6, amp: 0.08 }; }
    return { P, mode: 4, amp: f.moray ? 0.02 : f.oar ? 0.03 : 0.05 };
  },
  moray(sp) {   // a moray: blunt head with a hump behind the eyes, a lower jaw that opens as it breathes, skin-covered fins running to the tail
    const H = 0.078, P = [], hump = t => H * 0.12 * Math.exp(-(((t - 0.13) / 0.07) ** 2));
    const fh = t => H / 2 * (t < 0.16 ? Math.pow(Math.sin(t / 0.16 * Math.PI / 2), 0.5) : 1 - 0.8 * Math.pow((t - 0.16) / 0.84, 1.7)) + hump(t) / 2;
    const fw = t => Math.max(0.002, fh(t) * (t < 0.2 ? 0.75 : 0.55)), fy = t => hump(t) / 2 + (t < 0.1 ? H * 0.06 * (1 - t / 0.1) : 0);
    const top = x => fy(0.5 - x) + fh(0.5 - x), bot = x => fy(0.5 - x) - fh(0.5 - x);
    // the head is lofted in three pieces split along the mouth line, so the lower jaw (aW 3, hinged at the corner of the mouth in the shader) can drop open
    const hx = t => 0.5 - t * 0.11, ht = t => fh(t * 0.11), wt = t => fw(t * 0.11), yt = t => fy(t * 0.11), ML = 0.55 * Math.PI;
    P.push(part(loft(10, 6, hx, ht, wt, yt, 0, 0, ML)), part(loft(10, 6, hx, ht, wt, yt, 0, 2 * Math.PI - ML, 2 * Math.PI)));
    P.push(part(loft(10, 10, hx, ht, wt, yt, 0, ML, 2 * Math.PI - ML), { w: 3 }));
    P.push(part(loft(34, 14, t => 0.39 - t * 0.89, t => fh(0.11 + t * 0.89), t => fw(0.11 + t * 0.89), t => fy(0.11 + t * 0.89)), { uvFn: null }));
    const mouth = x => fy(0.5 - x) + Math.cos(ML) * fh(0.5 - x);
    P.push(part(sphere(10), { patch: 1, m: M(0.44, mouth(0.44) - H * 0.02, 0, 0, 0, 0, 0.055, H * 0.13, fw(0.06) * 0.8) }));   // the dark inside of the mouth
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const x = 0.482 - i * 0.013, z = s * fw(0.5 - x) * 0.8;   // needle teeth on both jaws
      P.push(part(new THREE.ConeGeometry(0.003, 0.01, 4), { patch: 0, m: M(x, mouth(x) - 0.003, z, Math.PI, 0, 0) }), part(new THREE.ConeGeometry(0.003, 0.009, 4), { patch: 0, w: 3, m: M(x - 0.006, mouth(x) + 0.002, z * 0.95) })); }
    eyes(P, 0.455, fy(0.045) + fh(0.045) * 0.45, fw(0.045) * 0.9, H * 0.075);
    for (const s of [-1, 1]) P.push(limb(new Vector3(0.49, fy(0.01) + H * 0.05, s * fw(0.02) * 0.5), new Vector3(1, 0.4, s * 0.3), 0.012, 0.0022, 0.0016, 1, 5));   // tube nostrils
    for (const s of [-1, 1]) P.push(part(sphere(6), { patch: 1, m: M(0.365, 0, s * fw(0.135) * 0.98, 0, 0, 0, 0.008, H * 0.08, 0.003) }));   // small round gill opening
    const ridge = (x0, x1, h, below) => { const pts = [], N = 30; for (let i = 0; i <= N; i++) { const x = lerp(x0, x1, i / N); pts.push(x, below ? bot(x) * 0.9 : top(x) * 0.9); } for (let i = N; i >= 0; i--) { const x = lerp(x0, x1, i / N), k = Math.min(1, i / 4, (N - i) / 3 + 0.3); pts.push(x - 0.004, (below ? bot(x) - h * k : top(x) + h * k)); } return part(shape(pts), { patch: 6 }); };
    P.push(ridge(0.34, -0.5, H * 0.3, false), ridge(0.02, -0.5, H * 0.24, true));   // dorsal fin from behind the head, anal fin along the back half
    return { P, mode: 4, amp: 0.025 };
  },
  jelly(sp) {
    const f = sp.f || {}, P = [];
    if (f.comb) { P.push(part(sphere(16), { w: 1, m: M(0, 0, 0, 0, 0, 0, 0.35, 0.5, 0.35) })); return { P, mode: 5, amp: 0, transparent: 0.5 }; }
    if (f.mow) {
      P.push(part(sphere(14), { w: 1, m: M(0, 0.1, 0, 0, 0, 0, 0.5, 0.18, 0.18) }), part(shape([-0.35, 0.2, 0.3, 0.2, 0.2, 0.35, -0.3, 0.32]), { patch: 5 }));
      for (let i = 0; i < 10; i++) { const g = limb(new Vector3((i / 9 - 0.5) * 0.6, 0, (i % 2 - 0.5) * 0.08), new Vector3(0, -1, 0), 2.5 + (i % 3), 0.01, 0.004, 5); g.attributes.aW.array.fill(2); P.push(g); }
      return { P, mode: 5, amp: 0, transparent: 0.75 };
    }
    const flat = f.moon ? 0.35 : f.mane || f.atolla ? 0.6 : f.box ? 1.3 : 1;
    const pts = [[0.001, 0.3], [0.2, 0.28], [0.36, 0.2], [0.46, 0.09], [0.5, 0], [0.47, -0.02]].map(([x, y]) => new THREE.Vector2(x, y * flat));
    P.push(part(new THREE.LatheGeometry(pts, f.box ? 4 : 24), { w: 1 }));
    const n = f.mane ? 40 : f.moon ? 48 : f.atolla ? 16 : f.box ? 16 : 10, len = f.mane ? 4 : f.moon ? 0.1 : f.atolla ? 0.7 : f.box ? 4 : 1.4;
    const tent = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = f.box ? 0.45 : 0.46; tent.push(limb(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), new Vector3(0, -1, 0), len * (0.8 + (i % 3) * 0.1), 0.006, 0.002, 5, 3)); }
    if (f.mane || f.moon) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; tent.push(limb(new Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05), new Vector3(Math.cos(a) * 0.15, -1, Math.sin(a) * 0.15), f.mane ? 1.5 : 0.35, 0.05, 0.02, 4, 4)); }
    for (const g of tent) { g.attributes.aW.array.fill(2); P.push(g); }
    return { P, mode: 5, amp: 0, transparent: f.atolla ? 0 : 0.55 };
  },
  squid(sp) {
    const f = sp.f || {}, P = [], big = sp.id === 'giant_squid';
    const mL = f.vampire ? 0.4 : f.bigfin ? 0.12 : big ? 0.22 : 0.45, xm = 0.5 - mL, H = f.vampire ? 0.3 : f.bigfin ? 0.08 : big ? 0.07 : 0.14;
    const r = t => H / 2 * (t < 0.2 ? Math.sqrt(t / 0.2) * 0.55 : 0.55 + 0.45 * (t - 0.2) / 0.8);
    P.push(part(loft(16, 12, t => 0.5 - t * mL, r, r)));
    const fs = f.bigfin ? 3 : f.vampire ? 0.8 : 1;
    for (const s of [-1, 1]) P.push(part(shape([0.5, 0, 0.5 - mL * 0.45 * Math.min(fs, 1.5), 0, 0.5 - mL * 0.3, H * 0.8 * fs]), { patch: 2, m: M(0, 0, 0, s * Math.PI / 2, 0, 0) }));
    P.push(part(sphere(10), { m: M(xm, 0, 0, 0, 0, 0, 0.05, H * 0.42, H * 0.42) }));
    for (const s of [-1, 1]) P.push(part(sphere(8), { patch: 1, m: M(xm, 0, s * H * 0.35, 0, 0, 0, Math.max(0.012, H * (big ? 0.35 : 0.2))) }));
    const armL = f.bigfin ? 0.85 : big ? 0.33 : f.vampire ? 0.35 : 0.3;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.push(limb(new Vector3(xm - 0.03, 0, 0), new Vector3(-1, Math.cos(a) * (f.bigfin ? 1.5 : 0.15), Math.sin(a) * 0.15), armL, H * 0.12, 0.002, 4)); }
    if (big || sp.id === 'humboldt_squid') for (const s of [-1, 1]) P.push(limb(new Vector3(xm - 0.03, 0, s * 0.01), new Vector3(-1, 0, s * 0.05), big ? 0.72 : 0.4, 0.006, 0.004, 4));
    if (f.vampire) P.push(part(new THREE.ConeGeometry(0.2, 0.3, 12, 1, true), { patch: 6, m: M(xm - 0.15, 0, 0, 0, 0, Math.PI / 2), wFn: x => clamp((xm - x) / 0.3, 0, 1) }));
    return { P, mode: 8, amp: 0.06 };
  },
  octopus(sp) {
    const f = sp.f || {}, P = [];
    P.push(part(sphere(14), { m: M(0.2, 0.04, 0, 0, 0, -0.3, f.dumbo ? 0.22 : 0.26, f.dumbo ? 0.22 : 0.19, f.dumbo ? 0.22 : 0.19) }));
    P.push(part(sphere(10), { m: M(0.02, 0, 0, 0, 0, 0, 0.12, 0.11, 0.13) }));
    eyes(P, 0.06, 0.07, 0.1, 0.03, !f.glass);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.push(limb(new Vector3(-0.02, -0.02, 0), new Vector3(-1, Math.cos(a) * 0.45, Math.sin(a) * 0.45), f.dumbo ? 0.35 : 0.55, 0.035, 0.004, i % 2 && f.striped ? 5 : 6, 6)); }
    if (f.dumbo) { for (const s of [-1, 1]) P.push(part(sphere(8), { patch: 5, w: 0.5, m: M(0.28, 0.14, s * 0.2, s * 0.4, 0, 0, 0.1, 0.02, 0.12) })); P.push(part(new THREE.ConeGeometry(0.22, 0.3, 12, 1, true), { patch: 6, m: M(-0.15, 0, 0, 0, 0, Math.PI / 2), wFn: x => clamp(-x / 0.3, 0, 1) })); }
    return { P, mode: 8, amp: 0.08, transparent: f.glass ? 0.35 : 0 };
  },
  cuttle(sp) {
    const P = [], H = 0.32, r = t => H / 2 * Math.pow(Math.sin(Math.PI * clamp(t * 0.95 + 0.03, 0, 1)), 0.6);
    P.push(part(loft(16, 14, t => 0.45 - t * 0.9, r, t => r(t) * 0.8)));
    P.push(part(sphere(16), { patch: 2, m: M(-0.02, -0.01, 0, 0, 0, 0, 0.46, 0.006, H * 0.6) }));
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.push(limb(new Vector3(0.44, 0, 0), new Vector3(1, Math.cos(a) * 0.2, Math.sin(a) * 0.2), 0.15, 0.02, 0.004, 6, 4)); }
    eyes(P, 0.36, 0.06, 0.1, 0.03, true);
    return { P, mode: 1, amp: 0.012 };
  },
  seahorse(sp) {
    const f = sp.f || {}, P = [];
    P.push(part(sphere(12), { m: M(0, 0.55, 0, 0, 0, 0, 0.12, 0.22, 0.09) }));
    P.push(part(sphere(10), { m: M(0.05, 0.82, 0, 0, 0, 0, 0.08, 0.07, 0.06) }));
    P.push(part(new THREE.CylinderGeometry(0.018, 0.024, 0.13, 6), { m: M(0.17, 0.8, 0, 0, 0, Math.PI / 2 + 0.2) }));
    P.push(part(new THREE.CylinderGeometry(0.04, 0.07, 0.2, 8), { m: M(-0.01, 0.3, 0) }));
    P.push(part(new THREE.TorusGeometry(0.08, 0.035, 6, 14, Math.PI * 1.6), { m: M(0.02, 0.14, 0, 0, 0, 1.3) }));
    for (const s of [-1, 1]) P.push(part(sphere(6), { patch: 1, m: M(0.09, 0.84, s * 0.05, 0, 0, 0, 0.015) }));
    if (f.leafy) { const R = rng(7); for (let i = 0; i < 14; i++) { const y = 0.15 + R() * 0.75, a = R() * 6.28; P.push(part(sphere(6), { patch: 5, m: M(Math.cos(a) * 0.14, y, Math.sin(a) * 0.1, R(), R() * 3, R(), 0.1, 0.03, 0.05) })); } }
    return { P, mode: 6, amp: 0.03 };
  },
  nautilus(sp) {
    const P = [];
    P.push(part(new THREE.SphereGeometry(1, 20, 14), { m: M(-0.08, 0, 0, 0, 0, 0, 0.42, 0.42, 0.22) }));
    P.push(part(sphere(10), { patch: 4, m: M(0.28, 0.02, 0, 0, 0, 0, 0.12, 0.13, 0.15) }));
    for (const s of [-1, 1]) P.push(part(sphere(6), { patch: 1, m: M(0.3, 0.03, s * 0.13, 0, 0, 0, 0.03) }));
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; P.push(limb(new Vector3(0.36, -0.03, 0), new Vector3(1, Math.cos(a) * 0.4 - 0.3, Math.sin(a) * 0.4), 0.18, 0.008, 0.003, 4, 3)); }
    return { P, mode: 8, amp: 0.03 };
  },
  siphonophore(sp) {
    const P = [];
    for (let i = 0; i < 70; i++) { const x = 0.5 - i / 69; P.push(part(sphere(6), { patch: 7, m: M(x, 0, 0, 0, 0, 0, 0.006) })); if (i % 3 === 0) P.push(limb(new Vector3(x, 0, 0), new Vector3(0, -1, 0.2), 0.02, 0.0015, 0.0008, 7, 3)); }
    return { P, mode: 4, amp: 0.015, transparent: 0.7 };
  },
  pyrosome(sp) {
    const P = [part(new THREE.CylinderGeometry(0.1, 0.13, 1, 14, 6, true), { m: M(0, 0, 0, 0, 0, Math.PI / 2) })], R = rng(3);
    for (let i = 0; i < 40; i++) { const a = R() * 6.28, x = R() - 0.5; P.push(part(sphere(5), { patch: 7, m: M(x, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0, 0, 0, 0.02) })); }
    return { P, mode: 1, amp: 0.01, transparent: 0.6 };
  },
  crust(sp) {
    const iso = sp.f?.iso, P = [];
    for (let i = 0; i < 7; i++) { const x = 0.35 - i * 0.11; P.push(part(sphere(10), { patch: i % 2 ? 6 : 4, m: M(x, iso ? 0 : -0.1 * (x * x * 4), 0, 0, 0, 0, 0.075, iso ? 0.1 : 0.12, iso ? 0.17 : 0.07) })); for (const s of [-1, 1]) P.push(limb(new Vector3(x, -0.05, s * (iso ? 0.12 : 0.05)), new Vector3(0, -1, s * 0.6), 0.16, 0.006, 0.003, 4, 3)); }
    for (const s of [-1, 1]) P.push(limb(new Vector3(0.42, 0.03, s * 0.03), new Vector3(1, 0.5, s * 0.5), iso ? 0.25 : 0.35, 0.005, 0.002, 4, 3));
    eyes(P, 0.42, 0.04, 0.06, 0.02, false);
    return { P, mode: 1, amp: 0.008 };
  },
  cuke(sp) {
    const pig = sp.f?.pig, P = [part(sphere(14), { m: M(0, 0, 0, 0, 0, 0, 0.5, 0.22, 0.25) })];
    if (pig) { for (let i = 0; i < 10; i++) P.push(limb(new Vector3(0.3 - (i >> 1) * 0.14, -0.15, (i % 2 ? 1 : -1) * 0.14), new Vector3(0, -1, 0), 0.12, 0.03, 0.01, 4)); for (const s of [-1, 1]) P.push(limb(new Vector3(0.25, 0.18, s * 0.06), new Vector3(0.2, 1, s * 0.2), 0.22, 0.03, 0.008, 4)); }
    else P.push(part(sphere(10), { patch: 5, m: M(0.45, 0.12, 0, 0, 0, 0.8, 0.08, 0.26, 0.3) }));
    return { P, mode: 1, amp: 0.02, transparent: pig ? 0 : 0.7 };
  },
  star(sp) {
    const P = [], n = 14, pts = [];
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.26 : 0.5; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
    const s = new THREE.Shape(); s.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) s.lineTo(pts[i], pts[i + 1]);
    P.push(part(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }), { patch: 6, m: M(0, 0.06, 0, Math.PI / 2, 0, 0) }));
    const R = rng(11); for (let i = 0; i < 50; i++) { const a = R() * 6.28, r = R() * 0.42; P.push(part(new THREE.ConeGeometry(0.01, 0.07, 4), { patch: 5, m: M(Math.cos(a) * r, 0.09, Math.sin(a) * r) })); }
    return { P, mode: 0 };
  },
  nudi(sp) { return { P: [part(sphere(16), { m: M(0, 0.05, 0, 0, 0, 0, 0.5, 0.1, 0.3) }), part(sphere(16), { patch: 0, m: M(0, 0.03, 0, 0, 0, 0, 0.52, 0.03, 0.34) }), part(sphere(8), { patch: 5, m: M(-0.35, 0.14, 0, 0, 0, 0, 0.08, 0.06, 0.08) })], mode: 1, amp: 0.02 }; },
  sunfish(sp) {
    const P = [], H = 0.95, prof = t => t < 0.25 ? Math.pow(Math.sin(t / 0.25 * Math.PI / 2), 0.5) : 1 - 0.25 * ((t - 0.25) / 0.75);
    const fh = t => H / 2 * prof(t), fw = t => fh(t) * 0.28;
    P.push(part(loft(18, 16, t => 0.5 - t * 0.8, fh, fw)));
    P.push(part(shape([0.06, fh(0.5) * 0.9, -0.14, fh(0.7) * 0.9, -0.1, H * 1.05]), { patch: 2 }), part(shape([0.06, -fh(0.5) * 0.9, -0.14, -fh(0.7) * 0.9, -0.1, -H * 1.05]), { patch: 2 }));
    const s = new THREE.Shape(); s.moveTo(-0.3, fh(1) * 0.95); s.quadraticCurveTo(-0.42, 0, -0.3, -fh(1) * 0.95); P.push(part(new THREE.ShapeGeometry(s), { patch: 3 }));
    eyes(P, 0.36, fh(0.18) * 0.3, fw(0.18) * 0.9, 0.03);
    return { P, mode: 1, amp: 0.02 };
  },
  clam(sp) {
    const shell = () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    return { P: [part(shell(), { patch: 5, m: M(0, 0.02, 0, Math.PI, 0, 0, 0.5, 0.25, 0.3) }), part(sphere(16), { m: M(0, 0.03, 0, 0, 0, 0, 0.46, 0.06, 0.25) })], mode: 0 };
  },
  xeno(sp) {
    const g = new THREE.IcosahedronGeometry(0.5, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); _v.multiplyScalar(1 + 0.25 * vnoise(_v.x * 8, _v.y * 8 + _v.z * 5)); p.setXYZ(i, _v.x, _v.y * 0.6 + 0.3, _v.z); }
    g.computeVertexNormals();
    return { P: [part(g, { patch: 6 })], mode: 0 };
  },
  // ----- corals: upright, base at y = 0 -----
  brain() { // meandering ridges pressed into the dome
    const g = new THREE.SphereGeometry(0.5, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const r = 1 + 0.035 * Math.sin(_v.x * 38 + vnoise(_v.x * 9, _v.z * 9) * 5 + _v.z * 12) * smooth(0, 0.1, _v.y); p.setXYZ(i, _v.x * r, _v.y * r * 0.8, _v.z * r); }
    g.computeVertexNormals(); return { P: [part(g)], mode: 0 };
  },
  massive(sp) { // lumpy lobe-coral mound
    const g = new THREE.SphereGeometry(0.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const r = 1 + 0.22 * Math.max(0, vnoise(_v.x * 5 + 3, _v.z * 5 + _v.y * 4)) + 0.05 * vnoise(_v.x * 17, _v.z * 17 + _v.y * 9); p.setXYZ(i, _v.x * r, _v.y * r * 0.75, _v.z * r); }
    g.computeVertexNormals(); return { P: [part(g)], mode: 0 };
  },
  scroll(sp) { // stacked, curling plates
    const P = [], R = rng(31);
    for (let i = 0; i < 6; i++) { const r = 0.2 + R() * 0.25, g = new THREE.CylinderGeometry(r, r * 0.55, 0.22, 24, 1, true, R() * 6, 1.6 + R() * 1.4); P.push(part(g, { m: M((R() - 0.5) * 0.3, 0.12 + i * 0.07, (R() - 0.5) * 0.3, (R() - 0.5) * 0.4, R() * 6, (R() - 0.5) * 0.4) })); }
    return { P, mode: 0 };
  },
  bubble(sp) {
    const P = [part(sphere(12), { patch: 6, m: M(0, 0.05, 0, 0, 0, 0, 0.35, 0.12, 0.35) })], R = rng(41);
    for (let i = 0; i < 38; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * 0.32, y = 0.08 + (1 - r / 0.32) * 0.18 + R() * 0.05; P.push(part(sphere(10), { m: M(Math.cos(a) * r, y, Math.sin(a) * r, 0, 0, 0, 0.05 + R() * 0.04) })); }
    return { P, mode: 0 };
  },
  leather(sp) {
    const g = new THREE.CylinderGeometry(0.42, 0.36, 0.07, 48, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), r = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, p.getY(i) + Math.sin(a * 7) * 0.05 * (r / 0.42) ** 2); }
    g.computeVertexNormals();
    return { P: [part(new THREE.CylinderGeometry(0.14, 0.18, 0.28, 16), { patch: 4, m: M(0, 0.14, 0) }), part(g, { m: M(0, 0.3, 0) })], mode: 6, amp: 0.01 };
  },
  cups(sp) {
    const P = [], R = rng(51);
    for (let i = 0; i < 12; i++) { const a = R() * 6.28, r = R() * 0.3, h = 0.08 + R() * 0.12, rr = 0.04 + R() * 0.03, x = Math.cos(a) * r, z = Math.sin(a) * r;
      P.push(part(new THREE.CylinderGeometry(rr, rr * 0.8, h, 12), { patch: 6, m: M(x, h / 2, z) }));
      for (let k = 0; k < 10; k++) { const b = k / 10 * 6.28; P.push(limb(new Vector3(x + Math.cos(b) * rr * 0.8, h, z + Math.sin(b) * rr * 0.8), new Vector3(Math.cos(b) * 0.6, 1, Math.sin(b) * 0.6), rr * 0.9, 0.008, 0.004, 5, 3)); } }
    return { P, mode: 6, amp: 0.02 };
  },
  whip(sp) {
    const P = [], R = rng(61);
    for (let i = 0; i < 4; i++) { const d = new Vector3((R() - 0.5) * 0.4, 1, (R() - 0.5) * 0.4); P.push(limb(new Vector3((R() - 0.5) * 0.06, 0, (R() - 0.5) * 0.06), d, 0.7 + R() * 0.3, 0.014, 0.006, 6, 6)); }
    return { P, mode: 6, amp: 0.08 };
  },
  digitate(sp) {
    const P = [part(new THREE.CylinderGeometry(0.3, 0.35, 0.08, 16), { patch: 6, m: M(0, 0.04, 0) })], R = rng(71);
    for (let i = 0; i < 26; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * 0.3, len = 0.12 + R() * 0.2, from = new Vector3(Math.cos(a) * r, 0.06, Math.sin(a) * r);
      P.push(limb(from, new Vector3(Math.cos(a) * r * 0.8, 1, Math.sin(a) * r * 0.8), len, 0.04, 0.03, 6, 8)); const tip = from.clone().add(new Vector3(Math.cos(a) * r * 0.8, 1, Math.sin(a) * r * 0.8).normalize().multiplyScalar(len)); P.push(part(sphere(8), { patch: 5, m: M(tip.x, tip.y, tip.z, 0, 0, 0, 0.032) })); }
    return { P, mode: 0 };
  },
  grass(sp) {
    const P = [], R = rng(81);
    for (let i = 0; i < 34; i++) { const h = 0.6 + R() * 0.5, g = new THREE.PlaneGeometry(0.035, h, 1, 4); g.translate(0, h / 2, 0); P.push(part(g, { patch: i % 4 ? 6 : 5, m: M((R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5, (R() - 0.5) * 0.3, R() * 3, (R() - 0.5) * 0.3) })); }
    return { P, mode: 6, amp: 0.15 };
  },
  algae(sp) {
    const P = [], R = rng(91);
    for (let c = 0; c < 6; c++) { let p = new Vector3((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3); const d = new Vector3((R() - 0.5) * 0.8, 1, (R() - 0.5) * 0.8).normalize();
      for (let i = 0; i < 6; i++) { P.push(part(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 12), { patch: i % 2 ? 6 : 5, m: M(p.x, p.y + 0.06, p.z, R() - 0.5 + Math.PI / 2, R() * 3, 0) })); p.addScaledVector(d, 0.12); d.x += (R() - 0.5) * 0.5; d.z += (R() - 0.5) * 0.5; d.normalize(); } }
    return { P, mode: 6, amp: 0.05 };
  },
  tubes(sp) {
    const P = [], R = rng(101);
    for (let i = 0; i < 5; i++) { const r = 0.05 + R() * 0.04, h = 0.3 + R() * 0.45, x = (R() - 0.5) * 0.3, z = (R() - 0.5) * 0.3, tilt = (R() - 0.5) * 0.3;
      P.push(part(new THREE.CylinderGeometry(r * 1.1, r * 0.8, h, 16, 3, true), { m: M(x, h / 2, z, tilt, 0, tilt) }));
      P.push(part(new THREE.CircleGeometry(r * 0.95, 14), { patch: 1, m: M(x + Math.sin(-tilt) * h * 0.45, h * 0.93, z + Math.sin(tilt) * h * 0.45, -Math.PI / 2, 0, 0) })); }
    return { P, mode: 6, amp: 0.015 };
  },
  xmas(sp) {
    const P = [part(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 10), { patch: 4, m: M(0, 0.02, 0) })];
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) P.push(part(new THREE.ConeGeometry(0.28 - k * 0.04, 0.12, 14, 1, true), { m: M(s * 0.16, 0.14 + k * 0.1, 0, 0, k * 0.7, 0) }));
    return { P, mode: 6, amp: 0.02 };
  },
  table() { return { P: [part(new THREE.CylinderGeometry(0.05, 0.08, 0.28, 8), { patch: 6, m: M(0, 0.14, 0) }), part(new THREE.CylinderGeometry(0.5, 0.44, 0.05, 20), { m: M(0, 0.3, 0, 0.05, 0, 0.04) })], mode: 0 }; },
  branch(sp) { return { P: tree(sp, 3, 0.3, 0.035, 5, 6), mode: 0 }; },
  black(sp) { return { P: tree(sp, 3, 0.42, 0.015, 6, 5), mode: 6, amp: 0.03 }; },
  bamboo(sp) { return { P: tree(sp, 2, 0.45, 0.02, 5, 5, true), mode: 6, amp: 0.02 }; },
  fan() {
    const s = new THREE.Shape(); s.moveTo(0, 0); for (let i = 0; i <= 16; i++) { const a = 0.25 + i / 16 * (Math.PI - 0.5); s.lineTo(Math.cos(a) * 0.55, Math.sin(a) * 0.55 + 0.1); } s.lineTo(0, 0);
    return { P: [part(new THREE.ShapeGeometry(s), { uvFn: (x, y) => BODY_UV(clamp(x + 0.5, 0, 0.98), clamp(y / 0.66, 0, 1)) }), part(new THREE.CylinderGeometry(0.015, 0.02, 0.12, 5), { patch: 6, m: M(0, 0.06, 0) })], mode: 6, amp: 0.06, alphaTest: 0.5 };
  },
  anemone(sp) {
    const P = [part(new THREE.CylinderGeometry(0.3, 0.35, 0.12, 14), { patch: 6, m: M(0, 0.06, 0) })], R = rng(5);
    for (let i = 0; i < 44; i++) { const a = R() * 6.28, r = R() * 0.28; P.push(limb(new Vector3(Math.cos(a) * r, 0.1, Math.sin(a) * r), new Vector3(Math.cos(a) * r * 1.5, 1, Math.sin(a) * r * 1.5), 0.3 + R() * 0.1, 0.03, 0.012, 5, 4)); }
    return { P, mode: 6, amp: 0.12 };
  },
  sponge() {
    const out = [[0.22, 0], [0.3, 0.25], [0.37, 0.6], [0.38, 0.85]].map(([x, y]) => new THREE.Vector2(x, y));
    const inn = [[0.37, 0.85], [0.3, 0.84], [0.26, 0.4]].map(([x, y]) => new THREE.Vector2(x, y));
    return { P: [part(new THREE.LatheGeometry(out, 20)), part(new THREE.LatheGeometry(inn, 20), { patch: 1 })], mode: 0 };
  },
  softcoral(sp) {
    const P = [part(new THREE.CylinderGeometry(0.05, 0.1, 0.5, 8), { patch: 4, m: M(0, 0.25, 0) })], R = rng(9);
    for (let i = 0; i < 5; i++) P.push(limb(new Vector3(0, 0.25 + i * 0.07, 0), new Vector3(R() - 0.5, 1, R() - 0.5), 0.25, 0.03, 0.015, 4));
    for (let i = 0; i < 40; i++) P.push(part(sphere(6), { patch: i % 3 ? 6 : 5, m: M((R() - 0.5) * 0.55, 0.4 + R() * 0.5, (R() - 0.5) * 0.55, 0, 0, 0, 0.05) }));
    return { P, mode: 6, amp: 0.03 };
  },
  glass() { return { P: [part(new THREE.LatheGeometry([[0.06, 0], [0.13, 0.2], [0.17, 0.7], [0.2, 1]].map(([x, y]) => new THREE.Vector2(x, y)), 16))], mode: 6, amp: 0.01, transparent: 0.65 }; },
  crinoid() {
    const P = [part(new THREE.CylinderGeometry(0.012, 0.02, 0.7, 5), { patch: 6, m: M(0, 0.35, 0) })];
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; P.push(limb(new Vector3(0, 0.7, 0), new Vector3(Math.cos(a), 0.6, Math.sin(a)), 0.3, 0.012, 0.004, 5, 4)); }
    return { P, mode: 6, amp: 0.06 };
  },
  seapen() {
    const P = [part(new THREE.CylinderGeometry(0.008, 0.012, 0.9, 5), { patch: 6, m: M(0, 0.45, 0) })];
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; P.push(limb(new Vector3(0, 0.88, 0), new Vector3(Math.cos(a), 0.5, Math.sin(a)), 0.12, 0.012, 0.004, 5, 3)); }
    return { P, mode: 6, amp: 0.05 };
  },
  mushroom() { return { P: [part(new THREE.SphereGeometry(0.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), { m: M(0, 0, 0, 0, 0, 0, 1, 0.18, 1) })], mode: 0 }; },
};
function tree(sp, levels, len, r, kids, seed, bamboo = false) {
  const R = rng(hash(sp.id) + seed), P = [];
  const grow = (from, dir, l, rad, lv) => {
    const to = from.clone().add(dir.clone().normalize().multiplyScalar(l));
    P.push(limb(from, dir, l, rad, rad * 0.7, bamboo && lv % 2 ? 5 : 6, 5));
    if (lv >= levels) { if (!bamboo) P.push(part(sphere(5), { patch: 5, m: M(to.x, to.y, to.z, 0, 0, 0, rad * 1.1) })); return; }
    for (let i = 0; i < (lv === 0 ? kids : 2 + (R() < 0.4)); i++) grow(to, new Vector3(dir.x + (R() - 0.5) * 1.4, dir.y + 0.2, dir.z + (R() - 0.5) * 1.4), l * 0.72, rad * 0.7, lv + 1);
  };
  grow(new Vector3(0, 0, 0), new Vector3(0, 1, 0), len, r, 0);
  return P;
}

// ---------- textures ----------
function makeCanvas(w = 256, h = 128) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function makeTex(sp) {
  const cv = makeCanvas(512, 320), g = cv.getContext('2d'), f = sp.f || {}, [c0, c1, c2 = c1] = sp.c, W = 246, R = rng(hash(sp.id));
  g.save(); g.scale(2, 2);   // body is drawn in 256×128 units
  const belly = ['shark', 'ray', 'whale'].includes(sp.type) ? c1 : f.pattern === 'bands' ? c0 : lighter(c0);
  const dot = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const both = fn => { fn(1); fn(-1); }; // draw on both flanks: row = 64 ± s * k
  if (CORAL.has(sp.type) || ['jelly', 'siphonophore', 'pyrosome', 'xeno', 'clam', 'star', 'nudi', 'cuke', 'crust', 'seahorse', 'octopus', 'squid', 'cuttle'].includes(sp.type)) {
    if (sp.type === 'fan') g.clearRect(0, 0, 256, 128); else { g.fillStyle = c0; g.fillRect(0, 0, 248, 128); }
  } else {
    const [a, b] = sp.type === 'ray' ? [0.47, 0.53] : ['shark', 'whale'].includes(sp.type) ? [0.3, 0.5] : [0.2, 0.62];
    for (let y = 0; y < 128; y++) { g.fillStyle = mix(belly, c0, smooth(a, b, Math.abs(y - 64) / 64)); g.fillRect(0, y, 248, 1); }
  }
  const p = f.pattern;
  if (p === 'hstripes') both(s => { for (const k of [22, 42]) { g.fillStyle = c1; g.fillRect(0, 64 + s * k - 3, W, 6); } });
  if (p === 'hlines') for (let y = 6; y < 128; y += 9) { g.fillStyle = c1; g.fillRect(0, y, W, 1.5); }
  if (p === 'vbands') for (const u of [0.18, 0.36, 0.54, 0.72]) { g.fillStyle = c1; g.fillRect(u * W - 7, 0, 14, 128); if (sp.c[2]) { g.fillStyle = c2; g.fillRect(u * W - 9, 0, 2, 128); g.fillRect(u * W + 7, 0, 2, 128); } }
  if (p === 'bands') for (const u of [0.16, 0.45, 0.74].slice(0, f.n)) { if (f.edge) { g.fillStyle = c2; g.fillRect(u * W - 8 - f.edge * 3, 0, 16 + f.edge * 6, 128); } g.fillStyle = c1; g.fillRect(u * W - 8, 0, 16, 128); }
  if (p === 'dots') for (let i = 0; i < 140; i++) dot(R() * W, R() * 128, 1.4, c2);
  if (p === 'whitespots') for (let i = 0; i < 90; i++) dot(R() * W, R() * 128, 2.5, '#f0f4f8');
  if (p === 'blotch') { g.globalAlpha = 0.35; for (let i = 0; i < 20; i++) { g.fillStyle = c2; g.beginPath(); g.ellipse(R() * W, R() * 128, 14, 8, 0, 0, 7); g.fill(); } g.globalAlpha = 1; }
  if (p === 'warts') for (let i = 0; i < 160; i++) dot(R() * W, R() * 128, 2 + R() * 2, i % 2 ? c1 : c2);
  if (p === 'chevrons') { g.strokeStyle = c2; g.lineWidth = 1.5; for (let x = 10; x < W; x += 12) both(s => { g.beginPath(); g.moveTo(x, 64 + s * 64); g.lineTo(x + 8, 64 + s * 30); g.lineTo(x, 64); g.stroke(); }); }
  if (p === 'mask') { g.fillStyle = c1; g.fillRect(0, 14, 44, 26); g.fillRect(0, 88, 44, 26); }
  if (p === 'butterfly') { g.fillStyle = c2; g.fillRect(150, 0, W - 150, 128); g.fillStyle = c1; g.fillRect(24, 0, 12, 128); dot(200, 20, 5, c1); dot(200, 108, 5, c1); }
  if (p === 'face') { g.fillStyle = c1; g.fillRect(0, 0, 52, 128); g.fillStyle = '#ffffff'; g.fillRect(0, 54, 52, 20); }
  if (p === 'palette') { g.fillStyle = c1; both(s => { g.beginPath(); g.moveTo(20, 64 + s * 40); g.quadraticCurveTo(120, 64 + s * 20, 210, 64 + s * 48); g.lineTo(210, 64 + s * 30); g.quadraticCurveTo(110, 64 + s * 5, 40, 64 + s * 26); g.fill(); }); }
  if (p === 'scales') { g.strokeStyle = c2; g.globalAlpha = 0.4; for (let x = -128; x < W; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 128, 128); g.moveTo(x + 128, 0); g.lineTo(x, 128); g.stroke(); } g.globalAlpha = 1; }
  if (p === 'bigspots') { for (let i = 0; i < 16; i++) dot(40 + R() * 150, 64 + (R() - 0.5) * 50, 7, c1); g.fillStyle = c2; g.fillRect(60, 0, 50, 14); g.fillRect(60, 114, 50, 14); }
  if (p === 'lines') { g.strokeStyle = '#d8f0c0'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 10 + i * 20); g.quadraticCurveTo(25, 20 + i * 20, 50, 8 + i * 20); g.stroke(); } }
  if (p === 'streak') {   // cleaner wrasse: a black stripe from snout to tail that widens toward the back, blue on the rear half
    const bl = g.createLinearGradient(0, 0, W, 0); bl.addColorStop(0, 'rgba(40,110,230,0)'); bl.addColorStop(1, 'rgba(40,110,230,0.7)'); g.fillStyle = bl; g.fillRect(0, 0, W, 128);
    g.fillStyle = c1; both(s => { g.beginPath(); g.moveTo(0, 64 + s * 32 - 1.5); g.lineTo(W, 64 + s * 32 - 9); g.lineTo(W, 64 + s * 32 + 9); g.lineTo(0, 64 + s * 32 + 1.5); g.fill(); });
  }
  if (p === 'leopard') for (let i = 0; i < 620; i++) { const x = R() * W, y = R() * 128, k = x / W; g.fillStyle = c2; g.globalAlpha = 0.75 + R() * 0.25; g.beginPath(); g.ellipse(x, y, 0.9 + k * 3 + R() * 1.4, 0.8 + k * 2.2 + R(), R() * 3, 0, 7); g.fill(); g.globalAlpha = 1; }   // spots small on the head, blotchier toward the tail
  if (p === 'swirl') { g.lineWidth = 3; for (let i = 0; i < 14; i++) { g.strokeStyle = i % 2 ? c1 : c2; g.beginPath(); for (let x = 0; x < W; x += 6) g.lineTo(x, i * 9 + Math.sin(x * 0.08 + i) * 5); g.stroke(); } }
  // body-type specific looks
  if (sp.type === 'shark') {
    if (f.whale) { for (let i = 0; i < 160; i++) { const y = R() * 128; if (Math.abs(y - 64) > 16) dot(R() * W, y, 1.8, '#e8f0f4'); } }
    if (f.stripes) { g.fillStyle = 'rgba(40,46,40,0.45)'; for (let x = 60; x < W - 20; x += 13) { g.fillRect(x, 0, 5, 36); g.fillRect(x, 92, 5, 36); } }
    if (f.zebra || f.wobbe) for (let i = 0; i < 200; i++) dot(R() * W, R() * 128, 2 + R() * 2, c2);
  }
  if (sp.type === 'whale') {
    if (f.orca) { g.fillStyle = c0; g.fillRect(0, 0, W, 128); g.fillStyle = c1; g.fillRect(40, 44, 150, 40); g.fillRect(0, 50, 40, 28); g.beginPath(); g.ellipse(50, 30, 14, 5, 0, 0, 7); g.ellipse(50, 98, 14, 5, 0, 0, 7); g.fill(); g.fillStyle = '#6a6e76'; g.fillRect(95, 0, 30, 8); g.fillRect(95, 120, 30, 8); }
    if (f.humpback) { g.strokeStyle = '#2a2e36'; for (let y = 48; y < 80; y += 4) { g.beginPath(); g.moveTo(10, y); g.lineTo(90, y); g.stroke(); } }
    if (f.blue) for (let i = 0; i < 120; i++) dot(R() * W, R() * 128, 2 + R() * 3, 'rgba(210,225,240,0.35)');
    if (f.sperm) { g.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 40; i++) { const x = R() * W, y = R() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 10); g.stroke(); } }
  }
  if (sp.type === 'ray') {
    const back = y => Math.abs(y - 64) > 34;
    if (f.manta) { g.fillStyle = c1; g.beginPath(); g.ellipse(70, 14, 30, 8, 0.2, 0, 7); g.ellipse(70, 114, 30, 8, -0.2, 0, 7); g.fill(); }
    if (f.eagle) for (let i = 0; i < 220; i++) { const y = R() * 128; if (back(y)) dot(R() * W, y, 1.7, c2); }
    if (f.sting) for (let i = 0; i < 120; i++) { const y = R() * 128; if (back(y)) dot(R() * W, y, 2.4, c2); }
  }
  if (sp.type === 'turtle') {   // carapace (loft: rows 0/128 = spine, 64 = belly): a spine row of 5 vertebral scutes, 4 costals each side, a rim of marginals, pale plastron
    g.fillStyle = mix(c1, c0, 0.4); g.fillRect(0, 0, 248, 128);
    for (let i = 0; i < 260; i++) { const x = R() * 248, y = R() * 128; g.strokeStyle = `rgba(${R() < 0.5 ? '40,26,10' : '250,220,160'},${0.12 + R() * 0.2})`; g.lineWidth = 1 + R() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 10, y + (R() - 0.5) * 16); g.stroke(); }   // radiating streaks
    if (f.hawk) for (let i = 0; i < 90; i++) dot(R() * 248, R() * 128, 2 + R() * 3, 'rgba(240,200,120,0.45)');
    const pl = g.createLinearGradient(0, 38, 0, 90); pl.addColorStop(0, c1); pl.addColorStop(0.18, mix(sp.c[2], c0, 0.2)); pl.addColorStop(0.3, sp.c[2]); pl.addColorStop(0.7, sp.c[2]); pl.addColorStop(0.82, mix(sp.c[2], c0, 0.2)); pl.addColorStop(1, c1);
    g.fillStyle = pl; g.fillRect(0, 38, 248, 52);
    g.strokeStyle = mix(c0, '#000000', 0.2); g.lineWidth = 1.6;
    both(s => {
      const row = r => 64 + s * r;
      for (let i = 0; i < 5; i++) { g.strokeRect(20 + i * 42, s > 0 ? row(64) - 14 : row(64), 42, 14); }                                // vertebrals along the spine
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(30 + i * 50, row(52)); g.lineTo(30 + i * 50, row(30)); g.lineTo(80 + i * 50, row(30)); g.stroke(); }   // costals
      g.beginPath(); g.moveTo(6, row(30)); g.lineTo(242, row(30)); g.stroke();
      for (let x = 6; x < 242; x += 16) { g.beginPath(); g.moveTo(x, row(30)); g.lineTo(x, row(24)); g.stroke(); }                          // marginals at the rim
    });
  }
  if (sp.type === 'nautilus') { g.fillStyle = c0; g.fillRect(0, 0, 248, 128); g.strokeStyle = c1; g.lineWidth = 7; for (let x = 0; x < 260; x += 22) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 14, 36, x + 4, 70); g.stroke(); } }
  if (['octopus', 'cuttle', 'seahorse', 'crust'].includes(sp.type)) for (let i = 0; i < 90; i++) dot(R() * W, R() * 128, 2 + R() * 3, `rgba(0,0,0,${0.08 + R() * 0.12})`);
  if (f.rings) for (let i = 0; i < 40; i++) { g.strokeStyle = c1; g.lineWidth = 2.5; g.beginPath(); g.arc(R() * W, R() * 128, 5, 0, 7); g.stroke(); }
  if (f.striped) for (let x = 0; x < W; x += 18) { g.fillStyle = c1; g.fillRect(x, 0, 8, 128); }
  if (sp.id === 'flamboyant_cuttle') for (let i = 0; i < 30; i++) dot(R() * W, R() * 128, 6, i % 2 ? c1 : c2);
  if (f.comb) { const cols = ['#ff5a7a', '#ffd84a', '#5aff8a', '#5ac8ff', '#c05aff']; for (let x = 0; x < W; x += 31) for (let y = 0; y < 128; y += 6) { g.fillStyle = cols[(x / 31 + y / 6) % 5 | 0]; g.fillRect(x, y, 3, 3); } }
  if (CORAL.has(sp.type) && sp.type !== 'fan') for (let i = 0; i < 700; i++) dot(R() * W, R() * 128, 0.6 + R() * 1.2, `rgba(0,0,0,${0.06 + R() * 0.12})`);
  if (['massive', 'digitate', 'table', 'branch', 'bubble'].includes(sp.type)) for (let i = 0; i < 500; i++) dot(R() * W, R() * 128, 0.9, lighter(c0));
  if (sp.type === 'brain') { g.strokeStyle = c1; g.lineWidth = 2.5; for (let y = 4; y < 128; y += 7) { g.beginPath(); for (let x = 0; x < W; x += 3) g.lineTo(x, y + Math.sin(x * 0.2 + y) * 3); g.stroke(); } }
  if (['table', 'mushroom', 'sponge', 'xeno', 'glass'].includes(sp.type)) { g.strokeStyle = c1; g.globalAlpha = sp.type === 'glass' ? 1 : 0.35; g.lineWidth = 1; for (let x = 0; x < W; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); } if (sp.type !== 'sponge') for (let y = 0; y < 128; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.globalAlpha = 1; }
  if (sp.type === 'fan') { g.strokeStyle = c0; g.lineWidth = 2.2; for (let i = 0; i < 26; i++) { g.beginPath(); g.moveTo(128, 128); g.lineTo(i / 25 * 240, 0); g.stroke(); } g.strokeStyle = c1; g.lineWidth = 1.6; for (let r = 14; r < 150; r += 13) { g.beginPath(); g.arc(128, 128, r, Math.PI, Math.PI * 2); g.stroke(); } }
  if (sp.type === 'clam') { g.fillStyle = c0; g.fillRect(0, 0, 248, 128); for (let i = 0; i < 70; i++) dot(R() * W, R() * 128, 3, c1); }
  if (f.moray) for (let i = 0; i < 2200; i++) dot(R() * W, R() * 128, 0.4 + R() * 1.1, R() < 0.5 ? `rgba(0,0,0,${0.05 + R() * 0.08})` : `rgba(255,240,200,${0.04 + R() * 0.06})`);   // mottled, slimy skin
  if (sp.type === 'fish' || sp.type === 'shark') {   // countershading (a darker back), then fine mottling so no flank is a flat colour
    const cs = g.createLinearGradient(0, 0, 0, 128); cs.addColorStop(0, 'rgba(0,0,0,0.26)'); cs.addColorStop(0.2, 'rgba(0,0,0,0)'); cs.addColorStop(0.8, 'rgba(0,0,0,0)'); cs.addColorStop(1, 'rgba(0,0,0,0.26)');
    g.fillStyle = cs; g.fillRect(0, 0, W, 128);
    for (let i = 0; i < 1400; i++) dot(R() * W, R() * 128, 0.4 + R() * 1.3, R() < 0.5 ? `rgba(0,0,0,${0.03 + R() * 0.06})` : `rgba(255,255,255,${0.03 + R() * 0.05})`);
  }
  if (sp.type === 'fish' && !f.rattail && !f.blob && !f.box) {   // overlapping scales: each one's free edge faces the tail, dark rim, pale sheen
    const sz = sp.size > 1 ? 3.2 : 4.2;
    for (let y = 0, row = 0; y < 130; y += sz * 0.75, row++) for (let x = 44 + (row % 2) * sz * 0.5; x < W - 4; x += sz) {
      g.strokeStyle = `rgba(0,0,0,${0.05 + R() * 0.05})`; g.lineWidth = 0.5; g.beginPath(); g.arc(x, y, sz * 0.62, -1.3, 1.3); g.stroke();
      g.fillStyle = `rgba(255,255,255,${R() * 0.06})`; g.beginPath(); g.arc(x - sz * 0.15, y, sz * 0.35, 0, 7); g.fill();   // each scale catches the light a little differently
    }
  }
  if (sp.type === 'fish' && !f.blob) { g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; for (const y of [33, 95]) { g.beginPath(); g.moveTo(0, y); g.lineTo(7, y + (y < 64 ? 1 : -1)); g.stroke(); } }   // mouth
  if (sp.type === 'fish' && f.pattern !== 'bands') {   // gill cover and lateral line
    for (const [a, b] of [[14, 58], [70, 114]]) {   // the gill cover: a shadowed rim with a pale edge in front of it
      const sh = g.createLinearGradient(52, 0, 62, 0); sh.addColorStop(0, 'rgba(0,0,0,0.22)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.beginPath(); g.moveTo(48, a); g.quadraticCurveTo(62, (a + b) / 2, 48, b); g.lineTo(58, b); g.quadraticCurveTo(72, (a + b) / 2, 58, a); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(48, a); g.quadraticCurveTo(62, (a + b) / 2, 48, b); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(46.5, a + 2); g.quadraticCurveTo(60, (a + b) / 2, 46.5, b - 2); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 0.8; for (const y of [30, 98]) { g.beginPath(); g.moveTo(62, y); g.quadraticCurveTo(140, y + (y < 64 ? -6 : 6), 236, 64 + (y - 64) * 0.4); g.stroke(); }
  }
  // colour patches for eyes, fins, etc.
  const fin = f.finc || (sp.type === 'fish' && sp.c[2] ? mix(c0, c2, 0.4) : c0), tailc = f.tailc || fin;
  const iris = sp.type === 'shark' ? '#1a1a1a' : mix(mix(c0, '#c8a860', 0.6), '#000000', 0.15);
  ['#f4f4f0', '#0a0a0a', fin, tailc, belly, c2, c0, '#ffffff', iris].forEach((col, i) => { g.fillStyle = col; g.fillRect(248, i * 8, 8, 8); });
  g.restore();
  // fin (rows 256–287) and tail (288–319) bands: base colour, fin rays on bony fish, a paler, thinner edge
  [[256, fin], [288, tailc]].forEach(([y0, col]) => {
    const gr = g.createLinearGradient(0, y0, 0, y0 + 32); gr.addColorStop(0, mix(col, '#000000', 0.1)); gr.addColorStop(0.75, col); gr.addColorStop(1, mix(col, '#ffffff', 0.35));
    g.fillStyle = gr; g.fillRect(0, y0, 512, 32);
    if (sp.type === 'turtle') { g.strokeStyle = mix(col, '#f4e2b0', 0.55); g.lineWidth = 1.3; for (let y = y0; y < y0 + 32; y += 7) for (let x = (y / 7 % 2) * 6; x < 512; x += 12) { g.beginPath(); g.ellipse(x, y + 3, 5, 3.2, 0, 0, 7); g.stroke(); } }   // pale-edged flipper scales
    if (sp.type === 'fish') {   // thin membrane between bony rays: alpha stores how much water shows through (see the fish shader)
      g.globalCompositeOperation = 'destination-out'; const ga = g.createLinearGradient(0, y0, 0, y0 + 32); ga.addColorStop(0, 'rgba(0,0,0,0.1)'); ga.addColorStop(0.55, 'rgba(0,0,0,0.42)'); ga.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = ga; g.fillRect(0, y0, 512, 32); g.globalCompositeOperation = 'source-over';
      g.strokeStyle = mix(col, '#000000', 0.3); g.globalAlpha = 0.7; g.lineWidth = 1.4; for (let x = 4; x < 512; x += 11) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (x - 256) * 0.02, y0 + 30); g.stroke(); } g.globalAlpha = 1;
    }
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}
// roughness (green) & metalness (blue) in the same layout: glossy eyes, guanine-silvered flanks and bellies on bony fish, wet skin on mammals
const RM_TYPES = { fish: [0.42, 0.1], shark: [0.5, 0.04], ray: [0.45, 0.04], whale: [0.28, 0.04], eel: [0.26, 0.08], turtle: [0.55, 0] };
function makeRM(sp) {
  const cv = makeCanvas(512, 320), g = cv.getContext('2d'), R = rng(hash(sp.id) + 5), [r0, m0] = RM_TYPES[sp.type], shiny = SHINY.has(sp.id), fish = sp.type === 'fish';
  const rm = (r, m) => `rgb(0,${clamp(r, 0, 1) * 255 | 0},${clamp(m, 0, 1) * 255 | 0})`;
  for (let y = 0; y < 256; y++) { const k = 1 - Math.abs(y - 128) / 128; g.fillStyle = rm(shiny ? 0.22 : r0 - k * 0.08, shiny ? 0.55 + 0.25 * k : fish ? m0 + 0.3 * k * k : m0); g.fillRect(0, y, 496, 1); }
  if (fish) for (let i = 0; i < 2500; i++) { g.fillStyle = rm(r0 - R() * 0.15, (shiny ? 0.6 : 0.15) + R() * 0.3); g.fillRect(R() * 496, R() * 256, 2, 2); }   // scales catch the light unevenly
  g.fillStyle = rm(fish ? 0.55 : r0, 0); g.fillRect(0, 256, 512, 64);
  g.fillStyle = rm(r0, m0); g.fillRect(496, 0, 16, 256);
  g.fillStyle = rm(0.3, 0); g.fillRect(496, 0, 16, 16);        // white (teeth)
  g.fillStyle = rm(0.04, 0); g.fillRect(496, 16, 16, 16);      // black: pupils are wet and glassy
  g.fillStyle = rm(0.12, 0.45); g.fillRect(496, 128, 16, 16);  // iris: a metallic ring
  return new THREE.CanvasTexture(cv);
}
function makeGlowTex(sp) {
  const cv = makeCanvas(512, 320), g = cv.getContext('2d'), s = sp.glow.s;
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 320); g.scale(2, 2); g.fillStyle = '#fff';
  if (s === 'belly') for (let x = 30; x < 200; x += 14) for (const y of [58, 70]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  if (s === 'red') { g.fillRect(20, 36, 16, 12); g.fillRect(20, 80, 16, 12); }
  if (s === 'body') { g.globalAlpha = 0.7; g.fillRect(0, 0, 248, 128); g.globalAlpha = 1; }
  if (s === 'ring') g.fillRect(0, 0, 248, 20);
  g.fillRect(248, 56, 8, 8); // glow patch
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

// relief (bump) maps: overlapping scales for bony fish, fine denticles for sharks & rays; patches stay flat
const BUMP = {};
function bumpFor(kind) {
  if (BUMP[kind]) return BUMP[kind];
  const cv = makeCanvas(512, 320), g = cv.getContext('2d'), R = rng(kind.length * 99);
  g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 320);
  if (kind === 'scales') { g.lineWidth = 1.4; for (let y = 0; y < 256; y += 7) for (let x = (y / 7 % 2) * 5; x < 492; x += 10) { g.strokeStyle = '#a8a8a8'; g.beginPath(); g.arc(x, y, 6, 0.2, Math.PI - 0.2); g.stroke(); g.strokeStyle = '#606060'; g.beginPath(); g.arc(x, y + 1.5, 6, 0.3, Math.PI - 0.3); g.stroke(); } }
  else for (let i = 0; i < 20000; i++) { const v = 110 + R() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * 492, R() * 256, 1.2, 1.2); }
  g.strokeStyle = '#a0a0a0'; g.lineWidth = 1.2; for (let x = 4; x < 512; x += 11) { g.beginPath(); g.moveTo(x, 256); g.lineTo(x, 320); g.stroke(); }
  g.fillStyle = '#808080'; g.fillRect(492, 0, 20, 256);
  return BUMP[kind] = new THREE.CanvasTexture(cv);
}
const SHINY = new Set(['silver_sprat', 'giant_trevally', 'bluefin_trevally', 'bigeye_trevally', 'barracuda', 'chevron_barracuda', 'yellowfin', 'bluefin', 'sardine', 'indian_mackerel', 'hatchetfish', 'lanternfish', 'sailfish', 'blue_marlin', 'swordfish', 'oarfish', 'mahi', 'opah']);
// ---------- per-species instanced meshes, animated in the vertex shader ----------
const MODE_GLSL = [
  '',
  // 1 fish: a travelling wave that grows toward the tail, a slight counter-sway of the head, pectoral fins sculling (aW 1 → 2 from base to tip)
  'float k = clamp(0.25 - position.x, 0.0, 0.8); transformed.z += sin(aPhase - position.x * 5.0) * uAmp * k * k * 4.0 + sin(aPhase) * uAmp * 0.06 - sin(aPhase + 0.7) * uAmp * 0.5 * max(0.0, position.x - 0.2);' +
  'if (aW > 0.5 && aW < 2.0) { float s = aW - 1.0, fl = aPhase * 0.55 + position.z * 3.0; transformed.x += s * sin(fl) * 0.045; transformed.y += s * cos(fl) * 0.025 * sign(position.z); }',
  // 2 whale: vertical fluke beat
  'float k = clamp(0.1 - position.x, 0.0, 0.9); transformed.y += sin(aPhase - position.x * 4.0) * uAmp * k * k * 4.0;',
  // 3 ray: wing flap
  'transformed.y += sin(aPhase - abs(position.z) * 2.0) * uAmp * position.z * position.z * 4.0;',
  // 4 eel: whole-body wave. Morays: the jaw (aW 3) opens and closes as they breathe; resting ones (aAmp ≈ 0.05) curve up out of their hole
  'if (aW > 2.5) { float o = (0.5 + 0.5 * sin(aPhase * 0.35)) * 0.45; vec2 d = transformed.xy - vec2(0.39, -0.002); transformed.xy = vec2(0.39, -0.002) + vec2(d.x * cos(o) + d.y * sin(o), -d.x * sin(o) + d.y * cos(o)); }' +
  'float rest = 1.0 - smoothstep(0.08, 0.15, aAmp);' +
  'transformed.z += sin(aPhase - position.x * 12.0) * uAmp * (0.8 - position.x) + rest * sin(aPhase * 0.3 + position.x * 4.0) * 0.02 * max(0.0, position.x);' +
  'if (rest > 0.0 && position.x > 0.08) transformed.y += rest * 0.5 * pow(position.x - 0.08, 1.5);',
  // 5 jelly: bell pulse + trailing tentacles
  'if (aW > 0.5 && aW < 1.5) { float s = 1.0 + 0.12 * sin(aPhase); transformed.xz *= s; transformed.y *= 2.0 - s; } else if (aW > 1.5) { transformed.x += sin(aPhase - position.y * 3.0) * 0.05 * (-position.y); transformed.z += cos(aPhase * 0.8 - position.y * 2.5) * 0.05 * (-position.y); }',
  // 6 sway (corals, garden eels)
  'transformed.x += sin(aPhase + position.y * 1.5) * uAmp * position.y; transformed.z += cos(aPhase * 0.7) * uAmp * 0.5 * position.y;',
  // 7 flippers (turtle)
  'if (aW > 0.5) { float s = sin(aPhase + aW * 1.3); transformed.y += s * uAmp * max(0.0, abs(position.z) - 0.2); }',
  // 8 tentacles
  'if (aW > 0.0) { transformed.z += sin(aPhase - aW * 5.0 + position.z * 8.0) * uAmp * aW; transformed.y += cos(aPhase * 0.8 - aW * 4.0) * uAmp * 0.6 * aW; }',
];
const FREQ = [0, 0, 1.5, 2, 3, 1.8, 1, 1.5, 1.5];
// sunlight caustics: rippling light lines on up-facing surfaces, fading with depth
const CAUST = { uTime: { value: 0 }, uCaust: { value: 0.9 } };
function caustify(sh) {
  Object.assign(sh.uniforms, CAUST);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW;\nvarying vec3 vCN;')
    .replace('#include <project_vertex>', `{ vec4 cw = vec4(transformed, 1.0); vec3 cn = objectNormal;
      #ifdef USE_INSTANCING
        cw = instanceMatrix * cw; cn = mat3(instanceMatrix) * cn;
      #endif
      cw = modelMatrix * cw; vCW = cw.xyz; vCN = normalize(mat3(modelMatrix) * cn); }
      #include <project_vertex>`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vCW; varying vec3 vCN; uniform float uTime; uniform float uCaust;
    float caustic(vec2 p, float t) {   // warped grid of bright ridges, like light focused by surface waves
      vec2 w = p + vec2(sin(p.y * 0.9 + t), cos(p.x * 0.8 - t * 0.8)) * 0.8;
      w += vec2(sin(w.y * 1.7 - t * 0.6), cos(w.x * 1.5 + t * 0.5)) * 0.4;
      float a = abs(sin(w.x * 1.6)), b = abs(sin(w.y * 1.6 + w.x * 0.5));
      return pow(1.0 - min(a, b), 7.0);
    }`).replace('#include <tonemapping_fragment>', `{ float ck = uCaust * exp(-max(0.0, -vCW.y) / 14.0) * smoothstep(0.15, 0.85, normalize(vCN).y);
      if (ck > 0.003) gl_FragColor.rgb += diffuseColor.rgb * caustic(vCW.xz * 1.8, uTime * 0.8) * ck; }
    #include <tonemapping_fragment>`);
}
const kinds = new Map();
function kindOf(sp) {
  let k = kinds.get(sp.id); if (k) return k;
  const b = BUILD[sp.type](sp), geo = b.geo || merge(b.P), mode = b.mode || 0;
  const map = makeTex(sp), coral = CORAL.has(sp.type), shiny = SHINY.has(sp.id), rm = RM_TYPES[sp.type] && !b.transparent && !sp.f?.garden ? makeRM(sp) : null, fins = sp.type === 'fish';
  const opts = { map, roughness: rm ? 1 : shiny ? 0.28 : coral ? 0.8 : sp.type === 'whale' ? 0.35 : 0.45, metalness: rm ? 1 : shiny ? 0.55 : 0.05, roughnessMap: rm, metalnessMap: rm, side: THREE.DoubleSide, transparent: !!b.transparent, opacity: b.transparent || 1, depthWrite: !b.transparent, alphaTest: b.alphaTest || 0,
    bumpMap: sp.type === 'fish' ? bumpFor('scales') : ['shark', 'ray'].includes(sp.type) ? bumpFor('skin') : coral ? map : null, bumpScale: coral ? 1.5 : 0.8 };
  // animals get a thin wet clearcoat over their skin (slimiest on eels) — without it they look like painted clay
  const mat = rm ? new THREE.MeshPhysicalMaterial({ ...opts, clearcoat: { fish: 0.45, eel: 1, whale: 0.6, shark: 0.2, ray: 0.3, turtle: 0.35 }[sp.type], clearcoatRoughness: sp.type === 'eel' ? 0.15 : 0.28 }) : new THREE.MeshStandardMaterial(opts);
  if (sp.glow) { mat.emissive = new Color(sp.glow.c); mat.emissiveMap = makeGlowTex(sp); mat.emissiveIntensity = 0; }
  const amp = b.amp || 0;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uAmpK = { value: amp };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPhase;\nattribute float aAmp;\nattribute float aW;\nuniform float uAmpK;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n{ float uAmp = uAmpK * aAmp; ${MODE_GLSL[mode]} }`);   // aAmp: how hard this individual is swimming
    if (fins) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat finA = diffuseColor.a; diffuseColor.a = 1.0;')
      .replace('#include <fog_fragment>', '#include <fog_fragment>\n#ifdef USE_FOG\ngl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, 0.3 + 0.7 * finA);   // thin fin membranes let the water show through\n#endif');
    caustify(sh);
  };
  mat.customProgramCacheKey = () => 'anim' + mode + (fins ? 'f' : '');
  let freq = FREQ[mode];
  if (mode === 1) freq = clamp(5 / Math.sqrt(sp.size), 2, 14);
  if (mode === 3) freq = sp.f?.sting ? 3 : 1.3;
  k = { sp, geo, mat, mode, freq, upright: UPRIGHT.has(sp.type) || !!sp.f?.garden, ceph: ['octopus', 'cuttle', 'squid'].includes(sp.type), cap: 0, mesh: null, n: 0, list: [] };
  grow(k, 16); kinds.set(sp.id, k); return k;
}
function grow(k, cap) {
  if (k.mesh) { scene.remove(k.mesh); k.mesh.dispose(); }
  k.cap = cap; k.phase = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); k.phase.setUsage(THREE.DynamicDrawUsage);
  k.amp = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(1), 1); k.amp.setUsage(THREE.DynamicDrawUsage);
  k.geo.setAttribute('aPhase', k.phase); k.geo.setAttribute('aAmp', k.amp);
  k.mesh = new THREE.InstancedMesh(k.geo, k.mat, cap); k.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  k.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); k.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  k.mesh.castShadow = true; k.mesh.receiveShadow = CORAL.has(k.sp.type);
  k.mesh.frustumCulled = false; k.mesh.count = 0; k.list = new Array(cap); scene.add(k.mesh);
}

// ---------- terrain tiles ----------
const detailTex = (() => { // pitted limestone / sand grain, tiled in world space
  const cv = makeCanvas(256, 256), g = cv.getContext('2d'), R = rng(77);
  g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) { const v = 170 + R() * 85 | 0; g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(R() * 256, R() * 256, 1 + R() * 1.5, 1 + R() * 1.5); }
  for (let i = 0; i < 180; i++) { const x = R() * 256, y = R() * 256, r = 0.8 + R() * 2.2; g.fillStyle = `rgba(120,120,120,${0.15 + R() * 0.2})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(110,110,110,0.2)'; for (let i = 0; i < 22; i++) { g.lineWidth = 0.5 + R(); g.beginPath(); let x = R() * 256, y = R() * 256; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();
const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, map: detailTex, bumpMap: detailTex, bumpScale: 2.5 });
rockMat.onBeforeCompile = caustify;
const TILE = 48, tiles = new Map();
const REEF_COLS = ['#b87a86', '#8a6a9a', '#a8804e', '#6a8a4a', '#8a9a58', '#9a8a60', '#5a7a6a', '#b89080'].map(h => new Color(h));  // coralline algae, turf algae, encrusting sponge
const _c = new Color(), _c2 = new Color();
function rockColor(x, d, z) {
  _c.set(stops(ROCK, d)).multiplyScalar(0.8 + 0.35 * fbm(x * 0.3 + z * 0.3, d * 0.3));
  if (d < 55) { // encrusting coral & sponge in 3 m patches
    const flat = x < edgeX(z) - 1, k = vnoise(z * 0.2 + x * 0.2, d * 0.2), a = flat ? Math.floor(x / 6) : Math.floor(d / 6);
    if (k > 0.1) _c.lerp(REEF_COLS[Math.floor(h2(a, Math.floor(z / 6)) * REEF_COLS.length)], clamp((k - 0.1) * 1.5, 0, flat ? 0.22 : 0.45) * clamp(1 - (d - 35) / 20, 0, 1));
  }
  return _c;
}
function tileMesh(pos, col, idx, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, rockMat); m.receiveShadow = true; scene.add(m); return m;
}
function wallTile(kz, kd) {
  const N = 40, S = TILE / N, pos = [], col = [], idx = [], uv = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const z = kz * TILE + i * S, top = topDepth(z), d = Math.min(FLOOR, Math.max(kd * TILE + j * S, top));
    const rough = wallRough(d, z, top);   // (already part of wallX, so what you see is what you bump into)
    const cv = carves.length ? carveAt(d, z) : 0, x = wallX(d, z);   // cave pockets: darker the further in
    pos.push(x, -d, z); uv.push((z - cv * 0.8) / 5, d / 5); const c = rockColor(x, d, z).multiplyScalar((0.85 + rough * 0.4) * (1 - 0.6 * clamp(cv / 3.5, 0, 1))); col.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + N + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return tileMesh(pos, col, idx, uv);
}
const SAND = new Color('#e6dcbc');
function plateauTile(kx, kz) {
  const N = 48, S = TILE / N, pos = [], col = [], idx = [], uv = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const z = kz * TILE + j * S, x = Math.min(kx * TILE + i * S, edgeX(z)), pd = plateau(x, z), sand = fbm(x * 0.07, z * 0.07) - 0.1 + TER.sand * smooth(19, 27, pd);   // deep floors are mostly sand
    // sand gets wave ripples; reef patches get lumpy coral rock
    const bump = sand > 0 ? 0.05 * Math.sin(x * 2.2 + z * 0.9 + vnoise(x * 0.3, z * 0.3) * 3) * smooth(0, 0.15, sand) : (0.35 * vnoise(x * 0.9, z * 0.9) + 0.15 * vnoise(x * 2.7, z * 2.7)) * smooth(0, 0.2, -sand);
    const d = pd - bump;
    pos.push(x, -d, z); uv.push(x / 5, z / 5);
    const c = sand > 0 ? _c2.copy(SAND).multiplyScalar(0.92 + 0.12 * vnoise(x, z) + bump * 2) : rockColor(x, d, z).multiplyScalar(0.85 + bump * 0.5);
    if (sand > 0 && sand < 0.12) c.lerp(rockColor(x, d, z), 1 - sand / 0.12);
    col.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  return tileMesh(pos, col, idx, uv);
}
function updateTiles(force = false) {
  const want = new Set(), d = -diver.p.y, px = diver.p.x, pz = diver.p.z;
  if (Math.abs(px - edgeX(pz)) < 220) for (let kz = Math.floor((pz - 110) / TILE); kz <= Math.floor((pz + 110) / TILE); kz++) for (let kd = Math.max(0, Math.floor((d - 90) / TILE)); kd <= Math.min(Math.floor(FLOOR / TILE), Math.floor((d + 90) / TILE)); kd++) want.add('w' + kz + ',' + kd);
  if (d < 140) for (let kx = Math.floor((px - 120) / TILE); kx * TILE < Math.min(14, px + 120); kx++) for (let kz = Math.floor((pz - 120) / TILE); kz <= Math.floor((pz + 120) / TILE); kz++) want.add('p' + kx + ',' + kz);
  for (const [key, m] of tiles) if (!want.has(key)) { scene.remove(m); m.geometry.dispose(); tiles.delete(key); }
  let budget = force ? 1e9 : 4;
  for (const key of want) {
    if (tiles.has(key)) continue; if (budget-- <= 0) break;
    const [a, b] = key.slice(1).split(',').map(Number);
    tiles.set(key, key[0] === 'w' ? wallTile(a, b) : plateauTile(a, b));
  }
}
const floorGeo = new THREE.PlaneGeometry(700, 700, 40, 40); floorGeo.rotateX(-Math.PI / 2);
{ const p = floorGeo.attributes.position, col = []; for (let i = 0; i < p.count; i++) { p.setY(i, vnoise(p.getX(i) * 0.05, p.getZ(i) * 0.05) * 1.5); _c.set('#5a5046').multiplyScalar(0.8 + 0.3 * vnoise(p.getX(i) * 0.2, p.getZ(i) * 0.2)); col.push(_c.r, _c.g, _c.b); } floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); floorGeo.computeVertexNormals(); const u = floorGeo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * 230, u.getY(i) * 230); }
const floor = new THREE.Mesh(floorGeo, rockMat); scene.add(floor);

// ---------- structures: the wreck, a thila, overhangs, caves and swim-throughs ----------
// Each structure has a world-space box (lo/hi), push(p, m) to keep points out of it, dark(p) for how enclosed a spot is (0 open water → 1 pitch dark),
// sample(r, x0, d0, z0) to find a spot on its surface inside a creature cell (so corals and reef fish settle on it), and lairs: sheltered spots for cave and wreck dwellers.
const structMat = rockMat.clone(); structMat.side = THREE.DoubleSide; structMat.onBeforeCompile = caustify;
const wreckTex = (() => {   // rusted, pitted steel with streaks and encrusting growth
  const cv = makeCanvas(256, 256), g = cv.getContext('2d'), R = rng(505);
  g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { const v = 150 + R() * 105 | 0; g.fillStyle = `rgba(${v},${v * 0.92 | 0},${v * 0.85 | 0},0.5)`; g.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1 + R() * 2); }
  for (let i = 0; i < 70; i++) { const x = R() * 256, y = R() * 256, l = 20 + R() * 70, gr = g.createLinearGradient(x, y, x, y + l); gr.addColorStop(0, 'rgba(120,60,30,0.45)'); gr.addColorStop(1, 'rgba(120,60,30,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + R() * 4, l); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '90,70,60' : '235,225,210'},${0.2 + R() * 0.3})`; g.beginPath(); g.arc(R() * 256, R() * 256, 1 + R() * 4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();
const wreckMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: wreckTex, bumpMap: wreckTex, bumpScale: 2, roughness: 0.85, metalness: 0.15, side: THREE.DoubleSide });
wreckMat.onBeforeCompile = caustify;
const holeMat = new THREE.MeshStandardMaterial({ color: 0x06090b, roughness: 0.15, metalness: 0.5 });   // portholes
let structMeshes = [];
function addMesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; scene.add(m); structMeshes.push(m); return m; }
function bake(geos, colorFn) {   // merge world-space pieces into one geometry with normals, colours from colorFn and world-planar uvs
  const list = geos.map(g => { if (!g.attributes.normal) g.computeVertexNormals(); return g.index ? g.toNonIndexed() : g; });
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], ax = Math.abs(N[i * 3]), ay = Math.abs(N[i * 3 + 1]), az = Math.abs(N[i * 3 + 2]);
    const c = colorFn(x, y, z); C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
    [U[i * 2], U[i * 2 + 1]] = ay >= ax && ay >= az ? [x / 5, z / 5] : ax >= az ? [z / 5, y / 5] : [x / 5, y / 5];   // textures tile in world space without stretching
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  g.computeBoundingSphere(); return g;
}
const bumpy = (g, amt, f = 0.9) => {   // roughen a rock: push each vertex along its normal by a bit of noise
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const k = amt * (vnoise(p.getX(i) * f + 7.1, p.getY(i) * f + p.getZ(i) * f * 0.7) * 0.7 + vnoise(p.getX(i) * f * 3, p.getZ(i) * f * 3 + p.getY(i)) * 0.3); p.setXYZ(i, p.getX(i) + n.getX(i) * k, p.getY(i) + n.getY(i) * k, p.getZ(i) + n.getZ(i) * k); }
  g.computeVertexNormals(); return g;
};
const rockCol = (x, y, z) => rockColor(x, -y, z);

// colliders: boxes (optionally turned by a yaw), ellipsoids, and half-torus arches
const box = (cx, cy, cz, hx, hy, hz, yaw = 0) => ({ k: 'box', c: new Vector3(cx, cy, cz), h: new Vector3(hx, hy, hz), cy: Math.cos(yaw), sy: Math.sin(yaw), yaw });
function colPush(c, p, m) {
  if (c.k === 'box') {
    const dx = p.x - c.c.x, dy = p.y - c.c.y, dz = p.z - c.c.z, lx = dx * c.cy - dz * c.sy, lz = dx * c.sy + dz * c.cy;
    const ox = c.h.x + m - Math.abs(lx), oy = c.h.y + m - Math.abs(dy), oz = c.h.z + m - Math.abs(lz);
    if (ox <= 0 || oy <= 0 || oz <= 0) return;
    let nx = lx, ny = dy, nz = lz;
    if (ox < oy && ox < oz) nx = Math.sign(lx || 1) * (c.h.x + m); else if (oy < oz) ny = Math.sign(dy || 1) * (c.h.y + m); else nz = Math.sign(lz || 1) * (c.h.z + m);
    p.set(c.c.x + nx * c.cy + nz * c.sy, c.c.y + ny, c.c.z - nx * c.sy + nz * c.cy);
  } else if (c.k === 'ell') {
    const rx = c.r.x + m, ry = c.r.y + m, rz = c.r.z + m, qx = (p.x - c.c.x) / rx, qy = (p.y - c.c.y) / ry, qz = (p.z - c.c.z) / rz, L = Math.hypot(qx, qy, qz);
    if (L < 1 && L > 1e-6) p.set(c.c.x + qx / L * rx, c.c.y + qy / L * ry, c.c.z + qz / L * rz);
  } else if (c.k === 'arch') {   // the tube follows a half circle of radius R standing on the ground, in the plane of axis a and up
    const dx = p.x - c.c.x, dy = p.y - c.c.y, dz = p.z - c.c.z, x = dx * c.a.x + dz * c.a.z, w = -dx * c.a.z + dz * c.a.x;
    let qx, qy; if (dy < 0) { qx = Math.sign(x || 1) * c.R; qy = 0; } else { const L = Math.hypot(x, dy) || 1; qx = x / L * c.R; qy = dy / L * c.R; }
    const vx = x - qx, vy = dy - qy, dist = Math.hypot(vx, vy, w), lim = c.r + m;
    if (dist < lim && dist > 1e-6) { const k = lim / dist, nx = qx + vx * k, ny = qy + vy * k, nw = w * k; p.set(c.c.x + nx * c.a.x - nw * c.a.z, c.c.y + ny, c.c.z + nx * c.a.z + nw * c.a.x); }
  }
}
const colRadius = c => c.k === 'box' ? c.h.length() : c.k === 'ell' ? Math.max(c.r.x, c.r.y, c.r.z) : c.R + c.r;
function makeStruct(kind, cols, extra = {}) {
  const st = { kind, cols, lo: new Vector3(1e9, 1e9, 1e9), hi: new Vector3(-1e9, -1e9, -1e9), push: (p, m) => { for (const c of cols) colPush(c, p, m); }, dark: () => 0, sample: null, lairs: [] };
  for (const c of cols) { const r = colRadius(c); st.lo.min(_v.copy(c.c).subScalar(r)); st.hi.max(_v.copy(c.c).addScalar(r)); }
  Object.assign(st, extra); structs.push(st); return st;
}
function darkAt(p) {   // the most enclosed structure at this point (also remembers which kind of place it is)
  let v = 0; darkAt.kind = null;
  for (const st of structs) if (p.x > st.lo.x - 2 && p.x < st.hi.x + 2 && p.y > st.lo.y - 2 && p.y < st.hi.y + 2 && p.z > st.lo.z - 2 && p.z < st.hi.z + 2) { const k = st.dark(p); if (k > v) { v = k; darkAt.kind = st.kind; } }
  return v;
}
// benthic creatures settle on structure surfaces facing any way: turn their "up" to the surface normal
const _an = new Vector3();
// a resting moray: its back half is hidden in a hole, so point its body out of the rock (up a little from a wall, at a slant from the sand)
const _mx = new Vector3(), _my = new Vector3(), _mz = new Vector3(), _mm = new Matrix4();
function seatMoray(c, n, r) {
  _mx.copy(n).addScaledVector(UP, 0.35); if (n.y > 0.7) { const a = r() * 6.283; _mx.x += Math.cos(a) * 1.1; _mx.z += Math.sin(a) * 1.1; }
  _mx.normalize(); _mz.crossVectors(_mx, UP); if (_mz.lengthSq() < 1e-4) _mz.set(0, 0, 1); _mz.normalize(); _my.crossVectors(_mz, _mx);
  c.q.setFromRotationMatrix(_mm.makeBasis(_mx, _my, _mz)); c.p.addScaledVector(_mx, -0.12 * c.size); c.me = null;
}
const alignTo = (c, n, r) => { _an.copy(n); if (n.y > -0.5) _an.y += 1.2; c.q.setFromUnitVectors(UP, _an.normalize()).multiply(_q.setFromAxisAngle(UP, r() * 6.283)); c.yaw = 0; };   // lean out from the surface but grow toward the light (ceilings: hang down)

// an overhang: a flattened, lumpy ledge of rock sticking out of the wall, shading the reef under it
function buildLedge(cx, cy, cz, rx, ry, rz, R) {
  const c = { k: 'ell', c: new Vector3(cx, cy, cz), r: new Vector3(rx, ry, rz) };
  const g = bumpy(new THREE.SphereGeometry(1, 32, 16).scale(rx, ry, rz).translate(cx, cy, cz), Math.min(ry * 0.8, 0.7), 0.6);
  addMesh(bake([g], rockCol), structMat);
  const under = new Vector3(cx + rx * 0.35, cy - ry - 1, cz), spots = [];
  for (let i = 0; i < 6; i++) { const ox = (R() * 0.9 - 0.2) * rx, oz = (R() - 0.5) * 1.6 * rz, k = 1 - (ox / rx) ** 2 - (oz / rz) ** 2; if (k > 0.05) spots.push({ p: new Vector3(cx + ox, cy - ry * Math.sqrt(k) * 0.9, cz + oz), n: new Vector3(0, -1, 0) }); }
  return makeStruct('overhang', [c], {
    dark: p => { const a = (p.x - cx) / (rx * 1.1), b = (p.z - cz) / (rz * 1.1); return p.y < cy && p.y > cy - ry - 3.5 && a > -1 && a < 1 && b * b < 1 ? 0.3 * (1 - b * b) : 0; },
    lairs: [{ kind: 'overhang', p: under, r: Math.min(rx, rz) * 0.8, spots }],
  });
}
// a cave: a pocket carved back into the wall, with a lip of rock over its mouth
function buildWallCave(z, d, rz, rd, depth, R) {
  const k = { z, d, rz, rd, depth }; carves.push(k);
  const x0 = wallRaw(d, z);
  buildLedge(wallRaw(d - rd * 0.8, z) + 0.7, -(d - rd * 0.9), z, 1.8 + R(), 0.9, rz * 1.15, R);
  const spots = [];
  for (let i = 0; i < 6; i++) { const zz = z + (R() - 0.5) * rz, dd = d + rd * (0.3 + R() * 0.5); spots.push({ p: new Vector3(wallX(dd, zz) + 0.05, -dd, zz), n: new Vector3(0.3, 1, 0).normalize() }); }
  for (let i = 0; i < 4; i++) { const zz = z + (R() - 0.5) * rz, dd = d - rd * (0.3 + R() * 0.4); spots.push({ p: new Vector3(wallX(dd, zz) + 0.4, -dd, zz), n: new Vector3(0, -1, 0) }); }   // cup corals on the ceiling
  return makeStruct('cave', [], {
    lo: new Vector3(x0 - depth - 1, -(d + rd), z - rz), hi: new Vector3(x0 + 2, -(d - rd), z + rz), push: () => {},
    dark: p => { const into = wallRaw(-p.y, p.z) - p.x, cv = carveAt(-p.y, p.z); return into > 0 && cv > 0.3 ? 0.88 * clamp(into / (depth * 0.55), 0, 1) : 0; },
    lairs: [{ kind: 'cave', p: new Vector3(x0 - depth * 0.5, -d, z), r: Math.min(rz, rd) * 0.8, spots }],
  });
}
// a swim-through: a few rock arches in a row make a short tunnel you can fin through
function buildArches(x, z, ax, az, n, R0, r0) {
  const a = new Vector3(ax, 0, az).normalize(), along = new Vector3(-a.z, 0, a.x), cols = [], geos = [];
  const curve = new THREE.Curve(); curve.getPoint = (u, out = new Vector3()) => { const t = -0.3 + u * (Math.PI + 0.6); return out.set(Math.cos(t) * R0, Math.sin(t) * R0, 0); };
  for (let i = 0; i < n; i++) {
    const px = x + along.x * (i - (n - 1) / 2) * r0 * 1.5, pz = z + along.z * (i - (n - 1) / 2) * r0 * 1.5, c = new Vector3(px, -plateau(px, pz) + 0.3, pz);
    const R = R0 * (1 - 0.06 * (i % 2)), r = r0 * (0.95 + 0.1 * (i % 2));
    cols.push({ k: 'arch', c, a, R, r: r * 1.05 });
    const g = new THREE.TubeGeometry(curve, 40, r, 14, false); g.scale(R / R0, R / R0, 1);
    g.applyMatrix4(new Matrix4().makeBasis(a, UP, along).setPosition(c)); geos.push(bumpy(g, r * 0.3, 0.7));
  }
  addMesh(bake(geos, rockCol), structMat);
  return makeStruct('arch', cols, {
    dark: p => { let v = 0; for (const c of cols) { const dx = p.x - c.c.x, dy = p.y - c.c.y, dz = p.z - c.c.z, xx = dx * a.x + dz * a.z, w = -dx * a.z + dz * a.x; if (dy > 0 && Math.hypot(xx, dy) < c.R - c.r && Math.abs(w) < c.r * 1.3) v += 0.2; } return Math.min(0.5, v); },
    lairs: [{ kind: 'overhang', p: new Vector3(x, -plateau(x, z) + 1.2, z), r: R0 * 0.5, spots: [] }],
  });
}

// a thila: a coral pinnacle rising from the sandy floor, stepped with ledges, undercut into overhangs, with caves cut into its sides
function buildThila(cx, cz, T) {
  const base = plateau(cx, cz), bot = base + 3, ledges = [T + 5, T + 11.5, T + 18];
  const caves = [{ th: 0.5, d: T + 13.5, rt: 0.26, rd: 2.6, depth: 4.5 }, { th: 2.8, d: T + 19, rt: 0.22, rd: 2.2, depth: 4 }, { th: 4.4, d: T + 8, rt: 0.2, rd: 1.8, depth: 3.2 }];
  const angD = (a, b) => { const d = ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return d; };
  const Rb = (d, th) => {
    const k = smooth(T, base, d), c = Math.cos(th), s = Math.sin(th);
    let r = 10 + 6 * Math.pow(k, 1.6) + 2.6 * fbm(c * 1.6 + d * 0.05, s * 1.6 - d * 0.04) + 1.1 * vnoise(c * 5 + d * 0.3, s * 5) + 0.5 * vnoise(c * 13 + d * 0.8, s * 13);
    for (const L of ledges) r += 2.4 * smooth(L - 0.7, L, d) * (1 - smooth(L + 0.3, L + 2.6, d)) * (0.4 + 0.6 * vnoise(c * 2.5 + L, s * 2.5));   // a shelf on top, undercut below
    return r * Math.pow(clamp((d - T) / 2.5, 0, 1), 0.35);   // a broad, flattish top
  };
  const cut = (d, th) => { let v = 0; for (const k of caves) { const a = angD(th, k.th) / k.rt, b = (d - k.d) / k.rd, q = a * a + b * b; if (q < 1) v = Math.max(v, k.depth * Math.pow(1 - q, 0.45)); } return v; };
  const Rt = (d, th) => Math.max(0, Rb(d, th) - cut(d, th));
  // mesh: rings every half metre from the top down into the sand
  const NT = 96, rows = Math.ceil((bot - T) / 0.5), pos = [], idx = [];
  for (let i = 0; i <= rows; i++) { const d = T + (bot - T) * i / rows; for (let j = 0; j <= NT; j++) { const th = j / NT * Math.PI * 2, r = Rt(d, th); pos.push(cx + Math.cos(th) * r, -d, cz + Math.sin(th) * r); } }
  for (let i = 0; i < rows; i++) for (let j = 0; j < NT; j++) { const a = i * (NT + 1) + j, b = a + NT + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const thilaCol = new Color();
  addMesh(bake([g], (x, y, z) => {   // every surface crusted with sponges, coralline algae and soft coral bases; darker inside the caves
    const th = Math.atan2(z - cz, x - cx), cv = cut(-y, th), k = vnoise(x * 0.35 + z * 0.2, y * 0.35);
    thilaCol.copy(rockColor(x, -y, z));
    if (k > -0.2) thilaCol.lerp(REEF_COLS[Math.floor(h2(Math.floor(x / 2 + z / 2.5), Math.floor(y / 2)) * REEF_COLS.length)], clamp((k + 0.2) * 1.1, 0, 0.45));
    return thilaCol.multiplyScalar(1 - 0.55 * clamp(cv / 3, 0, 1));
  }), structMat);
  const lairs = [];
  for (const k of caves) { const r = Rb(k.d, k.th) - k.depth * 0.55, dir = new Vector3(Math.cos(k.th), 0, Math.sin(k.th)), spots = [];
    for (let i = 0; i < 6; i++) { const th = k.th + (Math.random() - 0.5) * k.rt, d = k.d + k.rd * (0.2 + Math.random() * 0.6), rr = Rt(d, th); spots.push({ p: new Vector3(cx + Math.cos(th) * rr, -d, cz + Math.sin(th) * rr), n: new Vector3(Math.cos(th) * 0.4, 1, Math.sin(th) * 0.4).normalize() }); }
    lairs.push({ kind: 'cave', p: new Vector3(cx + dir.x * r, -k.d, cz + dir.z * r), r: 1.6, spots }); }
  for (let i = 0; i < 5; i++) { const th = i * 1.26 + 0.3, L = ledges[i % 3], d = L + 1.8, r = Rt(d, th) + 0.9; lairs.push({ kind: 'overhang', p: new Vector3(cx + Math.cos(th) * r, -d, cz + Math.sin(th) * r), r: 1.5, spots: [{ p: new Vector3(cx + Math.cos(th) * (r + 0.2), -(L + 0.9), cz + Math.sin(th) * (r + 0.2)), n: new Vector3(0, -1, 0) }] }); }
  return makeStruct('cave', [], {
    lo: new Vector3(cx - 32, -bot, cz - 32), hi: new Vector3(cx + 32, -T + 1, cz + 32), lairs,
    push(p, m) {
      const dx = p.x - cx, dz = p.z - cz, rho = Math.hypot(dx, dz), d = -p.y;
      if (d < T - m || d > bot) return;
      const th = Math.atan2(dz, dx), R = Rt(Math.max(d, T), th);
      if (rho >= R + m) return;
      const penR = R + m - rho; let penU = Infinity;
      if (d < T + 2.5) { const Rtop = Rt(T + 2.5, th) || 1; penU = d - (T + 2.5 * Math.pow(rho / Rtop, 1 / 0.35) - m); }
      if (penU < penR) p.y = -(d - penU); else { const k = (R + m) / (rho || 1e-3); p.x = cx + dx * k; p.z = cz + dz * k; }
    },
    dark(p) { const d = -p.y; if (d < T || d > base) return 0; const th = Math.atan2(p.z - cz, p.x - cx), rho = Math.hypot(p.x - cx, p.z - cz), cv = cut(d, th), rb = Rb(d, th); return cv > 0.3 && rho < rb ? 0.88 * clamp((rb - rho) / (cv * 0.6), 0, 1) : 0; },
    sample(r, x0, d0, z0) {
      for (let i = 0; i < 3; i++) {
        const th = r() * Math.PI * 2, d = d0 + r() * CELLY; if (d < T || d > base) continue;
        const R = Rt(d, th), x = cx + Math.cos(th) * R, z = cz + Math.sin(th) * R; if (x < x0 || x >= x0 + CELL || z < z0 || z >= z0 + CELL) continue;
        const up = d < T + 2.5 ? 2 * (1 - (d - T) / 2.5) : 0.25;
        return { p: new Vector3(x, -d, z), n: new Vector3(Math.cos(th), up, Math.sin(th)).normalize(), st: true };
      }
      return null;
    },
  });
}

// the Maldives Victory: a ~110 m cargo ship sitting upright on the sand. Local coordinates: x across (port −), y up from the keel, z along (bow +)
function buildWreck(ox, oy, oz) {
  const B = 7.5, L0 = -50, L1 = 58, geos = [], cols = [], extras = [], holes = [];
  const V = (x, y, z) => new Vector3(ox + x, oy + y, oz + z);
  const hb = z => z < -44 ? B * (0.82 + 0.18 * Math.sqrt(clamp(1 - ((-44 - z) / 6) ** 2, 0, 1))) : z > 36 ? B * Math.max(0, 1 - ((z - 36) / 22) ** 1.8) : B;
  const keel = z => z > 44 ? 4.5 * Math.pow(smooth(44, 58, z), 1.3) : z < -44 ? 3 * Math.pow((-44 - z) / 6, 1.5) : 0;
  const rail = z => 9.8 + 2.2 * smooth(38, 58, z);
  // hull: one thin skin from gunwale to gunwale — flat bottom, rounded bilges, a raked bow — with the gash the reef tore in the port side
  {
    const NZ = 108, K = 10, pos = [], idx = [], ring = 2 * K - 1;
    const half = z => { const b = Math.max(0.05, hb(z)), yb = keel(z), top = rail(z), r = Math.min(1.8, b * 0.9, (top - yb) / 2), P = [[0, yb], [(b - r) / 2, yb], [b - r, yb]];
      for (let k = 1; k <= 4; k++) { const a = k / 4 * Math.PI / 2; P.push([b - r + Math.sin(a) * r, yb + r - Math.cos(a) * r]); }
      P.push([b, yb + r + (top - yb - r) / 3], [b, yb + r + (top - yb - r) * 2 / 3], [b, top]); return P; };
    for (let i = 0; i <= NZ; i++) { const z = L0 + (L1 - L0) * i / NZ, h = half(z); for (let j = 0; j < ring; j++) { const [x, y] = j < K - 1 ? h[K - 1 - j] : h[j - K + 1]; pos.push(ox + (j < K - 1 ? -x : x), oy + y, oz + z); } }
    for (let i = 0; i < NZ; i++) for (let j = 0; j < ring - 1; j++) {
      const a = i * ring + j, b = a + ring, zc = L0 + (L1 - L0) * (i + 0.5) / NZ, yc = (pos[a * 3 + 1] + pos[(a + 1) * 3 + 1]) / 2 - oy;
      if (j < K - 1 && ((zc - 10) / 3.4) ** 2 + ((yc - 3.4) / 2) ** 2 < 1 + 0.5 * (h2(i, j) - 0.5)) continue;   // the breach
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); geos.push(g);
    cols.push(box(0, 0.3, -2, B, 0.3, 44));                                                   // bottom
    cols.push(box(B - 0.2, 4.9, -6, 0.25, 4.9, 44));                                          // starboard side
    cols.push(box(-B + 0.2, 4.9, -21.5, 0.25, 4.9, 28.5), box(-B + 0.2, 4.9, 25.5, 0.25, 4.9, 12.5), box(-B + 0.2, 0.8, 10, 0.25, 0.8, 3), box(-B + 0.2, 7.6, 10, 0.25, 2.2, 3));   // port side around the breach
    const b48 = hb(48);
    for (const s of [-1, 1]) {   // the bow in two angled pieces per side, following the flare
      cols.push(box(s * (B + b48) / 2, 5.5, 42, 0.3, 5.5, Math.hypot(B - b48, 12) / 2, Math.atan2(s * (b48 - B), 12)));
      cols.push(box(s * b48 / 2, 7, 53, 0.3, 4.5, Math.hypot(b48, 10) / 2, Math.atan2(-s * b48, 10)));
    }
    cols.push(box(0, 6.4, L0, B * 0.82, 3.4, 0.2));                                          // transom
  }
  // everything else is boxes: what you see is what you bump into
  const solid = [];
  const S = (x, y, z, hx, hy, hz, yaw = 0) => { const b = box(x, y, z, hx, hy, hz, yaw); cols.push(b); solid.push(b); return b; };
  const HATCH = [[26, 34], [6, 16], [-16, -6]];
  for (const s of [-1, 1]) S(s * 5.7, 8.85, -3.5, 1.7, 0.15, 45.5);                                // main deck either side of the hatches
  for (const [z0, z1] of [[-49, -16], [-6, 6], [16, 26], [34, 42]]) S(0, 8.85, (z0 + z1) / 2, 4, 0.15, (z1 - z0) / 2);
  for (const [z0, z1] of HATCH) { for (const s of [-1, 1]) { S(s * 4.1, 9.4, (z0 + z1) / 2, 0.12, 0.45, (z1 - z0) / 2 + 0.2); S(0, 9.4, s > 0 ? z1 + 0.1 : z0 - 0.1, 4.2, 0.45, 0.12); } }   // hatch coamings
  S(0, 10.1, 42, 7.3, 1.1, 0.15);                                                                  // front of the raised forecastle
  for (const [z0, z1] of [[42, 46], [46, 50], [50, 54], [54, 57]]) S(0, 11.05, (z0 + z1) / 2, Math.max(0.6, hb(z1) - 0.2), 0.15, (z1 - z0) / 2);
  for (const z of [20, 0]) { for (const s of [-1, 1]) S(s * 4.7, 4.65, z, 2.7, 4.05, 0.15); S(0, 6.65, z, 2, 2.05, 0.15); }   // bulkheads, each with a doorway through
  S(0, 4.65, -28, 7.3, 4.05, 0.15);
  S(0, 11.5, -38, 6, 2.5, 8);                                                                      // superstructure
  S(0, 14.5, -30, 6, 0.5, 0.12); S(0, 16.55, -30, 6, 0.25, 0.12);                                   // bridge front: the windows are long gone
  for (let x = -6; x <= 6.01; x += 1.5) S(x, 15.5, -30, 0.1, 0.8, 0.12);
  S(0, 15.4, -46, 6, 1.4, 0.12);
  for (const s of [-1, 1]) { S(s * 6, 15.4, -42.25, 0.12, 1.4, 3.75); S(s * 6, 15.4, -32.75, 0.12, 1.4, 2.75); S(s * 6, 16.7, -37, 0.12, 0.1, 1.5); S(s * 7.25, 13.95, -31.5, 1.25, 0.1, 1.5); }   // side walls with doors, bridge wings
  S(0, 16.95, -38, 6.4, 0.15, 8.4);                                                                // bridge roof
  S(0, 3.8, -51.4, 0.2, 2.6, 1.3);                                                                 // rudder
  const crates = [[2.5, 1.5, 33, 1.2, 0.9, 1.4, 0.3], [-3, 1.3, 29, 1, 0.7, 1.8, -0.2], [0.5, 1.2, 11, 1.5, 0.6, 1, 0.8], [-4, 1.6, 14, 1, 1, 1, 0.1], [3.5, 1.1, -10, 1.8, 0.5, 0.9, 1.2], [-2, 1.4, -19, 1.1, 0.8, 1.1, 0.5], [-1, 3, -19, 0.8, 0.6, 0.8, 0.9]];
  for (const c of crates) S(...c);                                                                 // cargo still lying in the holds
  for (const b of solid) { const g = new THREE.BoxGeometry(b.h.x * 2, b.h.y * 2, b.h.z * 2); g.rotateY(b.yaw); g.translate(ox + b.c.x, oy + b.c.y, oz + b.c.z); geos.push(g); }
  const cyl = (x, y, z, r0, r1, len, rx = 0, rz = 0, seg = 12) => { const g = new THREE.CylinderGeometry(r1, r0, len, seg); g.translate(0, len / 2, 0); g.rotateX(rx); g.rotateZ(rz); g.translate(ox + x, oy + y, oz + z); return g; };
  geos.push(cyl(0, 17.1, -41, 1.6, 1.4, 4.6, 0, 0, 20));                                            // funnel
  cols.push(box(0, 19.4, -41, 1.5, 2.3, 1.5));
  for (const zm of [38, 21]) {   // masts with crosstrees, cargo derricks and their rigging
    geos.push(cyl(0, 9, zm, 0.34, 0.24, 13)); cols.push(box(0, 15.5, zm, 0.35, 6.5, 0.35));
    const ct = new THREE.BoxGeometry(5.2, 0.25, 0.3); ct.translate(ox, oy + 18.6, oz + zm); geos.push(ct);
    for (const s of [-1, 1]) { geos.push(cyl(0, 10.2, zm, 0.2, 0.14, 9.5, s * 1.05, 0)); for (const sx of [-1, 1]) { const a = new Vector3(0, 21.5, zm), b = new Vector3(sx * 7.1, 9.8, zm + s * 3), d = b.clone().sub(a); const g = new THREE.CylinderGeometry(0.035, 0.035, d.length(), 4); g.translate(0, d.length() / 2, 0); g.applyQuaternion(_q.setFromUnitVectors(UP, d.normalize())); g.translate(ox + a.x, oy + a.y, oz + a.z); geos.push(g); } }
  }
  geos.push(cyl(0, 17.1, -34, 0.12, 0.1, 4));                                                       // radar mast on the bridge roof
  { const hub = new THREE.SphereGeometry(0.5, 12, 8); hub.translate(ox, oy + 3.4, oz - 50.3); geos.push(hub);   // propeller
    for (let k = 0; k < 4; k++) { const g = new THREE.BoxGeometry(0.7, 1.5, 0.1); g.translate(0, 1.05, 0); g.rotateY(0.35); g.rotateZ(k * Math.PI / 2 + 0.4); g.translate(ox, oy + 3.4, oz - 50.3); geos.push(g); } }
  for (let i = 0; i < 38; i++) {   // the anchor chain runs from the hawse pipe down to the sand
    const u = i / 37, x = -3.2 - 1.2 * u, z = 54.5 + 12 * u, y = 1 + 9.6 * Math.pow(1 - u, 1.7);
    const g = new THREE.TorusGeometry(0.24, 0.07, 5, 10); g.rotateY(Math.PI / 2); if (i % 2) g.rotateZ(Math.PI / 2); g.rotateX(Math.atan2(9.6 * 1.7 * Math.pow(1 - u, 0.7) / 12, 1)); g.translate(ox + x, oy + y, oz + z); geos.push(g);   // alternate links turn 90°
  }
  for (let z = -44; z <= -32; z += 3) for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10); g.rotateZ(Math.PI / 2); g.translate(ox + s * (B + 0.02), oy + 8, oz + z); holes.push(g); }   // portholes
  for (let z = -44; z <= -32; z += 2.4) for (const s of [-1, 1]) for (const y of [10.8, 12.6]) { const g = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10); g.rotateZ(Math.PI / 2); g.translate(ox + s * 6.03, oy + y, oz + z); holes.push(g); }
  const paint = new Color(), rust = new Color('#6e4a30');
  addMesh(bake(geos, (x, y, z) => {   // faded antifouling red below, black topsides, once-white superstructure; rust, then coralline algae, sponges and turf
    const ly = y - oy; paint.set(ly < 5.5 ? '#5a2e24' : ly > 12 ? '#8a8272' : '#4e4a44');
    paint.lerp(rust, 0.3 + 0.3 * vnoise(x * 0.4 + z * 0.1, y * 0.4));
    const k = fbm(x * 0.35 + 40, z * 0.35 + y * 0.5);
    if (k > 0.02) paint.lerp(REEF_COLS[Math.floor(h2(Math.floor(x / 2.5 + z / 3), Math.floor(y / 2.5)) * REEF_COLS.length)], clamp((k - 0.02) * 2.2, 0, 0.7));
    return paint.multiplyScalar(0.8 + 0.3 * vnoise(x * 1.3, z * 1.3 + y));
  }), wreckMat);
  addMesh(bake(holes, () => paint.set('#ffffff')), holeMat);
  // surfaces corals settle on (weights favour the masts, where sea fans and soft corals crowd in the current)
  const surf = [], R = (o, a, b, n, w = 1) => surf.push({ o: V(...o), a: new Vector3(...a), b: new Vector3(...b), n: new Vector3(...n).normalize(), w: w * new Vector3(...a).length() * new Vector3(...b).length() });
  for (const s of [-1, 1]) { R([s * (B + 0.05), 1.5, -44], [0, 0, 80], [0, 8, 0], [s, 0, 0]); R([s * 4.2, 9.02, -48], [s * 3, 0, 0], [0, 0, 89], [0, 1, 0]); }
  for (const [z0, z1] of [[-29, -16], [-6, 6], [16, 26], [34, 42], [42, 50]]) R([-4, z0 >= 42 ? 11.22 : 9.02, z0], [8, 0, 0], [0, 0, z1 - z0], [0, 1, 0]);
  R([-6.3, 17.12, -46.3], [12.6, 0, 0], [0, 0, 16.6], [0, 1, 0]);
  for (const zm of [38, 21]) for (const s of [-1, 1]) R([s * 0.36, 10, zm - 0.3], [0, 0, 0.6], [0, 11, 0], [s, 0, 0], 40);
  R([-6.5, 0.62, -27], [13, 0, 0], [0, 0, 68], [0, 1, 0], 0.25);
  const totalW = surf.reduce((a, s) => a + s.w, 0);
  const hold = { lo: V(-7.2, 0.6, -28), hi: V(7.2, 8.7, 42) }, bridge = { lo: V(-6, 14, -46), hi: V(6, 16.8, -30) };
  const inBox = (p, b) => p.x > b.lo.x && p.x < b.hi.x && p.y > b.lo.y && p.y < b.hi.y && p.z > b.lo.z && p.z < b.hi.z;
  const holdSpots = z => Array.from({ length: 5 }, (_, i) => ({ p: V(-5 + i * 2.5, 0.62, z + (i % 2 ? 2 : -2)), n: new Vector3(0, 1, 0) }));
  for (const c of cols) c.c.add(_v.set(ox, oy, oz));   // colliders were laid out in ship coordinates
  return makeStruct('wreck', cols, {
    dark(p) {
      if (inBox(p, hold)) { const lz = p.z - oz, lx = Math.abs(p.x - ox), open = lx < 4 && HATCH.some(([a, b]) => lz > a && lz < b) ? smooth(3, 8, p.y - oy) : 0; return 0.85 - 0.45 * open; }
      return inBox(p, bridge) ? 0.5 : 0;
    },
    sample(r, x0, d0, z0) {
      for (let i = 0; i < 4; i++) {
        let q = r() * totalW, s = surf[0]; for (const t of surf) { if ((q -= t.w) <= 0) { s = t; break; } }
        const p = s.o.clone().addScaledVector(s.a, r()).addScaledVector(s.b, r());
        if (p.x >= x0 && p.x < x0 + CELL && p.z >= z0 && p.z < z0 + CELL && -p.y >= d0 && -p.y < d0 + CELLY) return { p: p.addScaledVector(s.n, 0.02), n: s.n.clone(), st: true };
      }
      return null;
    },
    lairs: [{ kind: 'wreck', p: V(0, 3.5, 31), r: 5, spots: holdSpots(31) }, { kind: 'wreck', p: V(0, 3.5, 10), r: 5, spots: holdSpots(10) }, { kind: 'wreck', p: V(0, 3.5, -14), r: 5, spots: holdSpots(-14) },
      { kind: 'wreck', p: V(0, 15.3, -40), r: 3, spots: [] }, { kind: 'overhang', p: V(0, 1.6, -52), r: 2, spots: [] }],
  });
}

// set up the terrain and structures for a dive site; returns where the diver starts
function buildSite(s) {
  for (const m of structMeshes) { scene.remove(m); m.geometry.dispose(); } structMeshes = []; structs.length = 0; carves.length = 0;
  for (const m of tiles.values()) { scene.remove(m); m.geometry.dispose(); } tiles.clear();   // the terrain may be shaped differently here
  const L = s.layout, R = rng(hash(s.id) + 99);
  TER = L === 'thila' ? { top: 19, slope: 0.45, max: 12, sand: 1 } : L === 'wreck' ? { top: 6, slope: 0.5, max: 28, sand: 1 } : { top: 3, slope: 0.09, max: 14, sand: 0 };
  let start = null;
  if (L === 'wreck') {
    let e = 1e9; for (let z = -70; z <= 80; z += 5) e = Math.min(e, edgeX(z));
    const ox = e - 70, oz = 0; TER.flat = { x: ox, z: oz + 4, rx: 22, rz: 75 };
    buildWreck(ox, -(plateau(ox, oz) + 1), oz);
    buildArches(ox + 26, 72, 1, 0, 1, 4.2, 1.3);
    start = { p: new Vector3(ox + 13, -(plateau(ox, oz) - 20), oz + 30), yaw: Math.PI, pitch: -0.2 };
  } else if (L === 'thila') {
    const cx = edgeX(0) - 55, cz = 0;
    buildThila(cx, cz, 7);
    buildArches(cx + 30, cz + 14, 0, 1, 3, 4, 1.3);
    start = { p: new Vector3(cx + 17, -8, cz + 4), yaw: Math.PI - 0.2, pitch: -0.25 };
  }
  const caveAt = L === 'caves' ? [[-45, 13], [22, 18], [68, 24], [-110, 16]] : [];
  if (L !== 'thila') {   // ledges jut from the wall here and there (every few metres at Banana Reef, with caves cut in between)
    for (let z = -260; z < 260; z += (L === 'caves' ? 16 : 45) + R() * 22) {
      const d = Math.max(topDepth(z) + 3.5, 6) + R() * 26; if (caveAt.some(([cz]) => Math.abs(z - cz) < 10)) continue;
      buildLedge(wallRaw(d, z) + 0.3, -d, z, 2.3 + R() * 1.5, 0.75 + R() * 0.5, 2.6 + R() * 3, R);
    }
  }
  for (const [z, d] of caveAt) buildWallCave(z, Math.max(d, topDepth(z) + 5), 4 + R() * 1.5, 2.4 + R() * 0.6, 4.5 + R() * 1.5, R);
  return start;
}

// ---------- surface, sun shafts, particles ----------
// Seen from below, the surface shows the sky only inside Snell's window (a ~97° cone overhead); outside it mirrors the deep water.
const surfU = { uTime: { value: 0 }, uNight: { value: 0 }, uFogD: { value: 0.02 }, uWater: { value: new Color() }, uSun: { value: new Vector3(20, 60, 10).normalize() } };
const surface = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 1, 1), new THREE.ShaderMaterial({ uniforms: surfU, side: THREE.DoubleSide,
  vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform float uTime, uNight, uFogD; uniform vec3 uWater, uSun; varying vec3 vW;
    void main() {
      vec3 d = normalize(vW - cameraPosition);
      float rip = sin(vW.x * 1.3 + uTime * 1.6) * 0.5 + sin(vW.z * 1.7 - uTime * 1.2) * 0.5 + sin((vW.x + vW.z) * 0.6 + uTime) * 0.4;
      float ct = d.y + rip * 0.02, inside = smoothstep(0.645, 0.675, ct), edge = smoothstep(0.6, 0.66, ct) * (1.0 - smoothstep(0.66, 0.72, ct));
      float sd = max(dot(d, uSun), 0.0);
      vec3 sky = mix(vec3(0.3, 0.58, 0.75), vec3(0.62, 0.8, 0.9), smoothstep(0.66, 1.0, ct)) + pow(sd, 350.0) * 4.0 + pow(sd, 18.0) * 0.25;
      if (uNight > 0.5) sky = vec3(0.01, 0.02, 0.05) + pow(sd, 900.0) * 3.0 + pow(sd, 40.0) * 0.08;
      vec3 mirror = uWater * (0.75 + 0.35 * (0.5 + 0.5 * rip));
      vec3 col = mix(mirror, sky, inside) + edge * (uNight > 0.5 ? vec3(0.0) : vec3(0.1, 0.16, 0.2));
      float dist = length(vW - cameraPosition), fogF = 1.0 - exp(-pow(uFogD * dist * 0.55, 2.0));
      gl_FragColor = vec4(mix(col, uWater, fogF), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` }));
surface.rotation.x = -Math.PI / 2; scene.add(surface);
const shaftTex = (() => { const cv = makeCanvas(4, 128), g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(cv); })();
// Sun shafts: soft-edged (faded where you see a shaft's side at a glancing angle), brightest just under the surface, shimmering as the
// waves above focus and scatter the light, and faded out close to you and in the distance so they never pop or fill the view
const shaftU = { uTime: { value: 0 }, uK: { value: 0 } };
const shaftMat = new THREE.ShaderMaterial({ uniforms: shaftU, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: 'varying vec3 vW; varying vec3 vN; varying float vY; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vY = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform float uTime, uK; varying vec3 vW; varying vec3 vN; varying float vY;
    void main() {
      vec3 v = normalize(cameraPosition - vW);
      float edge = pow(abs(dot(normalize(vN), v)), 2.5);
      float fall = pow(vY, 1.6) * (1.0 - smoothstep(0.9, 1.0, vY));   // melt into the surface instead of ending in a hard rim
      float shimmer = 0.45 + 0.55 * (0.5 + 0.5 * sin(vW.x * 0.6 + vW.z * 0.45 + uTime * 1.1)) * (0.5 + 0.5 * sin(vW.x * 0.27 - vW.z * 0.52 - uTime * 0.7 + vY * 3.0));
      float hd = length(cameraPosition.xz - vW.xz), d = length(cameraPosition - vW);
      float a = uK * edge * fall * shimmer * smoothstep(1.5, 9.0, d) * (1.0 - smoothstep(22.0, 42.0, hd));
      gl_FragColor = vec4(vec3(1.0, 0.96, 0.84) * a, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
const shaftGeo = new THREE.CylinderGeometry(0.8, 2.6, 60, 16, 1, true); shaftGeo.translate(0, -30, 0);
const shafts = Array.from({ length: 22 }, (_, i) => { const m = new THREE.Mesh(shaftGeo, shaftMat), k = 0.55 + h2(i, 3) * 0.8; m.userData.o = [h2(i, 1) * 90, h2(i, 2) * 90]; m.scale.set(k, 0.7 + h2(i, 4) * 0.5, k); m.rotation.z = 0.18; m.rotation.x = 0.05; m.frustumCulled = false; scene.add(m); return m; });
const dotTex = (() => { const cv = makeCanvas(64, 64), g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
function points(n, size, color, opts = {}) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  if (opts.colors) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const m = new THREE.PointsMaterial({ size, color, map: dotTex, transparent: true, depthWrite: false, vertexColors: !!opts.colors, blending: opts.add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: opts.opacity ?? 1 });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return p;
}
const SNOW = 2500, snow = points(SNOW, 0.07, 0xe8f4ff, { opacity: 0.5 }), snowBase = new Float32Array(SNOW * 3).map(() => Math.random() * 40);
const bubbles = points(200, 0.09, 0xffffff, { opacity: 0.8 }), bubbleList = [];
const bits = points(200, 0.07, 0xffe0e0, { opacity: 0.9 }), bitList = [];
const sparks = points(500, 0.09, 0xffffff, { colors: true, add: true }), sparkList = [];   // bioluminescent plankton stirred up at night
const ink = points(400, 0.45, 0x120d0a, { opacity: 0.55 }), inkList = [];   // a startled octopus's ink cloud
const cocoons = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.2, roughness: 0.05, clearcoat: 1, depthWrite: false }), 200);
cocoons.frustumCulled = false; cocoons.count = 0; scene.add(cocoons);   // sleeping parrotfish wrap themselves in mucus
const haloS = points(1500, 0.6, 0xffffff, { colors: true, add: true }), haloL = points(400, 2.6, 0xffffff, { colors: true, add: true });

// ---------- diver: articulated model with neoprene, BCD, tank, regulator, hoses and flexing fins ----------
const diverModel = (() => {
  const grp = new THREE.Group(); grp.rotation.order = 'YZX';
  const scuba = new THREE.Group(), single = new THREE.Group(); grp.add(scuba); scuba.add(single);   // scuba diver; `single` = the recreational tank
  const grain = (() => { const cv = makeCanvas(128, 128), g = cv.getContext('2d'), R = rng(21); g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 2600; i++) { const v = 100 + R() * 60 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * 128, R() * 128, 1.5, 1.5); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t; })();
  const std = (color, rough, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const neo = std(0x121417, 0.85, { bumpMap: grain, bumpScale: 0.8 }), neoBlue = std(0x1d6fb8, 0.8, { bumpMap: grain, bumpScale: 0.8 });
  const bcd = std(0x24272c, 0.7, { bumpMap: grain, bumpScale: 0.4 }), web = std(0x0e0f11, 0.6), rubber = std(0x0b0c0e, 0.5), hoseMat = std(0x1a1b1e, 0.45);
  const tankMat = std(0xf2c418, 0.28, { metalness: 0.3 }), steel = std(0xd0d4d8, 0.22, { metalness: 0.95 }), skin = std(0xc99478, 0.6);
  const finMat = std(0x1668b0, 0.4, { side: THREE.DoubleSide }), finTip = std(0xf2d020, 0.4, { side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xaee4ff, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.4, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lens = std(0xfff6dd, 0.2, { emissive: 0xfff2cc, emissiveIntensity: 0 }), yellow = std(0xf2c418, 0.45);
  const add = (geo, mat, parent = scuba, m = null) => { const o = new THREE.Mesh(geo, mat); if (m) o.applyMatrix4(m); parent.add(o); return o; };
  const capsule = (r, len) => { const g = new THREE.CapsuleGeometry(r, len, 6, 14); g.rotateZ(Math.PI / 2); return g; };  // along x
  const along = (from, to, r0, r1, mat, parent = scuba) => { // tapered segment between two points
    const d = to.clone().sub(from), g = new THREE.CylinderGeometry(r1, r0, d.length(), 14); g.translate(0, d.length() / 2, 0);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize())); g.translate(from.x, from.y, from.z); return add(g, mat, parent);
  };
  const hose = (pts, r, mat) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new Vector3(...p))), 24, r, 8), mat);
  // torso: shoulders (+x) to hips; cross-section half height (y) and half width (z)
  const T = [[0.44, 0.1, 0.13], [0.38, 0.13, 0.2], [0.24, 0.14, 0.19], [0.05, 0.12, 0.16], [-0.12, 0.11, 0.15], [-0.3, 0.12, 0.17], [-0.36, 0.09, 0.13]];
  const at = (t, k) => { const f = t * (T.length - 1), i = Math.min(T.length - 2, Math.floor(f)), u = f - i; return lerp(T[i][k], T[i + 1][k], u); };
  const torso = (t0, t1, s, mat) => add(loft(24, 22, t => at(lerp(t0, t1, t), 0), t => at(lerp(t0, t1, t), 1) * s, t => at(lerp(t0, t1, t), 2) * s), mat);
  torso(0, 1, 1, neo);
  torso(0.1, 0.62, 1.09, bcd);                        // BCD jacket
  torso(0.32, 0.4, 1.12, neoBlue);                    // BCD trim band
  torso(0.8, 0.88, 1.08, web);                        // weight belt
  add(new THREE.BoxGeometry(0.05, 0.03, 0.07), steel, scuba, M(-0.12, -0.125, 0));   // belt buckle
  for (const s of [-1, 1]) { add(sphere(14), neo, scuba, M(0.37, 0.0, s * 0.19, 0, 0, 0, 0.085)); add(new THREE.BoxGeometry(0.2, 0.012, 0.05), neoBlue, scuba, M(0.3, 0.155, s * 0.1)); }
  // neck, head, hood, mask, regulator
  add(capsule(0.055, 0.08), neo, scuba, M(0.49, 0.04, 0));
  const head = new THREE.Group(); head.position.set(0.61, 0.07, 0); head.rotation.z = -0.3; scuba.add(head);
  add(sphere(20), neo, head, M(0, 0, 0, 0, 0, 0, 0.12, 0.115, 0.105));
  add(sphere(12), skin, head, M(0.085, -0.055, 0, 0, 0, 0, 0.04, 0.045, 0.065));
  add(new THREE.CylinderGeometry(0.068, 0.072, 0.05, 28), rubber, head, M(0.1, 0.015, 0, 0, 0, Math.PI / 2, 1, 1, 1.5));
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 28), glass, head, M(0.127, 0.015, 0, 0, 0, Math.PI / 2, 1, 1, 1.45));
  add(new THREE.TorusGeometry(0.108, 0.01, 6, 28), rubber, head, M(0.01, 0.02, 0, Math.PI / 2, 0, 0));
  add(new THREE.CylinderGeometry(0.03, 0.034, 0.07, 16), rubber, head, M(0.13, -0.075, 0.02, Math.PI / 2, 0, 0));
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), std(0x6a6f76, 0.4), head, M(0.16, -0.075, 0.02, 0, 0, Math.PI / 2));
  // tank with valve, first stage and bands
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.52, 28), tankMat, single, M(0.0, 0.235, 0, 0, 0, Math.PI / 2));
  for (const x of [0.26, -0.26]) add(sphere(20), tankMat, single, M(x, 0.235, 0, 0, 0, 0, 0.05, 0.09, 0.09));
  for (const x of [0.12, -0.1]) add(new THREE.CylinderGeometry(0.095, 0.095, 0.035, 28), web, single, M(x, 0.235, 0, 0, 0, Math.PI / 2));
  add(new THREE.CylinderGeometry(0.022, 0.026, 0.07, 14), steel, single, M(0.33, 0.235, 0, 0, 0, Math.PI / 2));
  add(new THREE.CylinderGeometry(0.032, 0.032, 0.07, 14), steel, scuba, M(0.37, 0.24, 0, Math.PI / 2, 0, 0));
  add(new THREE.TorusGeometry(0.025, 0.007, 6, 14), rubber, scuba, M(0.37, 0.28, 0, Math.PI / 2, 0, 0));
  hose([[0.37, 0.24, 0.035], [0.44, 0.2, 0.15], [0.56, 0.06, 0.15], [0.7, -0.03, 0.05], [0.73, -0.05, 0.02]], 0.011, hoseMat);           // regulator
  hose([[0.37, 0.24, -0.035], [0.43, 0.22, -0.17], [0.34, 0.08, -0.24], [0.22, -0.02, -0.21]], 0.014, std(0x3a3e44, 0.5));                // inflator
  hose([[0.36, 0.23, 0.04], [0.3, 0.14, 0.22], [0.1, -0.02, 0.24], [-0.02, -0.12, 0.2]], 0.01, hoseMat);                                   // gauge
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 24), rubber, scuba, M(-0.04, -0.14, 0.19, 0.4, 0, 0));
  add(new THREE.CylinderGeometry(0.032, 0.032, 0.004, 24), std(0xe8eef2, 0.3, { emissive: 0x335544, emissiveIntensity: 0.2 }), scuba, M(-0.04, -0.158, 0.197, 0.4, 0, 0));
  add(new THREE.CylinderGeometry(0.03, 0.034, 0.06, 14), yellow, scuba, M(0.18, -0.14, 0.07, Math.PI / 2, 0, 0));    // octopus (spare regulator)
  // arms: left tucked under the chest, right holding the torch forward
  const arm = (s, elbow, hand) => {
    const sh = new Vector3(0.37, -0.02, s * 0.2), el = new Vector3(...elbow), wr = new Vector3(...hand);
    along(sh, el, 0.052, 0.045, neo); add(sphere(12), neo, scuba, M(el.x, el.y, el.z, 0, 0, 0, 0.046));
    along(el, wr, 0.044, 0.036, neo); add(sphere(12), rubber, scuba, M(wr.x + 0.035, wr.y, wr.z, 0, 0, 0, 0.05, 0.03, 0.042));
    return wr;
  };
  arm(-1, [0.3, -0.24, -0.2], [0.5, -0.2, -0.06]);
  const wr = arm(1, [0.52, -0.2, 0.26], [0.74, -0.16, 0.2]);
  add(new THREE.CylinderGeometry(0.026, 0.022, 0.17, 18), std(0x15171a, 0.35, { metalness: 0.4 }), scuba, M(wr.x + 0.07, wr.y + 0.01, wr.z, 0, 0, -Math.PI / 2));
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 18), lens, scuba, M(wr.x + 0.16, wr.y + 0.01, wr.z, 0, 0, -Math.PI / 2));
  // legs: hip → knee → ankle, each a pivot; fins flex in two parts
  const finShape = (w0, w1, len) => { const s = new THREE.Shape(); s.moveTo(0, -w0); s.lineTo(-len, -w1); s.quadraticCurveTo(-len - 0.03, 0, -len, w1); s.lineTo(0, w0); s.lineTo(0, -w0); const g = new THREE.ShapeGeometry(s); g.rotateX(Math.PI / 2); return g; };
  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(-0.33, -0.01, s * 0.085); scuba.add(hip);
    add(capsule(0.072, 0.3), neo, hip, M(-0.2, 0, 0));
    const knee = new THREE.Group(); knee.position.set(-0.4, 0, 0); hip.add(knee);
    add(capsule(0.058, 0.3), neo, knee, M(-0.19, 0, 0));
    add(new THREE.CylinderGeometry(0.066, 0.066, 0.05, 16), neoBlue, knee, M(-0.02, 0, 0, 0, 0, Math.PI / 2));
    const ankle = new THREE.Group(); ankle.position.set(-0.4, -0.005, 0); knee.add(ankle);
    add(capsule(0.05, 0.12), rubber, ankle, M(-0.07, -0.01, 0, 0, 0, 0, 1, 0.8, 1.1));             // foot pocket
    add(finShape(0.06, 0.1, 0.3), finMat, ankle, M(-0.1, -0.012, 0));
    for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.3, 0.018, 0.012), rubber, ankle, M(-0.25, -0.012, e * 0.08, 0, e * -0.13, 0));
    const tip = new THREE.Group(); tip.position.set(-0.4, -0.012, 0); ankle.add(tip);
    add(finShape(0.1, 0.13, 0.25), finMat, tip);
    add(finShape(0.13, 0.135, 0.06), finTip, tip, M(-0.22, 0.001, 0));
    for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.25, 0.016, 0.01), rubber, tip, M(-0.125, 0, e * 0.115, 0, e * -0.03, 0));
    return { hip, knee, ankle, tip, s };
  });
  // visible torch beam (light scattered by the water)
  const beamGeo = new THREE.ConeGeometry(4.5, 18, 32, 1, true); beamGeo.translate(0, -9, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff4dd, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, alphaMap: shaftTex, side: THREE.DoubleSide, fog: false }));
  beam.position.set(wr.x + 0.17, wr.y + 0.01, wr.z); beam.rotation.z = Math.PI / 2; grp.add(beam);
  // ----- technical diver kit (40–330 m): twin back tanks + stage cylinders of trimix/deco gas -----
  const tech = new THREE.Group(); scuba.add(tech);
  const alu = std(0xc9ced4, 0.3, { metalness: 0.7 });
  for (const z of [-0.085, 0.085]) {
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.56, 24), std(0x9aa2aa, 0.28, { metalness: 0.75 }), tech, M(0.0, 0.225, z, 0, 0, Math.PI / 2));
    for (const x of [0.28, -0.28]) add(sphere(16), std(0x9aa2aa, 0.28, { metalness: 0.75 }), tech, M(x, 0.225, z, 0, 0, 0, 0.045, 0.08, 0.08));
    add(new THREE.CylinderGeometry(0.02, 0.024, 0.08, 12), steel, tech, M(0.35, 0.225, z, 0, 0, Math.PI / 2));
  }
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 10), steel, tech, M(0.38, 0.225, 0, Math.PI / 2, 0, 0));   // isolation manifold
  for (const x of [0.12, -0.12]) add(new THREE.BoxGeometry(0.04, 0.2, 0.36), web, tech, M(x, 0.2, 0));   // tank bands
  const stageCols = [0xe8e8e8, 0xf2c418];   // stage/deco cylinders are clipped along the diver's sides, labelled with their gas
  for (const s of [-1, 1]) for (const k of [0, 1]) {
    const z = s * (0.24 + k * 0.1), y = -0.06 - k * 0.07;
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 18), alu, tech, M(-0.02, y, z, 0, 0, Math.PI / 2));
    add(new THREE.CylinderGeometry(0.061, 0.061, 0.08, 18), std(stageCols[k], 0.5), tech, M(0.18, y, z, 0, 0, Math.PI / 2));
    add(new THREE.CylinderGeometry(0.018, 0.02, 0.08, 10), steel, tech, M(0.34, y, z, 0, 0, Math.PI / 2));
  }
  // ----- atmospheric diving suit (330–700 m): a one-person hardsuit at surface pressure, upright, with thrusters -----
  const ads = new THREE.Group(); grp.add(ads);
  const hard = std(0xf2b705, 0.32, { metalness: 0.25 }), joint = std(0x4f555c, 0.35, { metalness: 0.7 }), dark = std(0x1b1d20, 0.5);
  add(sphere(24), hard, ads, M(0, 0.15, 0, 0, 0, 0, 0.42, 0.55, 0.44));
  add(new THREE.CylinderGeometry(0.36, 0.32, 0.4, 24), hard, ads, M(0, -0.5, 0));
  add(new THREE.TorusGeometry(0.38, 0.06, 10, 28), joint, ads, M(0, -0.28, 0, Math.PI / 2, 0, 0));
  add(new THREE.TorusGeometry(0.25, 0.045, 10, 28), joint, ads, M(0.04, 0.63, 0, Math.PI / 2, 0, 0));
  add(sphere(24), glass, ads, M(0.05, 0.84, 0, 0, 0, 0, 0.27));
  add(sphere(16), neo, ads, M(0.02, 0.82, 0, 0, 0, 0, 0.13, 0.15, 0.12));
  add(sphere(10), skin, ads, M(0.11, 0.8, 0, 0, 0, 0, 0.05, 0.07, 0.08));
  for (const s of [-1, 1]) {
    const sh = new Vector3(0, 0.42, s * 0.46), el = new Vector3(0.22, 0.02, s * 0.58), hd = new Vector3(0.5, -0.12, s * 0.5);
    add(sphere(16), joint, ads, M(sh.x, sh.y, sh.z, 0, 0, 0, 0.15));
    along(sh, el, 0.12, 0.11, hard, ads); add(sphere(14), joint, ads, M(el.x, el.y, el.z, 0, 0, 0, 0.12));
    along(el, hd, 0.1, 0.09, hard, ads);
    for (const k of [-1, 1]) add(new THREE.BoxGeometry(0.14, 0.035, 0.05), joint, ads, M(hd.x + 0.08, hd.y + k * 0.04, hd.z, 0, 0, k * 0.4));   // claw
    const hp = new Vector3(0.02, -0.68, s * 0.2), kn = new Vector3(0.06, -1.08, s * 0.23), an = new Vector3(0, -1.46, s * 0.23);
    add(sphere(14), joint, ads, M(hp.x, hp.y, hp.z, 0, 0, 0, 0.14));
    along(hp, kn, 0.13, 0.12, hard, ads); add(sphere(14), joint, ads, M(kn.x, kn.y, kn.z, 0, 0, 0, 0.12));
    along(kn, an, 0.11, 0.1, hard, ads); add(new THREE.BoxGeometry(0.36, 0.14, 0.2), dark, ads, M(an.x + 0.08, an.y - 0.06, an.z));
    add(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 14), dark, ads, M(0.2, 0.55, s * 0.3, 0, 0, -Math.PI / 2));   // shoulder lamps
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.01, 14), lens, ads, M(0.28, 0.55, s * 0.3, 0, 0, -Math.PI / 2));
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), dark, ads, M(-0.58, 0.05, s * 0.32, 0, 0, Math.PI / 2));   // thrusters
    add(new THREE.TorusGeometry(0.13, 0.025, 8, 20), joint, ads, M(-0.62, 0.05, s * 0.32, 0, Math.PI / 2, 0));
  }
  add(new THREE.BoxGeometry(0.3, 0.7, 0.62), joint, ads, M(-0.42, 0.1, 0));   // life-support & thruster pod
  // ----- research submersible (700–6,500 m), modelled on WHOI's Alvin: white hull, red sail, arms and sample basket -----
  const alvin = new THREE.Group(); grp.add(alvin);
  const white = std(0xf1f1ec, 0.35), red = std(0xc8321e, 0.45), grey = std(0x6c7278, 0.4, { metalness: 0.6 });
  add(new THREE.CapsuleGeometry(1.2, 4.4, 10, 28), white, alvin, M(0, 0, 0, 0, 0, Math.PI / 2, 1, 1, 0.9));
  add(new THREE.BoxGeometry(1.6, 1.1, 0.36), red, alvin, M(0.3, 1.45, 0));
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 16), red, alvin, M(0.3, 2.05, 0));
  add(new THREE.TorusGeometry(1.2, 0.06, 8, 36), red, alvin, M(1.9, 0, 0, 0, Math.PI / 2, 0, 1, 1, 0.9));
  add(sphere(24), grey, alvin, M(2.9, -0.35, 0, 0, 0, 0, 0.9, 0.85, 0.85));   // personnel sphere
  for (const [y, z] of [[-0.3, 0], [-0.4, 0.45], [-0.4, -0.45]]) add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 18), glass, alvin, M(3.78, y, z, 0, 0, Math.PI / 2));
  add(new THREE.BoxGeometry(1.2, 0.35, 1.8), grey, alvin, M(3.1, -1.3, 0));   // sample basket
  for (const s of [-1, 1]) {
    along(new Vector3(2.8, -0.8, s * 0.7), new Vector3(3.6, -0.9, s * 0.8), 0.08, 0.07, grey, alvin); along(new Vector3(3.6, -0.9, s * 0.8), new Vector3(4.2, -1.15, s * 0.55), 0.07, 0.05, grey, alvin);
    add(new THREE.BoxGeometry(5.2, 0.12, 0.14), grey, alvin, M(0, -1.4, s * 0.85));   // skids
    add(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 18), dark, alvin, M(-3.1, 0.35, s * 1.05, 0, 0, Math.PI / 2));   // thrusters
    add(new THREE.TorusGeometry(0.34, 0.06, 8, 22), grey, alvin, M(-3.3, 0.35, s * 1.05, 0, Math.PI / 2, 0));
  }
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 18), dark, alvin, M(-3.5, -0.3, 0, 0, 0, Math.PI / 2));
  for (let i = 0; i < 5; i++) { const z = (i - 2) * 0.38; add(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 14), dark, alvin, M(3.35, 0.75, z, 0, 0, -Math.PI / 2)); add(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 14), lens, alvin, M(3.46, 0.75, z, 0, 0, -Math.PI / 2)); }
  // ----- full-ocean-depth submersible (6,500 m+), modelled on DEEPSEA CHALLENGER: a 7.3 m lime-green "vertical torpedo" -----
  const dsc = new THREE.Group(); grp.add(dsc);   // origin at the pilot sphere; the body towers above it
  const lime = std(0x9bcf2a, 0.4), dscGrey = std(0x3c4046, 0.4, { metalness: 0.7 });
  add(new THREE.CapsuleGeometry(0.62, 5.4, 10, 28), lime, dsc, M(-0.2, 3.3, 0, 0, 0, 0, 1.55, 1, 0.8));
  add(new THREE.BoxGeometry(0.06, 5.2, 1.02), std(0xf4f4f0, 0.4), dsc, M(0.78, 3.3, 0));   // white stripe
  add(sphere(28), dscGrey, dsc, M(0.1, 0, 0, 0, 0, 0, 0.72));   // steel pilot sphere, 1.09 m inside
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 18), glass, dsc, M(0.8, 0.05, 0, 0, 0, Math.PI / 2));   // the single small viewport
  add(new THREE.BoxGeometry(0.18, 2.6, 0.34), dark, dsc, M(1.2, 1.5, 0));   // LED light tower
  add(new THREE.BoxGeometry(0.02, 2.4, 0.26), lens, dsc, M(1.3, 1.5, 0));
  along(new Vector3(0.6, 1.5, 0), new Vector3(1.15, 1.5, 0), 0.05, 0.05, dscGrey, dsc);
  for (const y of [2.2, 4.3]) for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 16), dark, dsc, M(-0.2, y, s * 0.72, Math.PI / 2, 0, 0)); add(new THREE.TorusGeometry(0.24, 0.05, 8, 20), dscGrey, dsc, M(-0.2, y, s * 0.9, 0, 0, 0)); }
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.5, 0.3, 0.3), dscGrey, dsc, M(-0.3, -0.7, s * 0.35));   // steel ballast weights
  const GEAR_BEAM = { rec: [wr.x + 0.17, wr.y + 0.01, wr.z, 1], tech: [wr.x + 0.17, wr.y + 0.01, wr.z, 1], ads: [0.3, 0.55, 0.3, 1.3], alvin: [3.5, 0.75, 0, 2.2], dsc: [1.35, 1.5, 0, 2.6] };
  function setGear(id) {
    scuba.visible = id === 'rec' || id === 'tech'; tech.visible = id === 'tech'; single.visible = id === 'rec';
    ads.visible = id === 'ads'; alvin.visible = id === 'alvin'; dsc.visible = id === 'dsc';
    const [x, y, z, k] = GEAR_BEAM[id]; beam.position.set(x, y, z); beam.scale.set(k, 1 + (k - 1) * 0.5, k);
  }

  grp.traverse(o => { if (o.isMesh && o !== beam) o.castShadow = true; });
  scene.add(grp);
  function animate(kick, time, torchK) {   // flutter kick: hips swing, knees bend on the up-stroke, fins lag and flex
    for (const L of legs) {
      const ph = kick * 3 + (L.s > 0 ? 0 : Math.PI);
      L.hip.rotation.z = Math.sin(ph) * 0.3;
      L.knee.rotation.z = -Math.max(0, Math.sin(ph - 0.9)) * 0.55;
      L.ankle.rotation.z = 0.35 + Math.sin(ph - 1.4) * 0.15;
      L.tip.rotation.z = Math.sin(ph - 1.8) * 0.35;
    }
    head.rotation.y = Math.sin(time * 0.4) * 0.12;
    lens.emissiveIntensity = torchK * 3; beam.material.opacity = torchK * 0.07;
  }
  setGear('rec');
  return { grp, animate, setGear, beam };
})();

// ---------- gear changes with depth (real equipment for each depth range) ----------
const GEAR = [
  { id: 'rec', upTo: 40, icon: '🤿', name: 'Recreational scuba', cam: [4.2, 1.2], fp: [0.35, 0.1], margin: 0.9, lamp: 1, scuba: true,
    note: 'One tank of air. 40 m is the recreational limit — deeper than that, air becomes narcotic and then toxic to breathe.' },
  { id: 'tech', upTo: 330, icon: '🧪', name: 'Technical trimix diver', cam: [4.4, 1.3], fp: [0.35, 0.1], margin: 1, lamp: 1.2, scuba: true,
    note: 'Twin back tanks plus stage cylinders of trimix — oxygen, nitrogen and helium. The deepest scuba dive on record is 332 m (Ahmed Gabr, 2014): 12 minutes down, nearly 14 hours of decompression back up.' },
  { id: 'ads', upTo: 700, icon: '🦾', name: 'Atmospheric diving suit', cam: [5, 1.6], fp: [0.35, 0.82], margin: 1.4, lamp: 1.5, upright: true, hum: 0.04,
    note: 'A one-person "hardsuit" that keeps you at surface pressure, so there is no decompression. Suits like the Newtsuit and Exosuit are rated to about 300 m; the deepest-rated reach around 700 m.' },
  { id: 'alvin', upTo: 6500, icon: '🛸', name: 'Research submersible', cam: [12, 3.5], fp: [3.9, -0.3], margin: 2.3, lamp: 2.5, hum: 0.08, pitchK: 0.4,
    note: 'A three-person research sub like WHOI’s Alvin, rated to 6,500 m after its 2022 upgrade — deep enough to reach 99% of the seafloor.' },
  { id: 'dsc', upTo: Infinity, icon: '🚀', name: 'Full-ocean-depth submersible', cam: [11, 3], fp: [0.9, 0.05], margin: 1.6, lamp: 3, upright: true, hum: 0.1,
    note: 'Modelled on DEEPSEA CHALLENGER, the 7.3 m lime-green "vertical torpedo" James Cameron piloted solo to 10,908 m in the Challenger Deep on 26 March 2012. Its pilot sphere is only 1.09 m across.' },
];
const gearAt = d => GEAR.findIndex(g => d < g.upTo);
let gearIdx = 0;
const gear = () => GEAR[gearIdx];
function updateGear(depth, force) {   // switch with a little hysteresis so it doesn't flicker at the boundary
  let g = gearIdx;
  while (g < GEAR.length - 1 && depth > GEAR[g].upTo + 3) g++;
  while (g > 0 && depth < GEAR[g - 1].upTo - 3) g--;
  if (force) g = gearAt(depth);
  if (g === gearIdx && !force) return;
  gearIdx = g; const G = GEAR[g];
  diverModel.setGear(G.id); $('gear').textContent = `${G.icon} ${G.name}`;
  if (!force) toast(`${G.icon} ${G.name} — ${G.note}`, 11000);
}

// ---------- state ----------
const diver = { p: new Vector3(), v: new Vector3(), yaw: Math.PI, pitch: -0.15, kick: 0, breath: 0 };
const mobile = [];
let debugCam = null, site = null, pool = [], hosts = [], cells = new Map(), summoned = [], live = [], t = 0, firstPerson = false;
const keys = {};
// how much of a disturbance you are: swimming fast, bubbles and camera flashes make it rise, hovering lets it settle (0 calm → 1 noisy)
const presence = { base: 0, spike: 0, noise: 0 };
const forward = (out = new Vector3()) => out.set(Math.cos(diver.pitch) * Math.cos(diver.yaw), Math.sin(diver.pitch), -Math.cos(diver.pitch) * Math.sin(diver.yaw));

// ---------- settings & progress (saved in this browser) ----------
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
const settings = Object.assign({ hideNames: true, sound: true, volume: 0.7, bloom: true, shadows: true, touch: 'auto', camK: 0.65 }, store.get('scuba-settings', {}));
const progress = Object.assign({ discovered: {}, badges: {}, goals: {}, targets: {} }, store.get('scuba-progress', {}));
const saveSettings = () => store.set('scuba-settings', settings), saveProgress = () => store.set('scuba-progress', progress);
const kindName = sp => (sp.kind || (CORAL.has(sp.type) ? 'coral' : KIND[sp.type])).toLowerCase();
const known = sp => !settings.hideNames || !!progress.discovered[sp.id];   // research mode hides names until you identify a photo
const label = sp => known(sp) ? sp.name : `Unknown ${kindName(sp)}`;
const an = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w, cap = w => w[0].toUpperCase() + w.slice(1);
const diveOpts = { night: false };
let shelterK = 0, torchNow = 0, lastArch = false, visited = new Set();   // how enclosed the camera is (caves and wrecks are dark inside)
const strobeOn = () => ambient(-diver.p.y) * (1 - shelterK * 0.9) < 0.75;
let diveStats = { start: 0, maxDepth: 0 };

function startDive(s) {
  site = s; diveId = Date.now(); audio.init(); { const [v, deg] = s.current || [0, 0], a = deg * Math.PI / 180; curBase.set(Math.sin(a) * v, 0, -Math.cos(a) * v); } dayLight = diveOpts.night ? 0.012 : 1;
CAUST.uCaust.value = diveOpts.night ? 0 : 0.9; diveStats = { start: t, maxDepth: 0 };
  pool = species.filter(sp => !sp.host && !sp.lair);   // lair species only live at cleaning stations, in caves and on wrecks
  hosts = species.filter(sp => sp.host);
  cells = new Map(); summoned = [];
  const st = buildSite(s);
  if (st) { diver.p.copy(st.p); diver.yaw = st.yaw; diver.pitch = st.pitch; } else { diver.p.set(edgeX(0) + 7, -6, 0); diver.yaw = Math.PI; diver.pitch = -0.15; }
  diver.v.set(0, 0, 0); shelterK = 0; lastArch = false; visited = new Set();
  $('site-name').textContent = `${s.name} · ${s.area}${diveOpts.night ? ' · 🌙 night' : ''}`;
  $('picker').hidden = true; $('land').hidden = true; $('hud').hidden = false; closeCard();
  updateTiles(true); updateTarget(); applyTouch(); updateGear(6, true);
  if (!startDive.seen) { startDive.seen = 1; $('help').hidden = false; }
}

// ---------- creatures ----------
const speedOf = sp => (SPEED[sp.type] ?? 0.5) * clamp(Math.sqrt(sp.size), 0.5, 3);
// Night: some animals come out, day fish rest, and deep animals rise toward the surface (diel vertical migration).
const NIGHT_MULT = { whitetip_reef: 2.5, tawny_nurse: 2, giant_moray: 1.5, green_moray: 1.5, lionfish_miles: 1.5, lionfish_volitans: 1.5, spanish_dancer: 2, cuttlefish: 1.3, day_octopus: 0.4, krait: 1.3 };
const NIGHT_TYP = { lanternfish: [20, 300], pyrosome: [0, 150], firefly_squid: [0, 150], humboldt_squid: [0, 200], sixgill: [50, 500], megamouth: [10, 40], bigeye_thresher: [0, 150], swordfish: [0, 100], viperfish: [200, 800] };
const SLEEPERS = new Set(['bumphead', 'stoplight_parrot']), NIGHT_HUNTERS = new Set(['giant_moray', 'green_moray']);
// air breathers: seconds between breaths (sped up for the game) — turtles, sea snakes, dugongs and dolphins must come up to the surface
const AIR = { turtle: [70, 160], krait: [40, 90], olive_seasnake: [40, 90], dugong: [30, 60], spinner: [20, 45], bottlenose: [20, 45] };
const airOf = sp => AIR[sp.id] || AIR[sp.type];
const typOf = sp => (diveOpts.night && NIGHT_TYP[sp.id]) || sp.typ;
function density(sp, d) {
  if (d < sp.depth[0] || d > sp.depth[1]) return 0;
  const typ = typOf(sp) || sp.depth; return d >= typ[0] && d <= typ[1] ? 1 : 0.08;
}
function nightTraits(sp) {
  if (NIGHT_HUNTERS.has(sp.id)) return { fixed: false, hunter: true };            // morays leave their holes to hunt
  if (SLEEPERS.has(sp.id)) return { sleep: true };                                // parrotfish sleep in a mucus cocoon
  if (sp.hab === 'reef' && sp.type === 'fish' && !sp.pred && !NIGHT_MULT[sp.id]) return { rest: true };   // day fish rest near the reef
  return undefined;
}
function makeCreature(sp, p, extra) {
  const k = kindOf(sp);
  const c = { sp, kind: k, p: p.clone(), v: new Vector3(), q: new Quaternion(), yaw: Math.random() * 6.283, pitch: 0, size: sp.size * (0.85 + Math.random() * 0.3), ph: Math.random() * 10,
    fixed: sp.hab === 'benthic', home: p.clone(), tgt: p.clone(), next: sp.pred ? t + 5 + Math.random() * 40 : 0, flee: 0, full: 0, puff: 0, hide: 0, prey: null, leader: null, off: null, trust: 0, flash: 0, ...extra };
  if (airOf(sp) && !c.leader) c.air = airOf(sp)[1] * (0.15 + Math.random() * 0.85);   // seconds of breath left
  c.q.setFromEuler(_e.set(0, c.yaw, 0, 'YZX'));
  if (!c.tint) {   // individuals vary: colour morphs for corals & sponges, subtle shading for animals
    const R = Math.random, v = CORAL.has(sp.type) ? 0.78 + R() * 0.35 : 0.9 + R() * 0.15;
    c.tint = sp.tints ? new Color(sp.tints[(R() * sp.tints.length) | 0]).multiplyScalar(0.9 + R() * 0.15) : new Color(v * (0.96 + R() * 0.08), v, v * (0.96 + R() * 0.08));
  }
  return c;
}
const CELL = 30, CELLY = 15, R_H = 66, R_V = 34;
const K_PEL = 0.3, K_REEF = 1, K_CORAL = 6; // ponytail: density knobs — tune here if a zone feels empty/crowded
function findSurface(r, x0, d0, z0) {
  for (const st of structs) if (st.sample && st.hi.x > x0 && st.lo.x < x0 + CELL && st.hi.z > z0 && st.lo.z < z0 + CELL && -st.lo.y > d0 && -st.hi.y < d0 + CELLY && r() < 0.75) { const s = st.sample(r, x0, d0, z0); if (s) return s; }
  for (let i = 0; i < 8; i++) {
    const x = x0 + r() * CELL, z = z0 + r() * CELL, e = edgeX(z);
    if (x < e) { const pd = plateau(x, z); if (pd >= d0 && pd < d0 + CELLY) return { p: new Vector3(x, -pd, z), n: new Vector3(0, 1, 0) }; }
    const d = d0 + r() * CELLY; if (d < topDepth(z)) continue;
    const wx = wallX(d, z); if (wx >= x0 && wx < x0 + CELL) return { p: new Vector3(wx, -d, z), n: new Vector3(1, 0, 0) };
  }
  return null;
}
function makeCell(i, j, k) {
  const r = rng(hash(site.id) ^ Math.imul(i + 1000, 73856093) ^ Math.imul(j + 1, 19349663) ^ Math.imul(k + 1000, 83492791));
  const x0 = i * CELL, d0 = j * CELLY, z0 = k * CELL, mid = d0 + CELLY / 2, list = [];
  const reef = findSurface(r, x0, d0, z0) !== null;
  for (const sp of pool) {
    const dens = density(sp, mid); if (!dens) continue;
    let exp = sp.ab * dens * (site.featured[sp.id] || 1) * (mid > 200 ? 3 : 1) * (diveOpts.night ? NIGHT_MULT[sp.id] || 1 : 1);
    if (sp.hab === 'pelagic') exp *= K_PEL; else if (!reef) continue; else exp *= CORAL.has(sp.type) ? K_CORAL : K_REEF;
    const n = Math.floor(exp) + (r() < exp % 1 ? 1 : 0);
    for (let m = 0; m < n; m++) {
      let p, s = null;
      if (sp.hab === 'pelagic') p = new Vector3(x0 + r() * CELL, -clamp(d0 + r() * CELLY, Math.max(sp.depth[0], 0.5), sp.depth[1]), z0 + r() * CELL);
      else { s = findSurface(r, x0, d0, z0); if (!s) continue; p = s.p.clone(); if (sp.hab === 'reef') p.addScaledVector(s.n, 0.6 + r() * 4).add(_v.set(0, (r() - 0.5) * 2, (r() - 0.5) * 3)); }
      if (sp.hab !== 'benthic') { pushOut(p, 0.5); if (-p.y < sp.depth[0]) p.y = -Math.max(0.5, sp.depth[0]); }
      else if (s.n.x > 0) p.x -= 0.05;
      const lead = makeCreature(sp, p, diveOpts.night ? nightTraits(sp) : undefined);
      if (sp.f?.moray && lead.fixed && s) seatMoray(lead, s.n, r);
      else if (s?.st && lead.fixed) alignTo(lead, s.n, r);   // growing out of a wreck's hull or a thila's side
      else if (s && sp.hab === 'benthic' && s.n.x > 0 && lead.fixed) { lead.yaw = 0; lead.q.setFromEuler(_e.set(0, 0, 0, 'YZX')); }
      list.push(lead);
      if (sp.type === 'anemone' && hosts.length) {
        const ok = hosts.filter(h => -p.y >= h.depth[0] && -p.y <= h.depth[1]); if (!ok.length) continue;
        const native = ok.filter(isNative), from = native.length && r() < 0.85 ? native : ok, h = from[(r() * from.length) | 0];
        for (let q = 0, cnt = 2 + (r() * 3 | 0); q < cnt; q++) list.push(makeCreature(h, p.clone().add(_v.set(0, 0.3, 0)), { leader: lead, off: new Vector3((r() - 0.5) * 0.6, 0.15 + r() * 0.3, (r() - 0.5) * 0.6) }));
      }
      if (sp.school) {
        const cnt = sp.school[0] + Math.floor(r() * (sp.school[1] - sp.school[0] + 1)) - 1, spread = Math.max(0.6, sp.size * 4);
        for (let q = 0; q < cnt; q++) {
          const off = new Vector3((r() - 0.5) * spread * 2, (r() - 0.5) * spread, (r() - 0.5) * spread * 2);
          if (sp.hab === 'benthic' && s.st) { const c = makeCreature(sp, p.clone().add(off.addScaledVector(s.n, -off.dot(s.n)).multiplyScalar(0.4))); alignTo(c, s.n, r); list.push(c); }
          else if (sp.hab === 'benthic') { const pp = p.clone().add(s.n.x > 0 ? off.set(0, off.y, off.z) : off.set(off.x, 0, off.z)); if (s.n.y > 0) pp.y = -plateau(pp.x, pp.z); list.push(makeCreature(sp, pp)); }
          else list.push(makeCreature(sp, p.clone().add(off), { leader: lead, off }));
        }
      }
    }
  }
  for (const st of structs) for (const L of st.lairs) if (Math.floor(L.p.x / CELL) === i && Math.floor(-L.p.y / CELLY) === j && Math.floor(L.p.z / CELL) === k) spawnLair(L, r, list);
  if (reef && mid < 35 && !diveOpts.night && r() < 0.22) {   // a cleaning station: a few cleaner wrasse holding court over one spot on the reef
    const s = findSurface(r, x0, d0, z0);
    if (s) {
      const st = { p: s.p.clone().addScaledVector(s.n, 0.9), client: null, boss: null, next: t + 2 + r() * 8 };
      for (let q = 0, n = 2 + (r() * 2 | 0); q < n; q++) list.push(makeCreature(SP.cleaner_wrasse, st.p.clone().add(_v.set(r() - 0.5, r() - 0.5, r() - 0.5)), { st }));
    }
  }
  return list;
}
// who shelters where: species with a matching `lair` live only there; these guests also turn up (by day whitetips and nurse sharks rest in caves)
const LAIR_GUESTS = { cave: { whitetip_reef: 0.7, tawny_nurse: 0.25, giant_moray: 0.5, cup_coral: 3, lionfish_volitans: 0.3 }, wreck: { giant_moray: 0.5, lionfish_miles: 0.6, cup_coral: 2, tube_sponge: 1 }, overhang: { lionfish_volitans: 0.3, cup_coral: 2, giant_moray: 0.2 } };
function spawnLair(L, r, list) {
  const d = -L.p.y, fits = sp => d >= sp.depth[0] - 2 && d <= sp.depth[1] + 2;
  const cand = species.filter(sp => sp.lair?.includes(L.kind) && fits(sp)).map(sp => [sp, sp.ab * (site.featured[sp.id] ? 1.5 : 1)]);
  for (const [id, n] of Object.entries(LAIR_GUESTS[L.kind])) if (SP[id] && fits(SP[id])) cand.push([SP[id], n * (site.featured[id] ? 1.5 : 1)]);
  for (const [sp, exp] of cand) {
    const n = Math.floor(exp) + (r() < exp % 1 ? 1 : 0);
    for (let m = 0; m < n; m++) {
      if (sp.hab === 'benthic') {   // morays, cup corals and sponges need a spot on the rock or the hull
        if (!L.spots.length) continue; const s = L.spots[(r() * L.spots.length) | 0], c = makeCreature(sp, s.p.clone().add(_v.set((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6)));
        sp.f?.moray ? seatMoray(c, s.n, r) : alignTo(c, s.n, r); list.push(c); continue;
      }
      const p = L.p.clone().add(_v.set((r() - 0.5) * L.r, (r() - 0.5) * L.r * 0.5, (r() - 0.5) * L.r)); pushOut(p, 0.3 + sp.size * 0.3);
      const resting = sp.type === 'shark' && !diveOpts.night, lead = makeCreature(sp, p, { rest: resting || undefined, ...(diveOpts.night ? nightTraits(sp) : {}) });
      if (resting) lead.home.copy(p); list.push(lead);
      if (sp.school) for (let q = 0, cnt = sp.school[0] + Math.floor(r() * (sp.school[1] - sp.school[0] + 1)) - 1, spread = Math.max(0.5, sp.size * 3); q < cnt; q++) {
        const off = new Vector3((r() - 0.5) * spread * 2, (r() - 0.5) * spread, (r() - 0.5) * spread * 2); list.push(makeCreature(sp, p.clone().add(off), { leader: lead, off }));
      }
    }
  }
}
function updateCells() {
  const px = diver.p.x, pz = diver.p.z, d = -diver.p.y;
  const i0 = Math.floor((px - R_H) / CELL), i1 = Math.floor((px + R_H) / CELL), k0 = Math.floor((pz - R_H) / CELL), k1 = Math.floor((pz + R_H) / CELL);
  const j0 = Math.max(0, Math.floor((d - R_V) / CELLY)), j1 = Math.floor(Math.min(FLOOR, d + R_V) / CELLY);
  for (const [key, c] of cells) if (c.i < i0 - 1 || c.i > i1 + 1 || c.k < k0 - 1 || c.k > k1 + 1 || c.j < j0 - 1 || c.j > j1 + 1) cells.delete(key);
  for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
    if (Math.hypot((i + 0.5) * CELL - px, (k + 0.5) * CELL - pz) > R_H + CELL * 0.7) continue;
    for (let j = j0; j <= j1; j++) { const key = i + ',' + j + ',' + k; if (!cells.has(key)) cells.set(key, { i, j, k, list: makeCell(i, j, k) }); }
  }
}

let anyDead = false, lastCatchToast = -9, lastBehaviourToast = -99;
function pickClient(st) {   // the nearest decent-sized fish, turtle, ray or shark that isn't busy
  let best = null, bd = 22 * 22;
  for (const o of mobile) {
    if (o.dead || o.leader || o.prey || o.clean || o.st || o.sleep || o.air < 0 || o.surfUntil > t || o.flee > t || o.inspect) continue;
    if (!['fish', 'turtle', 'ray', 'shark'].includes(o.sp.type) || (o.sp.type === 'fish' && o.sp.hab !== 'reef') || o.size < 0.3 || o.sp.glow || Math.abs(o.p.y - st.p.y) > 15) continue;
    const dd = o.p.distanceToSquared(st.p); if (dd < bd) { bd = dd; best = o; }
  }
  return best;
}
function kill(c) { c.dead = true; anyDead = true; }
function toast(msg, ms = 4500) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; $('toasts').prepend(el); setTimeout(() => el.remove(), ms); while ($('toasts').children.length > 4) $('toasts').lastChild.remove(); }
const angLerp = (a, b, k) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
const _des = new Vector3(), _to = new Vector3(), UP = new Vector3(0, 1, 0);
function stepCreature(c, dt, dSpeed) {
  const sp = c.sp, dist = _to.subVectors(diver.p, c.p).length();
  if (c.fixed) {
    if (c.kind.mode === 4) c.swim = 0.05;   // a moray resting in its hole
    if (sp.mood === 'hide') { const near = dist < 1.5 + 3 * (0.45 + presence.noise * 1.3); c.hide = lerp(c.hide, near ? 1 : 0, Math.min(1, dt * (near ? 6 : 0.5))); }
    c.ph += dt * c.kind.freq; return;
  }
  if (sp.bait && !c.leader && t > (c.ballCheck || 0)) {   // a predator nearby turns the school into a bait ball
    c.ballCheck = t + 0.5;
    if (mobile.some(o => (o.sp.pred || o.hunter) && o.size > 0.5 && o.p.distanceToSquared(c.p) < 225)) c.ballUntil = t + 8;
  }
  const spd = speedOf(sp) * (c.rest ? 0.35 : 1) * (c.ballUntil > t && !c.leader ? 0.2 : 1), up = c.kind.upright;
  let urgency = 1.5;
  if (c.sleep) { c.v.multiplyScalar(0.9); c.ph += dt * 0.5; c.swim = 0.2; return; }
  _des.set(0, 0, 0);
  let busy = false;   // a behaviour (breathing, being cleaned, cleaning) is steering this animal
  // air breathers swim up at a slant, hang at the surface for a few breaths, then go back down
  if (c.air !== undefined) {
    const d = -c.p.y;
    if (c.surfUntil > t) { busy = true; urgency = 2; c.surf = d < 1.3; _des.set(c.v.x * 0.3, (0.35 - d) * 1.5, c.v.z * 0.3); }
    else if (c.air < 0) {
      busy = true; urgency = 2;
      if (d < 0.9) { const [a, b] = airOf(sp); c.surfUntil = t + 4 + Math.random() * 3; c.air = a + Math.random() * (b - a); }
      else _des.set(Math.cos(c.yaw) * 0.5, 1, -Math.sin(c.yaw) * 0.5).setLength(spd * 1.2);
    } else { c.air -= dt; if (c.surf) { c.surf = false; c.next = 0; } }
  }
  // cleaning stations: cleaner wrasse dance to advertise, then dart over a client that holds still while they pick it clean
  if (c.st) {
    const st = c.st; busy = true; urgency = 3;
    if (!st.boss || st.boss.dead) st.boss = c;
    if (st.boss === c && !st.client && t > st.next) { st.client = pickClient(st); if (st.client) { st.client.clean = st; st.client.cleanUntil = t + 14 + Math.random() * 10; } else st.next = t + 4; }
    const cl = st.client;
    if (cl && !cl.dead && cl.cleaning) {
      if (!c.pick || t > c.pickNext) { c.pick = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).setLength(cl.size * 0.4 + 0.06); c.pickNext = t + 0.5 + Math.random(); }
      _des.copy(cl.p).add(c.pick).sub(c.p).multiplyScalar(3); if (_des.length() > spd * 3) _des.setLength(spd * 3);
    } else _des.copy(st.p).add(_v.set(Math.sin(t * 0.8 + c.ph) * 0.5, Math.sin(t * 3 + c.ph) * 0.25, Math.cos(t * 0.7 + c.ph) * 0.5)).sub(c.p).multiplyScalar(1.5);
  }
  if (c.clean && !busy) {
    const st = c.clean;
    if (t > c.cleanUntil || st.client !== c || c.p.distanceTo(st.p) > 35 || c.flee > t) { c.clean = null; c.cleaning = false; if (st.client === c) { st.client = null; st.next = t + 6 + Math.random() * 14; } }
    else {
      busy = true;
      _v2.copy(st.p).add(_v.set(0, 0.3 + c.size * 0.35, 0)).sub(c.p); const dd = _v2.length();
      c.cleaning = dd < 0.6 + c.size * 0.5;
      if (c.cleaning) { _des.copy(_v2).multiplyScalar(0.8); urgency = 1; if (!c.cleanSeen) { c.cleanSeen = true; if (dist < 20 && t > lastBehaviourToast + 40) lastBehaviourToast = t, toast(`🧽 Cleaning station: ${an(label(sp).toLowerCase())} is holding still while cleaner wrasse pick it clean`); } }
      else _des.copy(_v2).setLength(Math.min(spd, dd));
    }
  }
  if (busy && !up) _des.addScaledVector(currentAt(c.p), -0.95);
  // reaction to the diver: how close it lets you come depends on how much noise you make, how fast you're closing in, and how used to you it is
  const noise = presence.noise, closing = dist > 0.01 ? Math.max(0, -diver.v.dot(_to) / dist) : 0;
  c.trust = clamp(c.trust + dt * (dist < 14 && noise < 0.3 ? 0.08 : noise > 0.5 && dist < 20 ? -0.4 : -0.02), 0, 1);
  const wary = clamp(0.45 + noise * 1.3 + closing * 0.4, 0.35, 2.4) * (1 - 0.55 * c.trust);
  const mood = c.st ? 'bold' : sp.mood || (['shark', 'whale', 'ray', 'turtle'].includes(sp.type) ? 'calm' : 'shy');
  if (mood === 'shy' && sp.type !== 'jelly' && sp.type !== 'siphonophore') { if (dist < (1.2 + c.size * 3) * wary) c.flee = t + 1.2; }
  else if (mood === 'puff') { const near = dist < 1.4 + 1.6 * wary; c.puff = lerp(c.puff, near ? 1 : 0, Math.min(1, dt * (near ? 5 : 0.6))); }
  else if (mood === 'curious') {
    if (c.inspect && t > c.inspect) { c.inspect = 0; c.bored = t + 25 + Math.random() * 35; }   // loses interest for a while
    if (noise > 0.65 && dist < 7) { c.flee = t + 1.2; if (c.inspect) { c.inspect = 0; c.bored = t + 20; } }
    else if (!busy && !c.inspect && dist < 24 && noise < 0.4 && t > (c.bored || 0) && !c.leader) {
      c.inspect = t + 12 + Math.random() * 18;
      if (dist < 20 && t > lastBehaviourToast + 25) lastBehaviourToast = t, toast(`👀 ${cap(an(label(sp).toLowerCase()))} is coming over to check you out — stay calm`);
    }
    c.circling = false;
    if (c.inspect && !busy && noise < 0.55) {   // come closer, keep a comfortable distance (which shrinks as it gets used to you) and circle
      const near = (2.2 + c.size * 0.8) * (1 - 0.35 * c.trust), far = (4 + c.size) * (1 - 0.3 * c.trust);
      if (dist > far) _des.copy(_to).multiplyScalar(spd * 1.1 / dist);
      else if (dist < near) _des.copy(_to).multiplyScalar(-spd / dist);
      else { _des.crossVectors(_to, UP).setLength(spd * 0.6); c.circling = true; }
    }
  } else if (mood === 'calm' && dist < (c.size * 0.7 + 2) * wary) c.flee = t + 0.6;
  if (c.kind.ceph) {   // octopus, cuttlefish and squid flash colours when startled; octopus and squid may ink as they jet away
    if ((c.flee > t && !c.fleeFrom) || dist < 2.5 * wary) {
      if (c.flee > t && !c.fleeFrom && noise > 0.4 && dist < 10 && t > (c.inkNext || 0) && sp.type !== 'cuttle' && !sp.glow && !sp.f?.glass && -c.p.y < 1000) { c.inkNext = t + 20; for (let i = 0; i < 45; i++) inkList.push({ p: c.p.clone(), v: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.9), age: -i * 0.02 }); }
      c.flash = 1;
    }
    c.flash = Math.max(0, c.flash - dt * 0.25);
  }
  // predators hunt
  if ((sp.pred || c.hunter) && t > c.full && !c.leader && !c.clean) {
    if (!c.prey && t > c.next) {
      let best = null, bd = 18;
      for (const o of mobile) {
        if (o === c || o.dead || o.st || (o.sp.pred && o.size > c.size * 0.5)) continue;   // even predators leave cleaners alone
        if (!['fish', 'squid', 'crust', 'cuttle'].includes(o.sp.type) || o.size > c.size * 0.35) continue;
        const dd = o.p.distanceTo(c.p); if (dd < bd) { bd = dd; best = o; }
      }
      if (best) { c.prey = best; c.chaseEnd = t + 8; } else c.next = t + (diveOpts.night ? 2 : 4) + Math.random() * 3;
    }
    if (c.prey) {
      const pr = c.prey;
      if (pr.dead || t > c.chaseEnd) { c.prey = null; c.next = t + 6; }
      else {
        _v2.subVectors(pr.p, c.p); const dd = _v2.length();
        _des.copy(_v2).multiplyScalar(spd * 3.5 / Math.max(dd, 0.01)); urgency = 4;
        pr.flee = t + 1; pr.fleeFrom = c;
        if (dd < c.size * 0.35 + pr.size * 0.5 + 0.1) {
          kill(pr); c.prey = null; c.full = t + (diveOpts.night ? 12 : 25) + Math.random() * 25;
          for (let i = 0; i < 25; i++) bitList.push({ p: pr.p.clone(), v: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.5), age: 0 });
          if (c.p.distanceTo(diver.p) < 35 && t > lastCatchToast + 3) lastCatchToast = t, toast(`${sp.type === 'shark' ? '🦈' : '🐟'} ${cap(an(label(sp).toLowerCase()))} caught ${an(label(pr.sp).toLowerCase())}!`);
        }
      }
    }
  }
  if (t < c.flee && !c.prey) {
    const from = c.fleeFrom && !c.fleeFrom.dead && c.fleeFrom.p.distanceTo(c.p) < 12 ? c.fleeFrom.p : diver.p;
    _des.subVectors(c.p, from).setLength(spd * 4); urgency = 5;
  } else if (t >= c.flee) c.fleeFrom = null;
  if (_des.lengthSq() === 0) {
    if (c.leader && !c.leader.dead) {
      const L = c.leader;
      if (L.ballUntil > t) {   // bait ball: pack into a sphere and swirl around the leader
        if (!c.ballOff) c.ballOff = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).setLength((1.2 + sp.size * 9) * Math.cbrt(Math.random()));
        _v2.copy(c.ballOff).applyAxisAngle(UP, t * 0.9 / (0.5 + c.ballOff.length()));
        _des.copy(L.p).add(_v2).sub(c.p).multiplyScalar(2.5);
        if (_des.length() > spd * 3) _des.setLength(spd * 3);
      } else {
        _v2.copy(c.off).applyAxisAngle(UP, L.yaw);
        _des.copy(L.p).add(_v2).add(_v.set(Math.sin(t * 0.7 + c.ph) * 0.3, Math.cos(t * 0.5 + c.ph) * 0.15, 0)).sub(c.p).multiplyScalar(1.4).add(L.v);   // match the leader's heading
        if (_des.length() > spd * 2.5) _des.setLength(spd * 2.5);
      }
    } else {
      if (c.leader) c.leader = null;
      if (t > c.next || c.p.distanceTo(c.tgt) < 0.8) {
        const R = Math.random;
        if (sp.type === 'shark' && sp.hab === 'reef' && !c.rest && !sp.f?.nurse && !sp.f?.zebra) {   // reef sharks patrol up and down the reef edge
          if (!c.patrol || Math.abs(c.p.z - c.home.z) > 70) c.patrol = c.p.z > c.home.z ? -1 : 1;
          const z = c.p.z + c.patrol * (15 + R() * 25), d = clamp(-c.home.y + (R() - 0.5) * 8, Math.max(sp.depth[0], topDepth(z) + 2), sp.depth[1]);
          c.tgt.set(wallX(d, z) + 3 + R() * 6, -d, z);
        } else if (sp.hab === 'reef' || sp.hab === 'benthic') { const r = c.rest ? 3 : 12; c.tgt.copy(c.home).add(_v.set((R() - 0.5) * r, (R() - 0.5) * r / 3, (R() - 0.5) * r)); }
        else c.tgt.copy(c.p).add(_v.set((R() - 0.5) * 40, (R() - 0.5) * 8, (R() - 0.5) * 40));
        c.tgt.y = -clamp(-c.tgt.y, Math.max(sp.depth[0], 0.5), Math.min(sp.depth[1], FLOOR - 1));
        pushOut(c.tgt, 1 + c.size * 0.5); c.next = t + 4 + R() * 8;
      }
      _des.subVectors(c.tgt, c.p); if (_des.lengthSq() > 1e-6) _des.setLength(spd);
    }
    if (!up) _des.addScaledVector(currentAt(c.p), -0.95);   // hold station: swim into the current
  }
  c.v.lerp(_des, Math.min(1, dt * urgency));
  c.p.addScaledVector(c.v, dt).addScaledVector(currentAt(c.p), dt);
  const d = -c.p.y; if (d < sp.depth[0] - 2) c.p.y = -(sp.depth[0] - 2); if (d > sp.depth[1] + 2) c.p.y = -(sp.depth[1] + 2);
  pushOut(c.p, 0.3 + c.size * 0.3);
  const sv = c.v.length(), yaw0 = c.yaw;
  if (sv > 0.03) { c.yaw = angLerp(c.yaw, Math.atan2(-c.v.z, c.v.x), Math.min(1, dt * 4)); c.pitch = lerp(c.pitch, up ? 0 : clamp(Math.atan2(c.v.y, Math.hypot(c.v.x, c.v.z)), -0.6, 0.6), Math.min(1, dt * 3)); }
  c.roll = lerp(c.roll || 0, up ? 0 : clamp(-(c.yaw - yaw0) / Math.max(dt, 1e-3) * 0.2, -0.45, 0.45), Math.min(1, dt * 3));   // bank into turns
  c.swim = lerp(c.swim ?? 1, clamp(0.3 + sv / Math.max(0.05, spd) * 0.7, 0.3, 1.9), Math.min(1, dt * 2));             // beat harder when swimming fast, barely fin when hovering
  c.q.setFromEuler(_e.set(c.roll, c.yaw, c.pitch, 'YZX'));
  c.ph += dt * c.kind.freq * (0.5 + Math.min(3, sv / Math.max(0.05, spd)) * 0.6);
}

// ---------- currents ----------
// Strongest over the reef top, fading with depth, and surging slowly. Fish swim into it to hold station.
const curBase = new Vector3(), _cur = new Vector3();
function currentAt(p, out = _cur) { const k = clamp(1 - (-p.y - 25) / 80, 0.15, 1) * (0.85 + 0.15 * Math.sin(t * 0.25)); return out.copy(curBase).multiplyScalar(k); }
const currentWord = v => v < 0.25 ? 'mild' : v < 0.55 ? 'moderate' : 'strong';

// ---------- diver ----------
function stepDiver(dt) {
  const f = forward(), r = _v2.set(Math.sin(diver.yaw), 0, Math.cos(diver.yaw));
  const fw = clamp((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - touch.y, -1, 1), st = clamp((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touch.x, -1, 1);
  const lx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ly = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
  diver.yaw -= lx * dt * 1.8; diver.pitch = clamp(diver.pitch + ly * dt * 1.3, -1.45, 1.45);   // arrow keys look around
  const vt = (keys.Space || touch.up ? 1 : 0) - (keys.KeyC || keys.ControlLeft || touch.down ? 1 : 0);
  const turbo = keys.ShiftLeft || keys.ShiftRight || touch.fast, depth = -diver.p.y;
  const max = turbo ? 12 + depth * 0.05 : keys.KeyQ ? 0.6 : 1.8;   // turbo scales with depth so the trenches are reachable; Q fins gently
  _des.set(0, 0, 0).addScaledVector(f, fw).addScaledVector(r, st).add(_v.set(0, vt, 0));
  if (_des.lengthSq() > 0) _des.setLength(max);
  diver.v.lerp(_des, Math.min(1, dt * (turbo ? 3 : 2.2)));
  diver.p.addScaledVector(diver.v, dt).addScaledVector(currentAt(diver.p), dt * (1 - darkAt(diver.p)));   // no current inside caves and wrecks
  pushOut(diver.p, gear().margin);
  diver.kick += dt * (1.5 + diver.v.length() * (turbo ? 0.3 : 2.5));
  const prevBreath = diver.breath;
  if (!gear().scuba) return;   // suits and subs don't breathe bubbles
  if (prevBreath > 1.9 && (diver.breath - dt) <= 1.9 && depth > 1) audio.inhale(turbo);
  if ((diver.breath -= dt) < 0 && depth > 1) { diver.breath = turbo ? 2.4 : 3.5; audio.exhale(turbo); presence.spike += gearIdx ? 0.14 : 0.08; if (depth > 1.5) for (let i = 0; i < (gearIdx ? 14 : 8); i++) bubbleList.push({ p: diver.p.clone().addScaledVector(f, 0.8).add(_v.set(0, 0.2, 0)), age: -i * 0.07, s: 0.5 + Math.random() }); }
}

const _ft = new Color(), _fw = new Color(1.5, 1.4, 1.3);
function flashTint(c) {   // pulsing pale-dark waves of colour
  const k = c.flash * (0.5 + 0.5 * Math.sin(t * 7 + c.ph));
  return _ft.copy(c.tint).lerp(_fw, k * 0.7).multiplyScalar(1 - c.flash * 0.3 * (0.5 + 0.5 * Math.sin(t * 13 + c.ph * 2)));
}

// ---------- main loop ----------
const _mat = new Matrix4(), _pos = new Vector3(), _scl = new Vector3();
let last = performance.now(), hudT = 0, pickT = 0, aimed = null, fps = 60;
let frameMs = 0, audioT = 0, skipRender = false;
function frame(now, manual) {
  if (!manual) requestAnimationFrame(frame);
  const f0 = performance.now();
  const dt = manual > 0 ? manual : Math.min(0.05, (now - last) / 1000); last = now; fps = lerp(fps, 1 / Math.max(dt, 0.001), 0.05);
  if (!site) return;
  t += dt;
  if (!uiOpen()) stepDiver(dt);
  updateCells(); updateTiles();
  live.length = 0;
  for (const c of cells.values()) { if (anyDead) c.list = c.list.filter(x => !x.dead); for (const x of c.list) live.push(x); }
  summoned = summoned.filter(x => !x.dead && x.p.distanceTo(diver.p) < 160);
  anyDead = false;
  for (const x of summoned) live.push(x);
  const dSpeed = diver.v.length();
  {   // cruising at normal speed is a steady 0.3; slowing down lets it settle, sprinting or a sub's thrusters push it up
    const target = (dSpeed <= 1.9 ? 0.3 * dSpeed / 1.8 : 0.3 + (dSpeed - 1.9) / 4) + (gear().hum ? 0.12 : 0);
    presence.base = lerp(presence.base, clamp(target, 0, 1), Math.min(1, dt * 1.2)); presence.spike *= Math.exp(-dt * 0.6);
    presence.noise = clamp(presence.base + presence.spike, 0, 1);
  }
  mobile.length = 0; for (const c of live) if (!c.fixed) mobile.push(c);
  for (const c of live) stepCreature(c, dt, dSpeed);

  const depth = -diver.p.y, amb = ambient(depth), dark = 1 - amb;
  diveStats.maxDepth = Math.max(diveStats.maxDepth, depth); updateGear(depth);
  const G = gear();
  // camera
  const f = forward();
  const fp = firstPerson || camMode;
  diverModel.grp.visible = !fp;
  if (fp) camera.position.copy(diver.p).addScaledVector(f, G.fp[0]).add(_v.set(0, G.fp[1], 0));
  const side = _v2.set(Math.sin(diver.yaw), 0, Math.cos(diver.yaw)).multiplyScalar(G.cam[0] * settings.camK * 0.18).clone();   // over the right shoulder
  if (!fp) { camera.position.copy(diver.p).addScaledVector(f, -G.cam[0] * settings.camK).add(side).add(_v.set(0, G.cam[1] * settings.camK, 0)); pushOut(camera.position, 0.3); }
  if (camera.position.y > -0.12) camera.position.y = -0.12;
  if (fp) camera.lookAt(_v.copy(camera.position).add(f));
  else camera.lookAt(_v.copy(diver.p).addScaledVector(f, G.cam[0] * settings.camK * 0.7).add(side).add(_v2.set(0, G.cam[1] * settings.camK * 0.4, 0)));   // close over-the-shoulder view
  if (VIEW.on) { diverModel.grp.visible = true; diverModel.grp.rotation.set(0, diver.yaw, 0); stepGearView(dt); diver.kick += dt * 0.8; }
  if (debugCam?.target) { camera.position.copy(debugCam.target.p).add(debugCam.off); camera.lookAt(debugCam.target.p); }
  else if (debugCam) { camera.position.copy(diver.p).add(debugCam.off); camera.lookAt(_v.copy(diver.p).add(debugCam.look || _v2.set(0, 0, 0))); }
  diverModel.grp.position.copy(diver.p);
  if (!VIEW.on) diverModel.grp.rotation.set(0, diver.yaw, G.upright ? clamp(-diver.v.dot(_v.set(Math.cos(diver.yaw), 0, -Math.sin(diver.yaw))) * 0.04, -0.25, 0.25) : diver.pitch * (G.pitchK ?? 1));   // upright craft only lean
  // light & water
  const camD = -camera.position.y, water = diveOpts.night ? mix(stops(WATER, camD), '#00040a', 0.88) : stops(WATER, camD);
  scene.background.set(water); scene.fog.color.set(water); scene.fog.density = 0.02 + 0.016 * (1 - ambient(camD));
  shelterK = lerp(shelterK, darkAt(camera.position), Math.min(1, dt * 2.5)); const open = 1 - shelterK * 0.88;   // inside a cave or a wreck the daylight fades
  hemi.color.set(mix('#ffffff', water, 0.3)); hemi.groundColor.set(mix(water, '#000000', 0.6)); hemi.intensity = (0.04 + 1.0 * amb) * open; scene.environmentIntensity = (0.02 + 0.9 * amb) * open;
  sun.color.set(mix('#fff2dc', '#6fcbe6', clamp(depth / 40, 0, 1))); sun.intensity = 2.6 * amb * (1 - shelterK * 0.7);
  sun.position.copy(diver.p).add(_v.set(20, 60, 10)); sun.target.position.copy(diver.p);
  const shadowsOn = settings.shadows && !diveOpts.night && depth < 45;   // only where sunlight is strong enough to cast them
  sun.castShadow = settings.shadows; renderer.shadowMap.autoUpdate = shadowsOn; sun.shadow.intensity = shadowsOn ? 0.75 : 0;
  if (bloom) { const k = diveOpts.night ? 1 : clamp(depth / 300, 0, 1); bloom.strength = lerp(0.2, 1.1, k); bloom.threshold = lerp(1.1, 0.8, k); }   // only glow-bright things bloom in the sunlit shallows
  const torchK = torchNow = Math.max(clamp((dark - 0.35) / 0.4, 0, 1), clamp((shelterK - 0.12) / 0.3, 0, 1));
  { const k = darkAt(diver.p) > 0.25 || darkAt.kind === 'arch' ? darkAt.kind : null;   // say something the first time you enter each kind of place
    if (k === 'arch' && !lastArch) toast('🕳️ You swam through a rock arch');
    lastArch = k === 'arch';
    if (k && !visited.has(k) && k !== 'arch' && k !== 'overhang') { visited.add(k); toast(k === 'wreck' ? '🔦 Inside the wreck — your torch comes on. Sweepers and soldierfish shelter in the dark holds.' : '🔦 Inside a cave — your torch comes on. Look for resting sharks, soldierfish and sweepers.'); }
  }
  torch.intensity = torchK * 45 * G.lamp; torch.distance = 55 * Math.sqrt(G.lamp); torch.position.copy(diver.p).addScaledVector(f, 0.8 + G.cam[0] * 0.25); torch.target.position.copy(diver.p).addScaledVector(f, 20);
  diverLamp.intensity = torchK * 4 * (1 + G.cam[0] * 0.12); diverLamp.distance = 8 + G.cam[0] * 2;   // bigger craft need a bigger fill light to be seen
  diverModel.animate(diver.kick, t, torchK); diverLamp.position.copy(camera.position); if (VIEW.on) diverModel.beam.material.opacity = 0;
  surface.position.set(diver.p.x, 0, diver.p.z); surface.visible = camD < 150;
  surfU.uTime.value = t; surfU.uNight.value = diveOpts.night ? 1 : 0; surfU.uFogD.value = scene.fog.density; surfU.uWater.value.set(water);
  const wrap = (o, c) => c + ((o - c) % 90 + 135) % 90 - 45;   // each shaft wraps around you on its own, out where it has already faded
  shafts.forEach(s => { s.visible = depth < 90 && !diveOpts.night; s.position.set(wrap(s.userData.o[0], diver.p.x), 0, wrap(s.userData.o[1], diver.p.z)); });
  shaftU.uTime.value = t; shaftU.uK.value = 0.16 * clamp(1 - depth / 70, 0, 1) * (1 - shelterK);
  floor.visible = depth > FLOOR - 400; floor.position.set(Math.round(diver.p.x / 50) * 50, -FLOOR, Math.round(diver.p.z / 50) * 50);

  // write instances (two passes: count, grow buffers, then fill)
  for (const k of kinds.values()) k.n = 0;
  const cam = camera.position;
  for (const c of live) if (c.p.distanceToSquared(cam) < 12000) c.kind.n++;
  for (const k of kinds.values()) { if (k.n > k.cap) { let cap = k.cap; while (cap < k.n) cap *= 2; grow(k, cap); } k.n = 0; }
  let hs = 0, hl = 0, nc = 0; const hsP = haloS.geometry.attributes.position.array, hsC = haloS.geometry.attributes.color.array, hlP = haloL.geometry.attributes.position.array, hlC = haloL.geometry.attributes.color.array;
  const glowK = diveOpts.night ? 1 : clamp((depth - 60) / 250, 0, 1);
  for (const c of live) {
    const d2 = c.p.distanceToSquared(cam); if (d2 >= 12000) continue;
    const k = c.kind, i = k.n++;
    if (c.fixed && c.hide < 0.01) {   // corals never move: cache their matrix
      if (!c.me) c.me = new Float32Array(_mat.compose(c.p, c.q, _scl.setScalar(c.size)).elements);
      k.mesh.instanceMatrix.array.set(c.me, i * 16);
    } else {
      const puff = 1 + c.puff * 0.7;
      _scl.set(c.size * puff, c.size * puff * (1 - c.hide * 0.85), c.size * puff * (1 + c.puff * 0.5));
      _pos.copy(c.p); if (c.hide) _pos.y -= c.size * c.hide * 0.1;
      _mat.compose(_pos, c.q, _scl); k.mesh.setMatrixAt(i, _mat);
    } const tn = c.flash > 0.02 ? flashTint(c) : c.tint; k.mesh.instanceColor.setXYZ(i, tn.r, tn.g, tn.b); k.phase.array[i] = c.ph; k.amp.array[i] = c.swim ?? 1; k.list[i] = c;
    if (c.sleep && d2 < 3600 && nc < 200) { _mat.compose(c.p, c.q, _scl.set(c.size * 0.62, c.size * 0.34, c.size * 0.32)); cocoons.setMatrixAt(nc++, _mat); }
    if (c.sp.glow && glowK > 0 && d2 < 3600) {
      const col = _c.set(c.sp.glow.c).multiplyScalar(glowK * (0.6 + 0.4 * Math.sin(t * 2.5 + c.ph)) * Math.min(1, d2 / 9));   // halos fade up close so they don't blind the camera
      const s = c.sp.glow.s, n = s === 'beads' ? 7 : 1;
      for (let q = 0; q < n; q++) {
        _v.set(s === 'lure' ? 0.6 : s === 'tail' ? -0.5 : s === 'red' ? 0.4 : s === 'beads' ? q / 6 - 0.5 : 0, s === 'lure' ? 0.35 : 0, 0).multiplyScalar(c.size).applyQuaternion(c.q).add(c.p);
        if ((s === 'body' || s === 'ring' || s === 'beads') && c.size > 0.12 && hl < 400) { hlP[hl * 3] = _v.x; hlP[hl * 3 + 1] = _v.y; hlP[hl * 3 + 2] = _v.z; hlC[hl * 3] = col.r; hlC[hl * 3 + 1] = col.g; hlC[hl * 3 + 2] = col.b; hl++; }
        else if (hs < 1500) { hsP[hs * 3] = _v.x; hsP[hs * 3 + 1] = _v.y; hsP[hs * 3 + 2] = _v.z; hsC[hs * 3] = col.r; hsC[hs * 3 + 1] = col.g; hsC[hs * 3 + 2] = col.b; hs++; }
      }
    }
  }
  for (const k of kinds.values()) {
    k.mesh.count = k.n; k.mesh.visible = k.n > 0;
    if (k.n) { k.mesh.instanceMatrix.needsUpdate = true; k.mesh.instanceColor.needsUpdate = true; k.phase.needsUpdate = true; k.amp.needsUpdate = true; }
    if (k.sp.glow) k.mat.emissiveIntensity = glowK * (k.sp.glow.s === 'ring' ? 0.6 + 0.8 * Math.max(0, Math.sin(t * 4)) : 1.2);
  }
  cocoons.count = nc; cocoons.instanceMatrix.needsUpdate = true;
  haloS.geometry.setDrawRange(0, hs); haloL.geometry.setDrawRange(0, hl);
  haloS.geometry.attributes.position.needsUpdate = haloS.geometry.attributes.color.needsUpdate = true;
  haloL.geometry.attributes.position.needsUpdate = haloL.geometry.attributes.color.needsUpdate = true;
  // marine snow wraps around the camera
  const sp = snow.geometry.attributes.position.array, ox = cam.x - 20, oy = cam.y - 20, oz = cam.z - 20;
  for (let i = 0; i < SNOW; i++) {
    const bx = snowBase[i * 3] + curBase.x * t * 0.8, by = snowBase[i * 3 + 1] - t * 0.08, bz = snowBase[i * 3 + 2] + curBase.z * t * 0.8;
    sp[i * 3] = ox + (((bx - ox) % 40) + 40) % 40; sp[i * 3 + 1] = oy + (((by - oy) % 40) + 40) % 40; sp[i * 3 + 2] = oz + (((bz - oz) % 40) + 40) % 40;
  }
  snow.geometry.attributes.position.needsUpdate = true; snow.material.opacity = 0.2 + 0.4 * clamp(depth / 150, 0, 1);
  // bubbles & bits
  const bp = bubbles.geometry.attributes.position.array; let bn = 0;
  for (const b of bubbleList) { b.age += dt; if (b.age > 0) { b.p.y += dt * (0.8 + b.s * 0.3); b.p.x += Math.sin(b.age * 6 + b.s * 9) * dt * 0.2; b.p.addScaledVector(currentAt(b.p), dt); } }
  for (let i = bubbleList.length - 1; i >= 0; i--) if (bubbleList[i].p.y > -0.1 || bubbleList[i].age > 14) bubbleList.splice(i, 1);
  for (const b of bubbleList) if (b.age > 0 && bn < 200) { bp[bn * 3] = b.p.x; bp[bn * 3 + 1] = b.p.y; bp[bn * 3 + 2] = b.p.z; bn++; }
  bubbles.geometry.setDrawRange(0, bn); bubbles.geometry.attributes.position.needsUpdate = true;
  const tp = bits.geometry.attributes.position.array; let tn = 0;
  for (const b of bitList) { b.age += dt; b.p.addScaledVector(b.v, dt); b.v.multiplyScalar(0.96); }
  for (let i = bitList.length - 1; i >= 0; i--) if (bitList[i].age > 1.5) bitList.splice(i, 1);
  for (const b of bitList) if (tn < 200) { tp[tn * 3] = b.p.x; tp[tn * 3 + 1] = b.p.y; tp[tn * 3 + 2] = b.p.z; tn++; }
  bits.geometry.setDrawRange(0, tn); bits.geometry.attributes.position.needsUpdate = true;
  const ip = ink.geometry.attributes.position.array; let inn = 0;
  for (const b of inkList) { b.age += dt; if (b.age > 0) { b.p.addScaledVector(b.v, dt).addScaledVector(currentAt(b.p), dt * 0.5); b.v.multiplyScalar(0.97); } }
  for (let i = inkList.length - 1; i >= 0; i--) if (inkList[i].age > 7) inkList.splice(i, 1);
  for (const b of inkList) if (b.age > 0 && inn < 400) { ip[inn * 3] = b.p.x; ip[inn * 3 + 1] = b.p.y; ip[inn * 3 + 2] = b.p.z; inn++; }
  ink.geometry.setDrawRange(0, inn); ink.geometry.attributes.position.needsUpdate = true;
  if (diveOpts.night || depth > 200) {   // plankton flash blue-green wherever the water is disturbed
    const dsp = diver.v.length(); let n = dsp * dt * 45;
    while (n-- > Math.random()) sparkList.push({ p: diver.p.clone().addScaledVector(f, -0.9 - Math.random() * 0.6).add(_v.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8)), age: 0, life: 0.6 + Math.random() * 0.9 });
    for (const c of mobile) if (c.flee > t && Math.random() < dt * 6 && c.p.distanceToSquared(diver.p) < 100) sparkList.push({ p: c.p.clone(), age: 0, life: 0.8 });
  }
  const kp = sparks.geometry.attributes.position.array, kc = sparks.geometry.attributes.color.array; let kn = 0;
  for (let i = sparkList.length - 1; i >= 0; i--) if ((sparkList[i].age += dt) > sparkList[i].life) sparkList.splice(i, 1);
  for (const k of sparkList) if (kn < 500) { const a = 1 - k.age / k.life, fl = a * (0.6 + 0.4 * Math.sin(k.age * 30)); kp.set([k.p.x, k.p.y, k.p.z], kn * 3); kc.set([0.35 * fl, 1 * fl, 0.95 * fl], kn * 3); kn++; }
  sparks.geometry.setDrawRange(0, kn); sparks.geometry.attributes.position.needsUpdate = sparks.geometry.attributes.color.needsUpdate = true;

  CAUST.uTime.value = t;
  if (!skipRender) renderFrame();

  if ((audioT -= dt) < 0) { audioT = 0.5; let wn = false, sn = false; for (const c of mobile) if (c.sp.type === 'whale' && !c.sp.f?.dolphin && !c.sp.f?.sealion && !c.sp.f?.dugong) { const dd = c.p.distanceTo(diver.p); if (dd < 250) { wn = true; if (c.sp.id === 'sperm' && dd < 120) sn = true; } } audio.update(depth, t, wn, sn); audio.hum((G.hum || 0) * (0.6 + Math.min(1, diver.v.length() / 3) * 0.6)); }
  frameMs = lerp(frameMs, performance.now() - f0, 0.05);
  if ((hudT -= dt) < 0) { hudT = 0.1; updateHud(); }
  if (camMode && (camT -= dt) < 0) {
    camT = 0.15; framing = analyzeFrame(strobeOn()); const b = framing.best;
    $('vf-focus').className = b ? (framing.stars >= 3 ? 'good' : 'ok') : '';
    $('vf-subject').textContent = b ? `Subject · ${b.dist.toFixed(1)} m · ${'★'.repeat(framing.stars)}${'☆'.repeat(3 - framing.stars)}` : 'No subject';
    $('vf-tip').textContent = framing.tips[0] || 'Looks great — shoot!';
    $('vf-strobe').textContent = strobeOn() ? 'Strobe AUTO' : 'Natural light';
  }
  if (!camMode && (pickT -= dt) < 0) { pickT = 0.12; aimed = pick(); const lab = $('aim'); if (aimed) { lab.textContent = `${label(aimed.sp)} · ${aimed.p.distanceTo(diver.p).toFixed(0)} m`; lab.hidden = false; } else lab.hidden = true; }
}

// ---------- picking: what is the crosshair (or mouse) pointing at? ----------
const ray = new THREE.Raycaster();
let mouseNDC = null;
function pick() {
  ray.setFromCamera(mouseNDC || { x: 0, y: 0 }, camera);
  ray.far = 60;
  const hit = ray.intersectObjects([...tiles.values(), ...structMeshes], false)[0], maxD = hit ? hit.distance : 60;
  const o = ray.ray.origin, dir = ray.ray.direction;
  let best = null, bestScore = 1;
  for (const c of live) {
    _v.subVectors(c.p, o); const along = _v.dot(dir);
    if (along < 0.3 || along > maxD + c.size) continue;
    const off = _v.addScaledVector(dir, -along).length(), tol = c.size * 0.55 + 0.05 + along * 0.012;
    const score = off / tol; if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// ---------- HUD ----------
const gaugePos = d => { let i = ZONES.findIndex(z => d < z[1]); if (i < 0) i = ZONES.length - 1; const z = ZONES[i]; return (i + clamp((d - z[0]) / (z[1] - z[0]), 0, 1)) / ZONES.length; };
$('gauge').innerHTML = ZONES.map(z => `<div class="seg" style="border-color:${stops(WATER, (z[0] + z[1]) / 2)}"><b>${z[2]}</b><small>${z[0].toLocaleString()} m</small></div>`).join('') + '<i id="gauge-mark"></i>';
function setPanelMin(min) { settings.panelMin = min; saveSettings(); $('panel').classList.toggle('min', min); $('panel-toggle').textContent = min ? '▸' : '▾'; $('panel-toggle').setAttribute('aria-label', min ? 'Show dive info' : 'Hide dive info'); }
$('panel-toggle').onclick = () => setPanelMin(!settings.panelMin);
function updateHud() {
  const d = -diver.p.y, z = zoneOf(d);
  const temp = d < 50 ? maldives.surf : maldives.deep + (maldives.surf - maldives.deep) * Math.exp(-(d - 50) / 400);
  $('depth').textContent = `${Math.round(d).toLocaleString()} m`;
  $('zone').textContent = `${z[2]} · ${z[3]}`;
  $('pressure').textContent = `${(1 + d / 10).toFixed(d < 100 ? 1 : 0)} bar`;
  $('temp').textContent = `${temp.toFixed(1)} °C`;
  const light = ambient(d) * 100;
  $('light').textContent = light >= 1 ? `${light.toFixed(0)}%` : light >= 0.01 ? `${light.toFixed(2)}%` : 'none';
  $('nearby').textContent = live.filter(c => !c.fixed && c.p.distanceToSquared(diver.p) < 900).length;
  const n = presence.noise; $('calm').className = n < 0.22 ? 'calm' : n < 0.5 ? 'steady' : 'noisy';
  $('calm').lastChild.textContent = n < 0.22 ? 'Calm' : n < 0.5 ? 'Steady' : 'Noisy'; $('calm').firstChild.firstChild.style.width = `${Math.round(100 - n * 100)}%`;
  const cu = currentAt(diver.p), cv = cu.length();
  $('cur').innerHTML = cv < 0.03 ? 'none' : `<span class="arrow" style="transform:rotate(${Math.atan2(cu.x * Math.sin(diver.yaw) + cu.z * Math.cos(diver.yaw), cu.x * Math.cos(diver.yaw) - cu.z * Math.sin(diver.yaw)) * 180 / Math.PI}deg)">↑</span> ${currentWord(cv)} · ${cv.toFixed(1)} m/s`;
  $('gauge-mark').style.top = `${gaugePos(d) * 100}%`;
}

// ---------- fact card ----------
function behaviour(sp) {
  const b = [];
  if (sp.pred) b.push('Predator — hunts smaller fish');
  if (sp.mood === 'curious') b.push('Curious — approaches calm divers');
  if (sp.mood === 'puff') b.push('Puffs up when you get close');
  if (sp.mood === 'hide') b.push('Hides in its burrow when you get close');
  if (!b.length) b.push(sp.hab === 'benthic' ? 'Lives fixed to the reef or seabed' : ['shark', 'whale', 'ray', 'turtle'].includes(sp.type) ? 'Calm — keeps a little distance' : 'Shy — flees if you rush at it');
  if (sp.lair?.includes('station')) b.push('Runs a cleaning station for bigger animals');
  if (sp.lair?.some(l => l !== 'station')) b.push('Shelters in caves, under overhangs and in wrecks');
  if (airOf(sp)) b.push('Breathes air — comes up to the surface every few minutes');
  if (['octopus', 'cuttle', 'squid'].includes(sp.type)) b.push('Flashes colours when startled');
  if (sp.type === 'shark' && sp.hab === 'reef' && !sp.f?.nurse && !sp.f?.zebra) b.push('Patrols the reef edge');
  return b.join(' · ');
}
const whereText = sp => sp.range || (sp.regions === 'all' ? 'Widespread, including the Maldives' : sp.regions.map(r => REGION[r]).join(', '));
function fillCard(prefix, sp) { fillCardEl(null, sp, prefix); }
function fillCardEl(root, sp, prefix = null) {   // fills a card by id prefix, or a copy of #card-template
  const f = k => prefix ? $(prefix + k) : root.querySelector(`[data-f=${k}]`), show = known(sp);
  const [lab, col] = IUCN[sp.iucn], typ = sp.typ, fmt = n => n.toLocaleString();
  f('kind').textContent = sp.kind || (CORAL.has(sp.type) ? 'Coral' : KIND[sp.type]);
  f('name').textContent = label(sp); f('sci').textContent = show ? sp.sci : 'Species not yet identified';
  f('status').textContent = lab; f('status').style.background = col; f('status').hidden = !show;
  f('native').textContent = isNative(sp) ? 'Native to the Maldives' : 'Not found in the Maldives';
  f('native').className = 'tag ' + (isNative(sp) ? 'yes' : 'no'); f('native').hidden = !show;
  f('depth').textContent = `${fmt(sp.depth[0])}–${fmt(sp.depth[1])} m` + (typ ? ` (usually ${fmt(typ[0])}–${fmt(typ[1])} m)` : '');
  f('size').textContent = sp.sizeTxt || (sp.size < 1 ? `~${Math.round(sp.size * 100)} cm` : `~${sp.size} m`);
  f('where').textContent = show ? whereText(sp) : '?';
  f('behave').textContent = behaviour(sp);
  f('fact').textContent = show ? sp.fact : '📷 Photograph it (F), then research the photo at the research station to find out what it is.';
  showSpeciesPhoto(f('photo'), show ? sp : null);   // a real photo — hidden until identified, since it would give the answer away
}
// Real photos come from Wikipedia at runtime (looked up by scientific name, then common name), so the game ships no image files.
const photoCache = new Map();
function speciesPhoto(sp) {
  if (photoCache.has(sp.id)) return photoCache.get(sp.id);
  const ask = title => fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages|info&inprop=url&piprop=thumbnail|name&pithumbsize=640&titles=${encodeURIComponent(title)}`)
    .then(r => r.json()).then(j => { const pg = Object.values(j.query?.pages || {})[0]; return pg?.thumbnail ? { src: pg.thumbnail.source, file: pg.pageimage, page: pg.fullurl, title: pg.title } : null; });
  const pr = ask(sp.sci).then(r => r || ask(sp.name.replace(/\s*\(.*?\)/g, ''))).catch(() => null);
  photoCache.set(sp.id, pr); return pr;
}
function showSpeciesPhoto(fig, sp) {
  if (!fig) return;
  fig.dataset.sp = sp?.id || ''; fig.hidden = !sp; if (!sp) return;
  const img = fig.querySelector('img'), cap = fig.querySelector('figcaption');
  img.classList.remove('ready'); img.removeAttribute('src'); cap.textContent = 'Loading photo…';
  speciesPhoto(sp).then(ph => {
    if (fig.dataset.sp !== sp.id) return;   // the card moved on to another animal meanwhile
    if (!ph) { fig.hidden = true; return; }
    img.onload = () => img.classList.add('ready'); img.onerror = () => { fig.hidden = true; };
    img.src = ph.src; img.alt = `Photo of ${sp.name}`;
    cap.innerHTML = 'Photo: <a target="_blank" rel="noopener"></a> · <a target="_blank" rel="noopener">credit &amp; licence</a>';
    const [a, b] = cap.querySelectorAll('a'); a.textContent = `Wikipedia – ${ph.title}`; a.href = ph.page;
    b.href = ph.file ? `https://en.wikipedia.org/wiki/File:${encodeURIComponent(ph.file)}` : ph.page;
  });
}
let cardSp = null;
function openCard(c) {
  cardSp = c.sp; fillCard('card-', c.sp); $('card-more').hidden = !known(c.sp);
  $('card-seen').textContent = `${c.p.distanceTo(diver.p).toFixed(0)} m away, at ${Math.round(-c.p.y).toLocaleString()} m depth`;
  $('card').hidden = false; document.exitPointerLock?.();
}
function closeCard() { $('card').hidden = true; cardSp = null; }
$('card-close').onclick = closeCard;
$('card-more').onclick = () => { if (cardSp) summon(cardSp); };

// ---------- summon ----------
function summon(sp) {
  closeCard(); $('guide').hidden = true;
  const d0 = -diver.p.y;
  if (d0 < sp.depth[0] || d0 > sp.depth[1]) {
    const typ = sp.typ || sp.depth, d = clamp((typ[0] + typ[1]) / 2, 1, FLOOR - 3), z = diver.p.z;
    if (d <= topDepth(z) + 0.5) diver.p.set(edgeX(z) + 6, -d, z);
    else diver.p.set(wallX(d, z) + (sp.hab === 'pelagic' ? 15 : 5), -d, z);
    diver.yaw = sp.hab === 'pelagic' ? 0 : Math.PI; diver.pitch = -0.05; diver.v.set(0, 0, 0);
    cells = new Map(); updateTiles(true);
    toast(`Dived to ${Math.round(d).toLocaleString()} m — where the ${label(sp).toLowerCase()} lives`);
  }
  const f = forward(), d = -diver.p.y;
  if (sp.hab === 'benthic') {
    const z = diver.p.z;
    let p;
    if (d > topDepth(z) + 0.5) { const dd = clamp(d, sp.depth[0], sp.depth[1]); p = new Vector3(wallX(dd, z) - 0.05, -dd, z); diver.p.set(p.x + 4, p.y + 0.8, z); diver.yaw = Math.PI; diver.pitch = -0.1; }
    else { const px = Math.min(diver.p.x - 3, edgeX(z) - 3); p = new Vector3(px, -plateau(px, z), z); }
    const n = sp.school ? sp.school[0] : 1;
    for (let i = 0; i < n; i++) { const c = makeCreature(sp, p.clone().add(_v.set(0, i ? (Math.random() - 0.5) * 2 : 0, i ? (Math.random() - 0.5) * 3 : 0)), { yaw: 0 }); if (sp.f?.moray) seatMoray(c, d > topDepth(z) + 0.5 ? _v2.set(1, 0, 0) : _v2.set(0, 1, 0), Math.random); summoned.push(c); }
  } else {
    const p = diver.p.clone().addScaledVector(f, Math.max(4, sp.size * 1.2 + 3)); pushOut(p, 0.5);
    const lead = makeCreature(sp, p); summoned.push(lead);
    const n = sp.school ? Math.min(sp.school[1], 40) - 1 : 0, spread = Math.max(0.6, sp.size * 4);
    for (let i = 0; i < n; i++) { const off = new Vector3((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 2); summoned.push(makeCreature(sp, p.clone().add(off), { leader: lead, off })); }
  }
  toast(`${label(sp)} is here — look ahead`);
  canvas.focus();
}

// ---------- fish guide ----------
const FILTERS = [['all', 'All'], ['native', 'Maldives natives'], ['world', 'From other oceans'], ...ZONES.map((z, i) => ['z' + i, z[2]])];
let gFilter = 'all', gSel = null;
const midDepth = sp => { const r = sp.typ || sp.depth; return (r[0] + r[1]) / 2; };
const sorted = [...species].sort((a, b) => midDepth(a) - midDepth(b));
$('g-filters').innerHTML = FILTERS.map(([k, l]) => `<button data-f="${k}">${l}</button>`).join('');
$('g-filters').onclick = e => { const k = e.target.dataset?.f; if (k) { gFilter = k; renderGuide(); } };
$('g-search').oninput = renderGuide;
function renderGuide() {
  const q = $('g-search').value.trim().toLowerCase();
  for (const b of $('g-filters').children) b.classList.toggle('on', b.dataset.f === gFilter);
  const list = sorted.filter(sp => {
    if (q && !(known(sp) ? sp.name + ' ' + sp.sci : kindName(sp)).toLowerCase().includes(q)) return false;
    if (gFilter === 'native') return isNative(sp);
    if (gFilter === 'world') return !isNative(sp);
    if (gFilter[0] === 'z') { const z = ZONES[+gFilter.slice(1)]; return sp.depth[0] < z[1] && sp.depth[1] >= z[0]; }
    return true;
  });
  $('g-count').textContent = `${list.length} species`;
  $('g-list').innerHTML = '';
  for (const sp of list) {
    const li = document.createElement('li'); li.className = sp === gSel ? 'on' : '';
    li.innerHTML = `<span class="sw" style="background:${sp.c[0]}"></span><span class="nm"><b></b><i></i></span><span class="bar"><i style="left:${gaugePos(sp.depth[0]) * 100}%;right:${100 - gaugePos(sp.depth[1]) * 100}%"></i></span>`;
    li.querySelector('b').textContent = label(sp); li.querySelector('i').textContent = known(sp) ? sp.sci : `${sp.depth[0].toLocaleString()}–${sp.depth[1].toLocaleString()} m`;
    li.onclick = () => { gSel = sp; renderGuide(); };
    $('g-list').appendChild(li);
  }
  $('g-detail').hidden = !gSel;
  if (gSel) {
    fillCard('g-', gSel);
    const d = -diver.p.y, ok = d >= gSel.depth[0] && d <= gSel.depth[1], typ = gSel.typ || gSel.depth;
    $('g-summon').textContent = ok ? 'Summon near me' : `Dive to ${Math.round(clamp((typ[0] + typ[1]) / 2, 1, FLOOR - 3)).toLocaleString()} m and summon`;
  }
}
$('g-summon').onclick = () => { if (gSel) summon(gSel); };
function openGuide() { $('guide').hidden = false; document.exitPointerLock?.(); renderGuide(); setTimeout(() => $('g-search').focus(), 0); }
$('open-guide').onclick = openGuide;
$('g-close').onclick = () => { $('guide').hidden = true; };

// ---------- underwater camera (part 2) ----------
// Photos are saved with the subject's species hidden: identifying it is the job of the research you do back on land.
const photoDB = (() => {
  let mem = [];
  const open = new Promise((res, rej) => { try { const r = indexedDB.open('scuba-explorer', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
  const tx = async (mode, fn) => { const db = await open; return new Promise((res, rej) => { const t = db.transaction('photos', mode), q = fn(t.objectStore('photos')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }); };
  return {   // falls back to memory (lost on reload) if the browser blocks IndexedDB
    all: () => tx('readonly', s => s.getAll()).catch(() => mem),
    put: p => tx('readwrite', s => s.put(p)).catch(() => { mem.push(p); }),
    del: id => tx('readwrite', s => s.delete(id)).catch(() => { mem = mem.filter(p => p.id !== id); }),
  };
})();
let photos = [], camMode = false, zoom = 1, diveId = 0, lastShot = -9, framing = null, camT = 0;
photoDB.all().then(list => { photos = list.sort((a, b) => a.time - b.time); updateShotCount(); if (!$('picker').hidden) renderSitePicker(); });
const strobe = new THREE.PointLight(0xffffff, 0, 14, 1.2); scene.add(strobe);
function setCamMode(on) {
  camMode = on; document.body.classList.toggle('cam', on); $('viewfinder').hidden = !on; $('crosshair').hidden = on; $('aim').hidden = true; $('controls').hidden = on; $('gauge').hidden = on;
  if (!on) { zoom = 1; camera.fov = 70; camera.updateProjectionMatrix(); }
  updateZoom();
}
function updateZoom() { camera.fov = 70 / zoom; camera.updateProjectionMatrix(); $('vf-zoom').textContent = `${zoom.toFixed(1)}×`; }
function updateShotCount() { $('vf-count').textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'}`; $('open-photos').textContent = `Photos (P) · ${photos.length}`; }

// Who is in the frame, how big, how centred, how well lit — this is also what grades the photo.
function analyzeFrame(withStrobe) {
  const tanH = Math.tan(camera.fov * Math.PI / 360), cam = camera.position, fogD = scene.fog.density, out = [];
  const torchK = torchNow;
  for (const c of live) {
    const dist = c.p.distanceTo(cam); if (dist > 45 || dist < 0.15) continue;
    _v.copy(c.p).project(camera); if (_v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1) continue;
    const frac = c.size * 0.5 / (dist * tanH); if (frac < 0.02) continue;
    const light = Math.max(ambient(-c.p.y) * (1 - 0.9 * darkAt(c.p)), withStrobe ? clamp(1.1 - dist / 9, 0, 1) : 0, torchK * clamp(1 - dist / 22, 0, 0.8), c.sp.glow ? 0.45 : 0) * Math.exp(-((fogD * dist) ** 2));
    out.push({ c, dist, frac, center: Math.hypot(_v.x, _v.y * camera.aspect), light, score: Math.min(frac, 0.45) * (1.25 - Math.min(1, Math.hypot(_v.x, _v.y))) * (0.2 + light) });
  }
  out.sort((a, b) => b.score - a.score);
  let best = null;
  for (const o of out.slice(0, 5)) {   // the subject must not be hidden behind rock
    ray.set(cam, _v2.subVectors(o.c.p, cam).normalize()); ray.far = o.dist;
    if (!ray.intersectObjects([...tiles.values(), ...structMeshes], false).length) { best = o; break; }
  }
  const blur = diver.v.length() > 1.3 || (best && best.c.v.length() > 1.5 * Math.max(1, best.c.size * 2) && !camMode) || (best && best.c.v.length() * zoom > 3);
  let stars = 0; const tips = [];
  if (best) {
    stars = 1;
    const framed = best.frac >= 0.12 && best.center < 0.5, lit = best.light >= 0.35;
    if (framed) stars++; if (framed && lit && !blur && best.frac >= 0.18) stars++;
    if (best.frac < 0.12) tips.push(zoom < 4 ? 'Get closer or zoom in' : 'Get closer');
    else if (best.frac < 0.18) tips.push('Fill more of the frame');
    if (best.center >= 0.5) tips.push('Centre your subject');
    if (!lit) tips.push(ambient(-best.c.p.y) * (1 - darkAt(best.c.p)) < 0.3 ? 'Too dark — get within a few metres so the strobe reaches' : 'Subject is lost in the haze — get closer');
    if (blur) tips.push('Motion blur — hold still while you shoot');
  } else tips.push('No animal in frame');
  const others = [...new Set(out.filter(o => o !== best && o.frac > 0.03 && o.light > 0.15).map(o => o.c.sp.id))].filter(id => id !== best?.c.sp.id);
  const same = best ? out.filter(o => o.c.sp.id === best.c.sp.id).length : 0;
  return { best, stars, tips, others, same };
}

// ---------- sound: all synthesised, no files ----------
const audio = (() => {
  let ctx = null, master, muffle, ambGain, ambFilter, verb, nextSong = 0, nextClick = 0;
  const noise = (secs, brown) => { const n = ctx.sampleRate * secs | 0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w; } return b; };
  const env = (g, at, peak, a, hold, r) => { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.setValueAtTime(peak, at + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + r); };
  function init() {
    if (ctx) { ctx.resume?.(); return; }
    try { ctx = new AudioContext(); } catch { return; }
    master = ctx.createGain(); muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 2400;
    master.connect(muffle).connect(ctx.destination);
    verb = ctx.createConvolver(); { const n = ctx.sampleRate * 3 | 0, b = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); } verb.buffer = b; }
    const wet = ctx.createGain(); wet.gain.value = 0.5; verb.connect(wet).connect(master);
    const src = ctx.createBufferSource(); src.buffer = noise(6, true); src.loop = true;   // the constant wash of the sea
    ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'lowpass'; ambFilter.frequency.value = 500; ambGain = ctx.createGain(); ambGain.gain.value = 0.2;
    src.connect(ambFilter).connect(ambGain).connect(master); src.start();
    apply();
  }
  function apply() { if (!ctx) return; master.gain.value = settings.sound ? settings.volume : 0; if (settings.sound) ctx.resume?.(); }
  function hiss(at, dur, freq, q, peak, dest = master) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise(dur + 0.2); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; s.connect(f).connect(g).connect(dest); env(g, at, peak, dur * 0.25, dur * 0.45, dur * 0.3); s.start(at); s.stop(at + dur + 0.1); }
  function inhale(fast) { if (!ctx || !settings.sound) return; const at = ctx.currentTime; hiss(at, fast ? 0.8 : 1.3, 1400, 0.9, 0.25); hiss(at, fast ? 0.8 : 1.3, 3800, 6, 0.03); }
  function exhale(fast) {   // rumble through the regulator, then the bubbles
    if (!ctx || !settings.sound) return; const at = ctx.currentTime;
    hiss(at, fast ? 0.9 : 1.4, 380, 0.7, 0.35);
    for (let i = 0; i < 14; i++) { const t0 = at + 0.15 + Math.random() * (fast ? 0.9 : 1.4), o = ctx.createOscillator(), g = ctx.createGain(), f = 250 + Math.random() * 500; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 2.4, t0 + 0.05); env(g, t0, 0.06, 0.005, 0.02, 0.04); o.connect(g); g.connect(master); g.connect(verb); o.start(t0); o.stop(t0 + 0.1); }
  }
  function song(near) {   // a humpback-style phrase: slow gliding moans with vibrato, drenched in reverb
    const at = ctx.currentTime, units = 3 + (Math.random() * 3 | 0);
    for (let u = 0; u < units; u++) {
      const t0 = at + u * 1.8, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), base = 90 + Math.random() * 260;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * (0.6 + Math.random() * 0.9), t0 + 1.5);
      lfo.frequency.value = 4 + Math.random() * 3; lg.gain.value = base * 0.03; lfo.connect(lg).connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      env(g, t0, near ? 0.12 : 0.04, 0.4, 0.8, 0.5); o.connect(f).connect(g); g.connect(verb); if (near) g.connect(master);
      o.start(t0); lfo.start(t0); o.stop(t0 + 1.9); lfo.stop(t0 + 1.9);
    }
  }
  function clicks() { const at = ctx.currentTime; for (let i = 0; i < 8; i++) { const t0 = at + i * (0.4 + Math.random() * 0.3); hiss(t0, 0.02, 2500, 1, 0.3); } }
  let humGain = null;
  function hum(level) {   // thrusters and life support: a low electric hum
    if (!ctx) return;
    if (!humGain) { humGain = ctx.createGain(); humGain.gain.value = 0; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; for (const hz of [48, 48.7, 96.3]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.connect(f); o.start(); } f.connect(humGain).connect(master); }
    humGain.gain.setTargetAtTime(settings.sound ? level : 0, ctx.currentTime, 0.4);
  }
  function update(depth, now, whaleNear, spermNear) {
    if (!ctx || !settings.sound) return;
    const k = clamp(depth / 200, 0, 1);
    muffle.frequency.setTargetAtTime(lerp(2400, 700, k), ctx.currentTime, 0.5);   // deeper = more muffled
    ambGain.gain.setTargetAtTime(lerp(0.22, 0.07, k), ctx.currentTime, 0.5); ambFilter.frequency.setTargetAtTime(lerp(650, 250, k), ctx.currentTime, 0.5);
    if (now > nextSong && (whaleNear || (depth > 250 && Math.random() < 0.5))) { song(whaleNear); nextSong = now + 20 + Math.random() * 30; }
    else if (now > nextSong) nextSong = now + 15;
    if (spermNear && now > nextClick) { clicks(); nextClick = now + 4 + Math.random() * 4; }
  }
  function shutter() {
    if (!ctx || !settings.sound) return;
    const n = ctx.sampleRate * 0.14 | 0, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const u = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - u, 3) * (u < 0.12 || (u > 0.5 && u < 0.62) ? 1 : 0.15); }
    const src = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 0.5; src.buffer = buf; src.connect(g).connect(master); src.start();
  }
  return { init, apply, inhale, exhale, update, shutter, hum };
})();
const shutterSound = () => audio.shutter();

async function shoot() {
  if (t - lastShot < 0.6) return; lastShot = t;
  const useStrobe = strobeOn();   // auto strobe: on everywhere but the bright shallows (and always in caves and wrecks)
  if (useStrobe) { strobe.position.copy(camera.position).addScaledVector(forward(), 0.3); strobe.intensity = 160; }
  const shot = analyzeFrame(useStrobe);
  renderFrame();
  const src = renderer.domElement, W = 960, H = 540, cv = makeCanvas(W, H), g = cv.getContext('2d');
  let cw = src.width, ch = cw * H / W; if (ch > src.height) { ch = src.height; cw = ch * W / H; }
  g.drawImage(src, (src.width - cw) / 2, (src.height - ch) / 2, cw, ch, 0, 0, W, H);
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  strobe.intensity = 0;
  const flash = $('flash'); flash.style.transition = 'none'; flash.style.opacity = useStrobe ? '0.85' : '0.35'; requestAnimationFrame(() => { flash.style.transition = 'opacity .45s ease-out'; flash.style.opacity = '0'; });
  shutterSound();
  presence.spike += useStrobe ? 0.55 : 0.1;
  if (useStrobe) for (const c of mobile) if (c.p.distanceTo(diver.p) < 9 && !['shark', 'whale', 'turtle'].includes(c.sp.type) && c.sp.mood !== 'curious' && !c.st && c.trust < 0.6) { c.flee = t + 1.5; c.fleeFrom = null; }
  const b = shot.best;
  const photo = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: Date.now(), dive: diveId, site: site.name, area: site.area, depth: Math.round(-diver.p.y),
    img: cv.toDataURL('image/jpeg', 0.85), stars: shot.stars, tips: shot.tips, strobe: useStrobe, zoom: +zoom.toFixed(1),
    subject: b ? { id: b.c.sp.id, kind: kindName(b.c.sp), dist: +b.dist.toFixed(1), depth: Math.round(-b.c.p.y), count: shot.same,
      note: b.c.cleaning ? 'cleaner wrasse were picking it clean' : b.c.st ? 'it was working at its cleaning station' : b.c.surf ? 'it was taking a breath at the surface' : b.c.flash > 0.3 ? 'it was flashing colours' : b.c.circling ? 'it was circling you' : b.c.rest && b.c.sp.type === 'shark' ? 'it was resting on the bottom' : b.c.puff > 0.6 ? 'it had puffed itself up' : b.c.hide > 0.5 ? 'it was pulling back into its burrow' : b.c.prey ? 'it was chasing another fish' : b.c.sleep ? 'it was asleep in a bubble of mucus' : b.c.inspect ? 'it swam over to look at you' : b.c.fixed ? '' : b.c.flee > t ? 'it darted away from you' : '' } : null,
    others: shot.others, researched: false, night: diveOpts.night, inside: darkAt(diver.p) > 0.3 ? darkAt.kind : null };
  photos.push(photo); updateShotCount(); photoDB.put(photo);
  const st = '★'.repeat(shot.stars) + '☆'.repeat(3 - shot.stars);
  toast(b ? `📷 ${st} ${known(b.c.sp) && progress.discovered[b.c.sp.id] ? b.c.sp.name : `Unidentified ${photo.subject.kind}`} at ${photo.depth} m${shot.tips.length ? ' — ' + shot.tips[0] : ''}` : `📷 ${shot.tips[0]}`);
  checkGoals(photo, b?.c);
}

// ---------- photo log ----------
let logFilter = 'dive', viewing = null;
const fmtTime = ms => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
function renderPhotos() {
  const list = photos.filter(p => logFilter === 'all' || p.dive === diveId).slice().reverse();
  const subjects = new Set(list.filter(p => p.subject).map(p => p.subject.id)).size;
  $('ph-stats').textContent = list.length ? `${list.length} photo${list.length > 1 ? 's' : ''} · ${subjects} different subject${subjects === 1 ? '' : 's'} · best ${'★'.repeat(Math.max(...list.map(p => p.stars)))}` : '';
  for (const b of $('ph-filters').children) b.classList.toggle('on', b.dataset.f === logFilter);
  $('ph-grid').innerHTML = list.length ? '' : `<p class="empty">No photos yet${logFilter === 'dive' ? ' on this dive' : ''}. Press <kbd>F</kbd> to raise your camera, then click to shoot.</p>`;
  for (const p of list) {
    const el = document.createElement('button'); el.className = 'ph';
    el.innerHTML = `<img alt=""><span class="st"></span><span class="cap"><b></b><small></small></span>`;
    el.querySelector('img').src = p.img; el.querySelector('.st').textContent = '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars);
    el.querySelector('b').textContent = p.subject ? (p.identified ? SP[p.identified].name : `Unidentified ${p.subject.kind}`) : 'No subject';
    el.querySelector('small').textContent = `${p.depth} m · ${p.site}`;
    el.onclick = () => showPhoto(p); $('ph-grid').appendChild(el);
  }
}
function showPhoto(p) {
  viewing = p; $('pv').hidden = false;
  $('pv-img').src = p.img;
  $('pv-title').textContent = p.subject ? (p.identified ? SP[p.identified].name : `Unidentified ${p.subject.kind}`) : 'No subject in frame';
  $('pv-stars').textContent = '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars);
  $('pv-meta').innerHTML = '';
  const rows = [['Where', `${p.site} · ${p.area}`], ['Depth', `${p.depth} m`], ['Taken', fmtTime(p.time)],
    ['Subject', p.subject ? `${p.subject.dist} m away at ${p.subject.depth} m depth` : '—'], ['Also in frame', p.others.length ? `${p.others.length} other kind${p.others.length > 1 ? 's' : ''} of animal` : 'nothing else'],
    ['Camera', `${p.zoom}× zoom${p.strobe ? ' · strobe' : ''}`], ['Tips', p.tips.length ? p.tips.join(' · ') : 'Great shot!']];
  for (const [k, v] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; $('pv-meta').append(dt, dd); }
  $('pv-note').hidden = !p.subject || !!p.identified;
  $('pv-download').href = p.img; $('pv-download').download = `scuba-${p.site.replace(/\W+/g, '-').toLowerCase()}-${p.depth}m-${p.id.slice(0, 13)}.jpg`;
}
function openPhotos() { $('photos').hidden = false; $('pv').hidden = true; document.exitPointerLock?.(); renderPhotos(); }
$('open-photos').onclick = openPhotos; $('open-camera').onclick = () => setCamMode(!camMode);
$('ph-close').onclick = () => { $('photos').hidden = true; };
$('ph-filters').onclick = e => { const f = e.target.dataset?.f; if (f) { logFilter = f; renderPhotos(); } };
$('pv-back').onclick = () => { $('pv').hidden = true; };
$('pv-delete').onclick = async () => { if (!viewing || !confirm('Delete this photo?')) return; photos = photos.filter(p => p !== viewing); await photoDB.del(viewing.id); updateShotCount(); $('pv').hidden = true; renderPhotos(); };
const viewDistance = k => { settings.camK = clamp(settings.camK * k, 0.35, 2); saveSettings(); };   // third-person camera distance
canvas.addEventListener('wheel', e => { if (!site) return; e.preventDefault(); if (VIEW.on) { VIEW.dist = clamp(VIEW.dist * (e.deltaY < 0 ? 0.9 : 1.1), 0.4, 3); VIEW.input = t; return; } if (camMode) { zoom = clamp(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 4); updateZoom(); } else viewDistance(e.deltaY < 0 ? 1 / 1.1 : 1.1); }, { passive: false });

// ---------- dive summary ----------
function endDive() {
  const shots = photos.filter(p => p.dive === diveId), mins = Math.max(1, Math.round((t - diveStats.start) / 60));
  $('sum-title').textContent = `${site.name} · ${diveOpts.night ? 'night' : 'day'} dive`;
  const rows = [['Dive time', `${mins} min`], ['Max depth', `${Math.round(diveStats.maxDepth).toLocaleString()} m`],
    ['Photos', `${shots.length}${shots.length ? ` · ${shots.filter(p => p.stars === 3).length} three-star` : ''}`],
    ['Deepest gear', GEAR[gearAt(diveStats.maxDepth)].name], ['To research', `${shots.filter(p => p.subject && !progress.discovered[p.subject.id]).length} unidentified animal photo(s)`]];
  $('sum-meta').innerHTML = ''; for (const [k, v] of rows) { const a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = k; b.textContent = v; $('sum-meta').append(a, b); }
  $('sum-shots').innerHTML = ''; for (const p of shots.slice(-8)) { const i = document.createElement('img'); i.src = p.img; i.alt = ''; $('sum-shots').appendChild(i); }
  setCamMode(false); closeCard(); $('guide').hidden = true; $('photos').hidden = true; document.exitPointerLock?.();
  site = null; $('hud').hidden = true; $('summary').hidden = false; applyTouch();
}
$('change-site').onclick = endDive;
$('sum-land').onclick = () => { $('summary').hidden = true; openLand(); };
$('sum-sites').onclick = () => { $('summary').hidden = true; showPicker(); };

// ---------- research station (part 3) ----------
const BADGES = (() => {
  const sharks = species.filter(s => s.type === 'shark' && isNative(s)).map(s => s.id), N = species.length;
  const byFilter = (fn) => ids => ids.filter(id => fn(SP[id])).length;
  return [
    { id: 'first', icon: '🔍', name: 'First discovery', desc: 'Identify your first species', need: 1, count: ids => ids.length },
    { id: 'ten', icon: '📘', name: 'Field naturalist', desc: 'Identify 10 species', need: 10, count: ids => ids.length },
    { id: 'fifty', icon: '🎓', name: 'Marine biologist', desc: 'Identify 50 species', need: 50, count: ids => ids.length },
    { id: 'all', icon: '🏆', name: 'Complete logbook', desc: `Identify all ${N} species`, need: N, count: ids => ids.length },
    { id: 'big5', icon: '⭐', name: 'Maldives big five', desc: 'Whale shark, reef manta, green turtle, grey reef shark and Napoleon wrasse', need: 5, count: ids => ['whale_shark', 'reef_manta', 'green_turtle', 'grey_reef', 'napoleon'].filter(id => ids.includes(id)).length },
    { id: 'sharks', icon: '🦈', name: `All ${sharks.length} Maldives sharks`, desc: 'Identify every shark native to the Maldives', need: sharks.length, count: ids => sharks.filter(id => ids.includes(id)).length },
    { id: 'mammals', icon: '🐋', name: 'Marine mammals', desc: 'Identify 3 whales, dolphins, dugongs or sea lions', need: 3, count: byFilter(s => s.type === 'whale') },
    { id: 'reef', icon: '🪸', name: 'Coral gardener', desc: 'Identify 10 corals, anemones, sponges or plants', need: 10, count: byFilter(s => CORAL.has(s.type)) },
    { id: 'glow', icon: '✨', name: 'Glow hunter', desc: 'Identify 5 bioluminescent animals', need: 5, count: byFilter(s => !!s.glow) },
    { id: 'midnight', icon: '🌑', name: 'Midnight zone', desc: 'Identify an animal that usually lives below 1,000 m', need: 1, count: byFilter(s => (s.typ || s.depth)[0] >= 1000) },
    { id: 'hadal', icon: '🕳️', name: 'Hadal explorer', desc: 'Identify an animal from the trenches, below 6,000 m', need: 1, count: byFilter(s => (s.typ || s.depth)[0] >= 6000) },
    { id: 'visitors', icon: '🌍', name: 'Visitors from afar', desc: 'Identify 5 species not found in the Maldives', need: 5, count: byFilter(s => !isNative(s)) },
    { id: 'night', icon: '🌙', name: 'Night diver', desc: 'Identify an animal you photographed on a night dive', need: 1, count: () => photos.filter(p => p.night && p.identified).length },
    { id: 'sharp', icon: '📸', name: 'Sharp shooter', desc: 'Take 10 three-star photos', need: 10, count: () => photos.filter(p => p.stars === 3).length },
  ];
})();
function checkBadges() {
  const ids = Object.keys(progress.discovered);
  for (const b of BADGES) if (!progress.badges[b.id] && b.count(ids) >= b.need) { progress.badges[b.id] = Date.now(); toast(`🏅 Badge earned: ${b.name}`); }
  saveProgress();
}

let landTab = 'identify', idSel = null, idState = null, logFilter2 = 'all', logSel = null;
const needsResearch = () => photos.filter(p => p.subject && !p.researched);
function openLand() {
  // photos of species you already know are filed automatically
  for (const p of photos) if (p.subject && !p.researched && progress.discovered[p.subject.id]) { p.researched = true; p.identified = p.subject.id; photoDB.put(p); }
  $('picker').hidden = true; $('land').hidden = false; idSel = null; renderLand();
}
function closeLand() { $('land').hidden = true; showPicker(); }
$('to-land').onclick = openLand; $('land-dive').onclick = closeLand;
$('land-tabs').onclick = e => { const k = e.target.closest('button')?.dataset.t; if (k) { landTab = k; renderLand(); } };
function renderLand() {
  const n = needsResearch().length, found = Object.keys(progress.discovered).length;
  for (const b of $('land-tabs').children) b.classList.toggle('on', b.dataset.t === landTab);
  $('lt-identify').textContent = n ? `Identify photos (${n})` : 'Identify photos';
  $('lt-logbook').textContent = `Species logbook · ${found}/${species.length}`;
  $('lt-badges').textContent = `Badges & challenges · ${Object.keys(progress.badges).length + Object.keys(progress.goals).length}/${BADGES.length + GOALS.length}`;
  for (const id of ['identify', 'logbook', 'badges']) $('land-' + id).hidden = landTab !== id;
  if (landTab === 'identify') renderIdentify(); else if (landTab === 'logbook') renderLogbook(); else renderBadges();
}

// Look-alikes: same body type, similar size, mostly animals that could also be found at that depth.
function candidates(p) {
  const sp = SP[p.subject.id], R = rng(hash(p.id)), d = p.subject.depth, h = sp.f?.h || 0.4;
  const scored = species.filter(s => s !== sp).map(s => {
    const ratio = Math.max(s.size, sp.size) / Math.min(s.size, sp.size);
    const score = (s.type === sp.type ? 4 : kindName(s) === kindName(sp) ? 3 : 0) + (d >= s.depth[0] && d <= s.depth[1] ? 2 : 0) + (ratio < 2 ? 1.5 : ratio < 4 ? 0.5 : 0) + (Math.abs((s.f?.h || 0.4) - h) < 0.15 ? 0.5 : 0) + R() * 1.2;
    return { s, score };
  }).sort((a, b) => b.score - a.score).slice(0, 3).map(o => o.s);
  const opts = [sp, ...scored];
  for (let i = opts.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return opts;
}
const sizeText = m => m < 1 ? `${Math.max(1, Math.round(m * 70))}–${Math.round(m * 130)} cm` : `${(m * 0.7).toFixed(1)}–${(m * 1.3).toFixed(1)} m`;
function clues(p) {
  const sp = SP[p.subject.id], s = p.subject, out = [];   // better photos reveal more
  out.push(['📍', 'Where', `${p.site}, ${p.area}${p.night ? ' · at night' : ''}`]);
  out.push(['🌊', 'Depth', `${s.depth.toLocaleString()} m`]);
  out.push(['🧬', 'Body type', s.kind]);
  if (p.stars >= 2) out.push(['📏', 'Estimated size', sizeText(sp.size)]);
  if (p.stars >= 2) out.push(['👥', 'Seen', s.count > 1 ? `in a group of about ${s.count}` : sp.hab === 'benthic' ? 'attached to the reef or seabed' : 'on its own']);
  if (p.stars >= 3) out.push(['🎨', 'Colours', `mostly ${colourName(sp.c[0])}${sp.c[1] && colourName(sp.c[1]) !== colourName(sp.c[0]) ? ` with ${colourName(sp.c[1])}` : ''}`]);
  if (p.stars >= 3 && s.note) out.push(['👀', 'Behaviour', s.note]);
  if (p.stars < 3) out.push(['💡', 'Tip', 'Sharper, closer photos (★★★) give you more clues']);
  return out;
}
function colourName(hex) {
  const [r, g, b] = rgb(hex), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
  if (mx - mn < 28) return l > 0.8 ? 'white' : l < 0.2 ? 'black' : 'grey';
  const hue = new Color(hex).getHSL({}).h * 360;
  const name = hue < 15 || hue >= 340 ? 'red' : hue < 40 ? 'orange' : hue < 65 ? 'yellow' : hue < 160 ? 'green' : hue < 200 ? 'teal' : hue < 255 ? 'blue' : hue < 290 ? 'purple' : 'pink';
  return l < 0.3 ? `dark ${name}` : l > 0.75 ? `pale ${name}` : name;
}
function whyNot(pick, p) {
  const s = p.subject, d = s.depth, true_ = SP[s.id];
  if (d < pick.depth[0] || d > pick.depth[1]) return `${pick.name} lives at ${pick.depth[0].toLocaleString()}–${pick.depth[1].toLocaleString()} m, not ${d.toLocaleString()} m.`;
  const ratio = pick.size / true_.size;
  if (ratio > 2.5) return `${pick.name} is much bigger than this animal.`;
  if (ratio < 0.4) return `${pick.name} is much smaller than this animal.`;
  if (pick.type !== true_.type) return `${pick.name} has a different body shape.`;
  return `Not quite — compare the colours and fin shapes with ${pick.name} again.`;
}
function renderIdentify() {
  const keep = idSel && idState?.done, list = needsResearch();   // keep showing a just-solved photo until "Next"
  if (keep && !list.includes(idSel)) list.unshift(idSel);
  $('id-list').innerHTML = '';
  if (!list.length) { $('id-work').innerHTML = `<div class="id-empty"><h3>All caught up 🎉</h3><p>Every photo is identified. Go diving and photograph animals you haven't met yet — raise your camera with <kbd>F</kbd>.</p></div>`; return; }
  if (!idSel || !list.includes(idSel)) { idSel = list[0]; idState = null; }
  for (const p of list) {
    const b = document.createElement('button'); b.className = 'id-thumb' + (p === idSel ? ' on' : '');
    b.innerHTML = '<img alt=""><span></span>'; b.querySelector('img').src = p.img; b.querySelector('span').textContent = `${'★'.repeat(p.stars)} · ${p.subject.depth} m`;
    b.onclick = () => { idSel = p; idState = null; renderIdentify(); }; $('id-list').appendChild(b);
  }
  const p = idSel; idState = idState || { opts: candidates(p), wrong: [], done: false };
  const w = $('id-work'); w.innerHTML = '';
  const img = document.createElement('img'); img.className = 'id-photo'; img.src = p.img; img.alt = 'Photo to identify'; w.appendChild(img);
  const notes = document.createElement('div'); notes.className = 'id-notes';
  notes.innerHTML = '<h3>Field notes</h3><ul></ul>';
  for (const [ic, k, v] of clues(p)) { const li = document.createElement('li'); li.innerHTML = '<span></span><b></b><em></em>'; li.children[0].textContent = ic; li.children[1].textContent = k; li.children[2].textContent = v; notes.querySelector('ul').appendChild(li); }
  w.appendChild(notes);
  const q = document.createElement('div'); q.className = 'id-q';
  q.innerHTML = `<h3>Which species is it?</h3><div class="id-opts"></div><p class="id-msg"></p>`;
  for (const s of idState.opts) {
    const b = document.createElement('button'); b.className = 'id-opt';
    const bad = idState.wrong.includes(s.id), right = idState.done && s.id === p.subject.id;
    if (bad) b.classList.add('bad'); if (right) b.classList.add('good');
    b.disabled = bad || idState.done;
    b.innerHTML = '<i></i><b></b><small></small><span></span>';
    b.querySelector('i').style.background = s.c[0]; b.querySelector('b').textContent = s.name; b.querySelector('small').textContent = s.sci;
    b.querySelector('span').textContent = `${s.depth[0].toLocaleString()}–${s.depth[1].toLocaleString()} m · ${s.sizeTxt || (s.size < 1 ? `~${Math.round(s.size * 100)} cm` : `~${s.size} m`)}`;
    b.onclick = () => guess(s); q.querySelector('.id-opts').appendChild(b);
  }
  w.appendChild(q);
  if (idState.msg) q.querySelector('.id-msg').textContent = idState.msg;
  if (idState.done) {
    const card = document.createElement('div'); card.className = 'id-result'; card.innerHTML = $('card-template').innerHTML; w.appendChild(card);
    fillCardEl(card, SP[p.subject.id]);
    const next = document.createElement('button'); next.className = 'btn primary'; next.textContent = needsResearch().length ? 'Next photo →' : 'Done';
    next.onclick = () => { idSel = null; idState = null; renderLand(); }; card.appendChild(next);
  }
}
function guess(s) {
  const p = idSel, sp = SP[p.subject.id];
  if (s.id === sp.id) {
    const isNew = !progress.discovered[sp.id];
    idState.done = true; idState.msg = isNew ? `✅ Correct! New species: ${sp.name}` : `✅ Correct — ${sp.name}`;
    identify(p, sp.id);
  } else {
    idState.wrong.push(s.id);
    if (idState.wrong.length >= 2) { idState.done = true; idState.msg = `${whyNot(s, p)} It was the ${sp.name.toLowerCase()} — added to your logbook.`; identify(p, sp.id); }
    else idState.msg = `❌ ${whyNot(s, p)} Try again.`;
  }
  renderLand();
}
function identify(p, id) {
  if (!progress.discovered[id]) progress.discovered[id] = { time: Date.now(), photo: p.id };
  for (const q of photos) if (q.subject?.id === id && !q.researched) { q.researched = true; q.identified = id; photoDB.put(q); }
  saveProgress(); checkBadges(); checkGoals();
}

function renderLogbook() {
  const ids = Object.keys(progress.discovered), N = species.length;
  $('lb-progress').style.width = `${ids.length / N * 100}%`;
  $('lb-count').textContent = `${ids.length} / ${N} species discovered`;
  for (const b of $('lb-filters').children) b.classList.toggle('on', b.dataset.f === logFilter2);
  const has = s => !!progress.discovered[s.id];
  const list = sorted.filter(s => ({ all: true, found: has(s), missing: !has(s), native: isNative(s) })[logFilter2]);
  const grid = $('lb-grid'); grid.innerHTML = '';
  for (const s of list) {
    const found = !!progress.discovered[s.id], b = document.createElement('button'); b.className = 'lb-card' + (found ? '' : ' unknown');
    const best = found && photos.filter(p => p.identified === s.id).sort((a, b) => b.stars - a.stars)[0];
    b.innerHTML = '<div class="pic"></div><b></b><small></small>';
    if (best) { const i = document.createElement('img'); i.src = best.img; i.alt = ''; b.firstChild.appendChild(i); } else { b.firstChild.style.background = found ? s.c[0] : ''; b.firstChild.textContent = found ? '' : '?'; }
    b.querySelector('b').textContent = found ? s.name : `Unknown ${kindName(s)}`;
    b.querySelector('small').textContent = found ? s.sci : zoneOf(midDepth(s))[2];
    b.disabled = !found; b.onclick = () => { logSel = s; showLogCard(); };
    grid.appendChild(b);
  }
}
function showLogCard() { const s = logSel; $('lb-detail').hidden = false; $('lb-card').innerHTML = $('card-template').innerHTML; fillCardEl($('lb-card'), s); const n = photos.filter(p => p.identified === s.id).length; $('lb-photos').textContent = n ? `You have ${n} photo${n > 1 ? 's' : ''} of this species.` : ''; }
$('lb-close').onclick = () => { $('lb-detail').hidden = true; };
$('lb-filters').onclick = e => { const f = e.target.dataset?.f; if (f) { logFilter2 = f; renderLogbook(); } };
function renderBadges() {
  const ids = Object.keys(progress.discovered), g = $('bd-grid'); g.innerHTML = '';
  for (const b of BADGES) {
    const n = Math.min(b.need, b.count(ids)), got = !!progress.badges[b.id], el = document.createElement('div');
    el.className = 'badge' + (got ? ' got' : '');
    el.innerHTML = '<span class="ic"></span><b></b><small></small><div class="bar2"><i></i></div><em></em>';
    el.querySelector('.ic').textContent = b.icon; el.querySelector('b').textContent = b.name; el.querySelector('small').textContent = b.desc;
    el.querySelector('.bar2 i').style.width = `${n / b.need * 100}%`; el.querySelector('em').textContent = got ? `Earned ${new Date(progress.badges[b.id]).toLocaleDateString()}` : `${n} / ${b.need}`;
    g.appendChild(el);
  }
  renderGoalsInto($('bd-goals'));
}

// ---------- settings ----------
function openSettings() {
  $('settings').hidden = false; document.exitPointerLock?.();
  $('set-hide').checked = settings.hideNames; $('set-sound').checked = settings.sound; $('set-volume').value = settings.volume;
  $('set-bloom').checked = settings.bloom; $('set-shadows').checked = settings.shadows; $('set-touch').value = settings.touch;
}
$('open-settings').onclick = openSettings; $('hud-settings').onclick = openSettings; $('land-settings').onclick = openSettings;
$('set-close').onclick = () => { $('settings').hidden = true; };
for (const [id, key, ev] of [['set-hide', 'hideNames', 'checked'], ['set-sound', 'sound', 'checked'], ['set-volume', 'volume', 'value'], ['set-bloom', 'bloom', 'checked'], ['set-shadows', 'shadows', 'checked'], ['set-touch', 'touch', 'value']])
  $(id).addEventListener('input', () => { settings[key] = ev === 'value' && key === 'volume' ? +$(id).value : $(id)[ev]; saveSettings(); applySettings(); });
$('set-reset').onclick = () => { if (!confirm('Reset your logbook, badges and goals? Photos are kept but become unidentified again.')) return; progress.discovered = {}; progress.badges = {}; progress.goals = {}; progress.targets = {}; saveProgress(); for (const p of photos) { p.researched = false; delete p.identified; photoDB.put(p); } toast('Progress reset'); };
function applySettings() { applyGraphics(); applyAudio(); applyTouch(); renderSitePicker(); }
// filled in by later features
function applyGraphics() { renderer.shadowMap.needsUpdate = true; } function applyAudio() { audio.apply(); } 
// ---------- goals: photo challenges and site targets ----------
const GOALS = [
  { id: 'manta', icon: '🪽', name: 'Manta portrait', desc: 'A ★★★ photo of a reef manta ray', test: p => p.subject?.id === 'reef_manta' && p.stars === 3 },
  { id: 'hammers', icon: '🔨', name: 'Hammerhead school', desc: 'At least 3 scalloped hammerheads in one frame', test: p => p.subject?.id === 'scalloped_hammer' && p.subject.count >= 3 },
  { id: 'giant', icon: '🐋', name: 'Gentle giant', desc: 'Photograph a whale shark', test: p => p.subject?.id === 'whale_shark' },
  { id: 'glow', icon: '✨', name: 'Living light', desc: 'Photograph a glowing animal below 500 m', test: p => p.subject && SP[p.subject.id].glow && p.subject.depth > 500 },
  { id: 'trench', icon: '🕳️', name: 'Trench photographer', desc: 'Photograph an animal below 6,000 m', test: p => p.subject?.depth > 6000 },
  { id: 'night', icon: '🌙', name: 'Night hunter', desc: 'Photograph a whitetip reef shark on a night dive', test: p => p.night && p.subject?.id === 'whitetip_reef' },
  { id: 'sleeper', icon: '💤', name: 'Sweet dreams', desc: 'Photograph a parrotfish asleep in its mucus cocoon', test: (p, c) => !!c?.sleep },
  { id: 'puff', icon: '🐡', name: 'Puffed up', desc: 'Photograph an inflated puffer or porcupinefish', test: (p, c) => c?.puff > 0.6 },
  { id: 'hunt', icon: '⚡', name: 'Caught in the act', desc: 'Photograph a predator chasing its prey', test: (p, c) => !!c?.prey },
  { id: 'bait', icon: '🌀', name: 'Bait ball', desc: 'Photograph fish packed into a bait ball', test: (p, c) => !!c && (c.leader || c).ballUntil > t },
  { id: 'macro', icon: '🔬', name: 'Macro master', desc: 'A ★★★ photo of an animal smaller than 10 cm', test: p => p.subject && SP[p.subject.id].size < 0.1 && p.stars === 3 },
  { id: 'crowd', icon: '🐠', name: 'Busy reef', desc: '4 different kinds of animal in one frame', test: p => !!p.subject && p.others.length >= 3 },
  { id: 'garden', icon: '🪱', name: 'Garden party', desc: '5 or more garden eels in one frame', test: p => p.subject?.id === 'garden_eel' && p.subject.count >= 5 },
  { id: 'clean', icon: '🧽', name: 'Cleaning station', desc: 'Photograph an animal holding still while cleaner wrasse pick it clean', test: (p, c) => !!c?.cleaning || !!c?.st?.client?.cleaning },
  { id: 'breath', icon: '🫧', name: 'Coming up for air', desc: 'Photograph a turtle, sea snake or dolphin taking a breath at the surface', test: (p, c) => !!c?.surf },
  { id: 'flash', icon: '🐙', name: 'Colour show', desc: 'Photograph an octopus, cuttlefish or squid flashing colours', test: (p, c) => c?.flash > 0.3 },
  { id: 'wreck', icon: '🚢', name: 'Wreck diver', desc: 'Photograph an animal from inside the holds or bridge of the Maldives Victory', test: p => !!p.subject && p.inside === 'wreck' },
  { id: 'cave', icon: '🔦', name: 'Into the dark', desc: 'Photograph an animal from inside a cave (Banana Reef and Maaya Thila have them)', test: p => !!p.subject && p.inside === 'cave' },
  { id: 'swarm', icon: '✨', name: 'Golden swarm', desc: '10 or more pygmy sweepers in one frame', test: p => p.subject?.id === 'glassfish' && p.subject.count >= 10 },
  { id: 'resting', icon: '😴', name: 'Resting shark', desc: 'Photograph a whitetip reef shark resting in a cave by day', test: (p, c) => c?.sp.id === 'whitetip_reef' && !!c.rest && !p.night },
  { id: 'close', icon: '🤝', name: 'Close encounter', desc: 'A ★★★ photo of a curious animal circling you, from less than 4 m away — stay calm and let it come to you', test: (p, c) => !!c?.circling && p.stars === 3 && p.subject.dist < 4 },
];
function completeGoal(g) { if (progress.goals[g.id]) return; progress.goals[g.id] = Date.now(); toast(`🎯 Challenge complete: ${g.name}`); saveProgress(); }
function checkGoals(photo, c) {
  if (!photo) return;
  for (const g of GOALS) if (!progress.goals[g.id] && g.test(photo, c)) completeGoal(g);
  const tg = site?.target;
  if (tg && photo.subject?.id === tg.id && photo.stars >= 2 && !progress.targets[site.id]) { progress.targets[site.id] = Date.now(); saveProgress(); toast(`🎯 Site target photographed at ${site.name}!`); updateTarget(); }
}
function updateTarget() {
  const tg = site?.target; $('target').hidden = !tg; if (!tg) return;
  $('target').textContent = progress.targets[site.id] ? `🎯 Target found: ${label(SP[tg.id])} ✓` : `🎯 Target: ${tg.hint} Get a ★★ photo.`;
}
function renderGoalsInto(el) {
  el.innerHTML = '<h3>Photo challenges</h3><div class="goal-list" id="gl-ch"></div><h3>Site targets</h3><div class="goal-list" id="gl-tg"></div>';
  const row = (icon, name, desc, done) => { const d = document.createElement('div'); d.className = 'goal' + (done ? ' done' : ''); d.innerHTML = '<span></span><b></b><small></small><em></em>'; d.children[0].textContent = icon; d.children[1].textContent = name; d.children[2].textContent = desc; d.children[3].textContent = done ? `✓ ${new Date(done).toLocaleDateString()}` : ''; return d; };
  for (const g of GOALS) el.querySelector('#gl-ch').appendChild(row(g.icon, g.name, g.desc, progress.goals[g.id]));
  for (const s of sites) if (s.target) el.querySelector('#gl-tg').appendChild(row('🎯', s.name, progress.targets[s.id] ? label(SP[s.target.id]) : s.target.hint, progress.targets[s.id]));
}


// ---------- input ----------
const uiOpen = () => VIEW.on || ['guide', 'help', 'picker', 'photos', 'settings', 'summary', 'land'].some(id => !$(id).hidden);
let locked = false, lockFailed = false, drag = null;
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (locked) mouseNDC = null; });
document.addEventListener('pointerlockerror', () => { lockFailed = true; });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') { if (e.code === 'Escape') $('guide').hidden = true; return; }
  if (e.code === 'Escape') { if (!$('settings').hidden) { $('settings').hidden = true; return; } if (VIEW.on) { closeGearView(); return; } if (!$('pv').hidden) $('pv').hidden = true; else if (!$('photos').hidden) $('photos').hidden = true; else if (camMode) setCamMode(false); $('guide').hidden = true; $('help').hidden = true; closeCard(); return; }
  if (!site) return;
  if (e.code === 'KeyG') { e.preventDefault(); $('guide').hidden ? openGuide() : ($('guide').hidden = true); return; }
  if (e.code === 'KeyH') { $('help').hidden = !$('help').hidden; return; }
  if (e.code === 'KeyI') { VIEW.on ? closeGearView() : !uiOpen() && openGearView(); return; }
  if (e.code === 'KeyV') { firstPerson = !firstPerson; return; }
  if (e.code === 'KeyP') { $('photos').hidden ? openPhotos() : ($('photos').hidden = true); return; }
  if (uiOpen()) return;
  if (e.code === 'KeyF') { setCamMode(!camMode); return; }
  if (camMode && (e.code === 'Enter' || e.code === 'NumpadEnter')) { shoot(); return; }
  if (e.code === 'Equal' || e.code === 'NumpadAdd') { if (camMode) { zoom = clamp(zoom * 1.25, 1, 4); updateZoom(); } else viewDistance(1 / 1.2); return; }
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') { if (camMode) { zoom = clamp(zoom / 1.25, 1, 4); updateZoom(); } else viewDistance(1.2); return; }
  if (e.code === 'KeyE') { const c = pick(); if (c) openCard(c); return; }
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const look = (dx, dy) => { if (VIEW.on) { VIEW.yaw += dx * 0.008; VIEW.pitch = clamp(VIEW.pitch + dy * 0.006, -1.2, 1.3); VIEW.input = t; return; } const k = 0.0025 / (camMode ? zoom : 1); diver.yaw -= dx * k; diver.pitch = clamp(diver.pitch - dy * k, -1.45, 1.45); };
canvas.addEventListener('mousedown', e => { drag = { moved: 0 }; });
addEventListener('mouseup', () => {
  if (!drag) return; const wasClick = drag.moved < 5; drag = null;
  if (!wasClick || !site || uiOpen()) return;
  if (camMode) { shoot(); return; }
  const c = pick(); if (c) { openCard(c); return; }
  if (!locked && !lockFailed && $('card').hidden) { try { canvas.requestPointerLock?.()?.catch?.(() => { lockFailed = true; }); } catch { lockFailed = true; } }
});
addEventListener('mousemove', e => {
  if (locked) { look(e.movementX, e.movementY); return; }
  if (e.target === canvas) mouseNDC = { x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 };
  if (drag) { drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY); look(e.movementX, e.movementY); }
});
$('help-close').onclick = $('help-x').onclick = () => { $('help').hidden = true; };
$('help').onclick = e => { if (e.target === $('help')) $('help').hidden = true; };   // click outside the card to close
$('open-help').onclick = () => { $('help').hidden = false; };

// ---------- gear viewer: orbit the equipment in 360° and learn its parts ----------
const PARTS = {
  rec: [
    [[0.74, 0.1, 0], 'Mask', 'An air space in front of your eyes lets you focus underwater. You breathe out through your nose into it to stop it squeezing.'],
    [[0.76, -0.03, 0.05], 'Regulator', 'Delivers air at the same pressure as the surrounding water — and only when you breathe in.'],
    [[0, 0.34, 0], 'Tank', 'About 11 litres of air squeezed to 200 bar — roughly 2,200 litres at the surface.'],
    [[0.2, -0.14, 0.18], 'BCD', 'Buoyancy control device: a jacket you add air to or let air out of so you float, sink or hover.'],
    [[-0.12, -0.13, 0.08], 'Weight belt', 'Lead weights offset the buoyancy of the wetsuit and the air you carry.'],
    [[-0.04, -0.18, 0.22], 'Pressure gauge', 'Shows how much air is left in the tank.'],
    [[0.9, -0.15, 0.2], 'Dive light', 'Water absorbs colour with depth — red goes first — so a light brings true colours back.'],
    [[-1.3, -0.02, 0.12], 'Fins', 'Long blades turn slow, relaxed leg kicks into efficient thrust.'],
  ],
  tech: [
    [[0, 0.34, 0], 'Twinset', 'Two back-mounted cylinders joined by an isolation manifold: if one side leaks, it can be shut off and half the gas saved.'],
    [[0.38, 0.26, 0.1], 'Isolation manifold', 'The valve bar connecting the twin cylinders.'],
    [[0.18, -0.08, 0.36], 'Stage & deco cylinders', 'Different mixes for different depths — trimix for the deep part, oxygen-rich gases to speed up decompression on the way up.'],
    [[0.76, -0.03, 0.05], 'Trimix', 'Helium replaces some of the nitrogen and oxygen so the diver avoids narcosis and oxygen toxicity at extreme depth.'],
    [[-1.3, -0.02, 0.12], 'Fins', 'Technical divers favour stiff, short blades for precise frog kicks that don\'t stir up silt.'],
  ],
  ads: [
    [[0.05, 1.12, 0], 'Dome', 'The pilot stays at surface pressure (1 atmosphere) inside, so there is no decompression at all.'],
    [[0.22, 0.02, 0.62], 'Rotary joints', 'Sealed, fluid-filled joints let the arms and legs bend while holding back the crushing pressure outside.'],
    [[0.62, -0.12, 0.5], 'Manipulators', 'Pincer "hands" instead of gloves — delicate work is hard.'],
    [[-0.66, 0.05, 0.36], 'Thrusters', 'Electric thrusters, steered with foot pedals, let the pilot fly through the water.'],
    [[-0.58, 0.45, 0], 'Life support', 'Oxygen supply and a scrubber that removes the carbon dioxide the pilot breathes out.'],
    [[0.3, 0.55, 0.3], 'Lamps', 'At these depths there is no sunlight at all.'],
  ],
  alvin: [
    [[3.3, -0.35, 0.75], 'Personnel sphere', 'A titanium sphere about 2 m across inside, for a pilot and two scientists. Most of the sub around it floods with water.'],
    [[3.82, -0.3, 0], 'Viewports', 'Thick acrylic windows looking forward and down at the seafloor.'],
    [[4.1, -1.1, 0.6], 'Manipulator arms', 'Collect rocks, animals and water samples.'],
    [[3.1, -1.1, 0.9], 'Sample basket', 'Carries tools out and samples back.'],
    [[0.3, 2.1, 0], 'Sail', 'Hatch and handholds for launch and recovery at the surface.'],
    [[0, 1.1, 0.7], 'Syntactic foam', 'Most of the white hull is buoyant foam made of tiny glass spheres in resin, which keeps its shape under enormous pressure.'],
    [[-3.3, 0.35, 1.1], 'Thrusters', 'Electric thrusters move the sub slowly around the seafloor.'],
    [[3.5, 0.75, 0.8], 'Lights & cameras', 'A bar of lights and high-definition cameras.'],
  ],
  dsc: [
    [[0.1, 0, 0.75], 'Pilot sphere', 'A steel sphere just 1.09 m across inside. James Cameron sat folded in it for the 10,908 m dive in 2012.'],
    [[0.82, 0.05, 0], 'Viewport', 'A single small window, plus 3D cameras for filming.'],
    [[1.3, 2.6, 0], 'LED light tower', 'A tall array of lights to film in the pitch-black trench.'],
    [[0.3, 4.6, 0.5], 'Vertical hull', 'Built from a new syntactic foam. It sinks and rises upright like a vertical torpedo to travel fast — the descent took about 2.5 hours.'],
    [[-0.2, 2.2, 0.95], 'Thrusters', '12 thrusters for manoeuvring along the trench floor.'],
    [[-0.3, -0.7, 0.4], 'Ballast weights', 'Steel weights dropped at the end of the dive so the sub floats back up.'],
  ],
};
const VIEW_FRAME = { rec: [[-0.2, 0, 0], 3], tech: [[-0.2, 0, 0], 3], ads: [[0, 0, 0], 4.2], alvin: [[0, 0, 0], 13], dsc: [[0, 2.6, 0], 13] };
const VIEW = { on: false, gear: 0, yaw: 0, pitch: 0.25, dist: 1, input: 0, part: -1 };
const studio = new THREE.DirectionalLight(0xffffff, 0), studioFill = new THREE.AmbientLight(0xffffff, 0);
scene.add(studio, studio.target, studioFill);
function openGearView() {
  if (!site) return;
  setCamMode(false); closeCard(); document.exitPointerLock?.();
  Object.assign(VIEW, { on: true, yaw: 2.3, pitch: 0.25, dist: 1, input: 0, part: -1 });
  $('hud').hidden = true; $('gearview').hidden = false; selectViewGear(gearIdx);
}
function closeGearView() { VIEW.on = false; camera.clearViewOffset(); diverModel.setGear(gear().id); $('gearview').hidden = true; $('hud').hidden = false; studio.intensity = studioFill.intensity = 0; }
function selectViewGear(i) {
  VIEW.gear = i; VIEW.part = -1; const G = GEAR[i], lo = i ? GEAR[i - 1].upTo : 0;
  diverModel.setGear(G.id);
  $('gv-tabs').innerHTML = '';
  GEAR.forEach((g, k) => { const b = document.createElement('button'); b.className = k === i ? 'on' : ''; b.textContent = `${g.icon} ${g.name}`; b.onclick = () => selectViewGear(k); $('gv-tabs').appendChild(b); });
  $('gv-name').textContent = `${G.icon} ${G.name}`;
  $('gv-depth').textContent = `Used from ${lo.toLocaleString()} m to ${G.upTo === Infinity ? 'the deepest trench (10,935 m)' : `${G.upTo.toLocaleString()} m`}${i === gearIdx ? ' · your gear right now' : ''}`;
  $('gv-note').textContent = G.note;
  $('gv-parts').innerHTML = ''; $('hotspots').innerHTML = '';
  PARTS[G.id].forEach(([, name], k) => {
    const li = document.createElement('li'); li.innerHTML = `<b>${k + 1}</b><span></span>`; li.querySelector('span').textContent = name; li.onclick = () => focusPart(k); $('gv-parts').appendChild(li);
    const h = document.createElement('button'); h.className = 'hot'; h.textContent = k + 1; h.setAttribute('aria-label', name); h.onclick = () => focusPart(k); $('hotspots').appendChild(h);
  });
  $('gv-part').hidden = true;
}
function focusPart(k) {   // explain a part and turn the model so it faces the camera
  const [p, name, text] = PARTS[GEAR[VIEW.gear].id][k]; VIEW.part = k; VIEW.input = t;
  $('gv-part').hidden = false; $('gv-part-name').textContent = `${k + 1}. ${name}`; $('gv-part-text').textContent = text;
  const w = diverModel.grp.localToWorld(new Vector3(...p)).sub(diverModel.grp.localToWorld(new Vector3(...VIEW_FRAME[GEAR[VIEW.gear].id][0])));
  if (w.lengthSq() > 1e-4) VIEW.yaw = Math.atan2(w.z, w.x);
  [...$('gv-parts').children].forEach((li, j) => li.classList.toggle('on', j === k));
}
function stepGearView(dt) {   // camera orbit, studio lights and hotspot labels
  diverModel.grp.updateMatrixWorld(true);
  const id = GEAR[VIEW.gear].id, [c, r] = VIEW_FRAME[id], center = diverModel.grp.localToWorld(new Vector3(...c)), R = r * VIEW.dist;
  if (t - VIEW.input > 3) VIEW.yaw += dt * 0.25;   // slow turntable when idle
  camera.position.set(center.x + Math.cos(VIEW.pitch) * Math.cos(VIEW.yaw) * R, center.y + Math.sin(VIEW.pitch) * R, center.z + Math.cos(VIEW.pitch) * Math.sin(VIEW.yaw) * R);
  camera.lookAt(center); camera.updateMatrixWorld();
  // keep the model clear of the info panel: shift it right on wide screens, up on narrow ones
  if (innerWidth > 760) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.14, 0, innerWidth, innerHeight);
  else camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.22, innerWidth, innerHeight);
  studio.intensity = 2.4; studio.position.copy(camera.position).add(_v.set(0, R * 0.8, 0)); studio.target.position.copy(center); studioFill.intensity = 0.7;
  const hs = $('hotspots').children, toCam = _v2.subVectors(camera.position, center).normalize();
  PARTS[id].forEach(([p], k) => {
    const w = diverModel.grp.localToWorld(new Vector3(...p)), facing = w.clone().sub(center).normalize().dot(toCam), s = w.project(camera), h = hs[k];
    if (!h) return;
    h.style.left = `${(s.x + 1) / 2 * innerWidth}px`; h.style.top = `${(1 - s.y) / 2 * innerHeight}px`;
    h.style.opacity = s.z > 1 ? 0 : facing < -0.25 ? 0.35 : 1; h.classList.toggle('on', k === VIEW.part);
  });
}
$('open-gear').onclick = openGearView; $('gv-close').onclick = closeGearView;

// ---------- touch controls ----------
const touch = { x: 0, y: 0, up: false, down: false, fast: false };
function applyTouch() {
  const on = settings.touch === 'on' || (settings.touch === 'auto' && (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0));
  document.body.classList.toggle('touch', on); $('touch').hidden = !on || !site;
}
{
  const joy = $('joy'), knob = $('joy-knob'); let jid = null;
  const move = e => { const r = joy.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } touch.x = x; touch.y = y; knob.style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`; };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; try { joy.setPointerCapture(jid); } catch { /* synthetic pointer */ } move(e); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) move(e); });
  const end = e => { if (e.pointerId !== jid) return; jid = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  for (const b of $('tbtns').querySelectorAll('[data-k]')) {
    const k = b.dataset.k, set = v => e => { touch[k] = v; b.classList.toggle('on', v); e.preventDefault(); };
    b.addEventListener('pointerdown', set(true)); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
  }
  $('t-cam').onclick = () => setCamMode(!camMode); $('t-shoot').onclick = () => shoot();
  $('t-zin').onclick = () => { zoom = clamp(zoom * 1.25, 1, 4); updateZoom(); }; $('t-zout').onclick = () => { zoom = clamp(zoom / 1.25, 1, 4); updateZoom(); };
  // drag anywhere on the view to look; a quick tap inspects (or shoots with the camera up)
  const pts = new Map();
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; e.preventDefault(); pts.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 }); });
  canvas.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.moved += Math.abs(dx) + Math.abs(dy); p.x = e.clientX; p.y = e.clientY; look(dx * 1.6, dy * 1.6); });
  canvas.addEventListener('pointerup', e => {
    const p = pts.get(e.pointerId); pts.delete(e.pointerId); if (!p || p.moved > 10 || !site || uiOpen()) return;
    if (camMode) { shoot(); return; }
    mouseNDC = { x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }; const c = pick(); mouseNDC = null; if (c) openCard(c);
  });
  canvas.addEventListener('pointercancel', e => pts.delete(e.pointerId));
}

// ---------- site picker ----------
function renderSitePicker() {
  $('sites').innerHTML = '';
  for (const s of sites) {
    const el = document.createElement('button'); el.className = 'site';
    const stars = [...new Set(Object.entries(s.featured).sort((a, b) => b[1] - a[1]).map(([id]) => label(SP[id])))].slice(0, 4);
    el.innerHTML = '<b></b><small></small><p></p><em></em><span class="go">Dive here →</span>';
    el.querySelector('b').textContent = s.name; el.querySelector('small').textContent = s.area;
    el.querySelector('p').textContent = s.desc; el.querySelector('em').textContent = `Look for: ${stars.join(', ')} · Current: ${currentWord(s.current?.[0] || 0)}${s.target ? ` · 🎯 ${progress.targets[s.id] ? 'target found ✓' : 'target: ' + label(SP[s.target.id])}` : ''}`;
    el.onclick = () => startDive(s); $('sites').appendChild(el);
  }
  for (const b of $('opt-time').querySelectorAll('button')) b.classList.toggle('on', (b.dataset.v === 'night') === diveOpts.night);
  const n = needsResearch().length; $('to-land').textContent = `🏝️ Research station${n ? ` · ${n} to identify` : ''}`;
}
function showPicker() { renderSitePicker(); $('picker').hidden = false; $('land').hidden = true; }
$('opt-time').onclick = e => { const v = e.target.closest('button')?.dataset.v; if (v) { diveOpts.night = v === 'night'; renderSitePicker(); } };
renderSitePicker(); applyTouch(); setPanelMin(!!settings.panelMin);
$('species-count').textContent = species.length;
$('loading').hidden = true; $('picker').hidden = false;
window.scuba = { lights: { torch, diverLamp, sun, hemi }, diverModel, step: (n, dt = 1 / 30, draw = true) => { skipRender = !draw; for (let i = 0; i < n; i++) frame(performance.now(), dt); skipRender = false; }, presence, CAUST, frameMs: () => frameMs, setCam: c => { debugCam = c; }, diver, startDive, sites, summon, SP, live: () => live, kinds, fps: () => fps, keys, darkAt, structs, camera, pushOut, wallX, plateau }; // debug handle
requestAnimationFrame(frame);
})();
