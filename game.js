// Scuba Explorer — 3D underwater world (three.js). Loaded as a classic script so index.html works from file://.
(async () => {
const $ = id => document.getElementById(id);
let THREE;
try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'); }
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
const ambient = d => d <= 0 ? 1 : Math.exp(-d * 0.015);   // sunlight left (≈1% at 300 m)

// ---------- terrain: reef flat to the west (x < edge), a drop-off wall that falls to the trench floor ----------
const edgeX = z => 5 * Math.sin(z * 0.011) + 6 * fbm(z * 0.02, 3.1);
const plateau = (x, z) => 3 + Math.min(14, Math.max(0, edgeX(z) - x) * 0.09) + 1.4 * fbm(x * 0.05, z * 0.05) + 0.6 * fbm(x * 0.21, z * 0.21);
const topDepth = z => plateau(edgeX(z), z);
const wallX = (d, z) => edgeX(z) + (4 * Math.sin(d * 0.017 + z * 0.013) + 3 * fbm(d * 0.04, z * 0.04) + 1.3 * fbm(d * 0.17, z * 0.17)) * clamp((d - topDepth(z)) / 12, 0, 1);
function pushOut(p, m) { // keep a point out of the rock
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
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
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
scene.add(hemi, sun, sun.target, torch, torch.target, diverLamp);

// ---------- geometry helpers ----------
const _e = new Euler(), _q = new Quaternion(), _v = new Vector3(), _v2 = new Vector3();
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) { _e.set(rx, ry, rz, 'XYZ'); return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(_e), new Vector3(sx, sy, sz)); }
const patchUV = i => [252 / 256, 1 - (i * 8 + 4) / 128];  // 0 white 1 black 2 fin 3 tail 4 belly 5 accent 6 main 7 glow
function part(g, { patch = null, m = null, w = 0, wFn = null, uvFn = null } = {}) {
  g = g.index ? g.toNonIndexed() : g;
  if (m) g.applyMatrix4(m);
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position, n = pos.count;
  if (patch !== null || uvFn || !g.attributes.uv) {
    const a = new Float32Array(n * 2), [pu, pv] = patchUV(patch ?? 6);
    for (let i = 0; i < n; i++) { if (uvFn) { const [u, v] = uvFn(pos.getX(i), pos.getY(i), pos.getZ(i)); a[i * 2] = u; a[i * 2 + 1] = v; } else { a[i * 2] = pu; a[i * 2 + 1] = pv; } }
    g.setAttribute('uv', new THREE.BufferAttribute(a, 2));
  }
  const aw = new Float32Array(n); for (let i = 0; i < n; i++) aw[i] = wFn ? wFn(pos.getX(i), pos.getY(i), pos.getZ(i)) : w;
  g.setAttribute('aW', new THREE.BufferAttribute(aw, 1));
  return g;
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
function loft(n, m, fx, fh, fw, fy = () => 0) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = fx(t), h = fh(t), w = fw(t), y0 = fy(t);
    for (let j = 0; j <= m; j++) { const th = j / m * Math.PI * 2; pos.push(x, y0 + Math.cos(th) * h, Math.sin(th) * w); uv.push(t * 0.96, j / m); }
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
    if (white) P.push(part(sphere(8), { patch: 0, m: M(x, y, s * z, 0, 0, 0, r) }));
    P.push(part(sphere(8), { patch: 1, m: M(x + r * 0.25, y, s * (z + r * (white ? 0.55 : 0.1)), 0, 0, 0, r * (white ? 0.6 : 1)) }));
  }
}
function pectorals(P, x, y, z, len, patch, down = 0.35) {
  const g = () => shape([0.04, 0, -0.05, 0, -0.1 * len, 0.16 * len]);
  P.push(part(g(), { patch, m: M(x, y, z, Math.PI / 2 + down, 0, 0) }));
  P.push(part(g(), { patch, m: M(x, y, -z, -(Math.PI / 2 + down), 0, 0) }));
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
    const wr = f.w || (H > 0.55 ? 0.32 : H < 0.22 ? 0.75 : 0.5);
    const prof = t => t < 0.3 ? Math.pow(Math.sin(t / 0.3 * Math.PI / 2), 0.6) : 1 - (1 - (rat ? 0.03 : 0.15)) * Math.pow((t - 0.3) / 0.7, rat ? 0.9 : 1.5);
    const hump = t => f.hump ? f.hump * 0.1 * H * Math.exp(-(((t - 0.1) / 0.1) ** 2)) : 0;
    const fh = t => H / 2 * prof(t) + hump(t) / 2, fy = t => hump(t) / 2, fw = t => Math.max(0.003, H / 2 * prof(t) * wr * (f.box ? 1.6 : 1));
    const tOf = x => clamp((0.5 - x) / (0.5 - x1), 0, 1), top = x => fy(tOf(x)) + fh(tOf(x)), bot = x => fy(tOf(x)) - fh(tOf(x));
    P.push(part(loft(22, 16, t => 0.5 - t * (0.5 - x1), fh, fw, fy)));
    if (!rat) P.push(part(tailShape(f.tail || 'fork', Math.max(0.09, H * 0.55)), { patch: 3 }));
    const d = f.dorsal;
    if (d === 'spiky') {
      for (let i = 0; i < 9; i++) { const x = 0.25 - i * 0.055; P.push(part(shape([x + 0.012, top(x) * 0.9, x - 0.012, top(x) * 0.9, x - 0.03, top(x) + H * 1.2]), { patch: i % 2 ? 4 : 5 })); }
      const fan = () => shape([0, 0, -0.32, 0.2, -0.42, 0.02, -0.34, -0.16]);
      P.push(part(fan(), { patch: 4, m: M(0.16, bot(0.16) * 0.3, fh(0.3) * wr * 0.8, 1.2, 0, -0.2) }), part(fan(), { patch: 4, m: M(0.16, bot(0.16) * 0.3, -fh(0.3) * wr * 0.8, -1.2, 0, -0.2) }));
    } else if (d === 'sail') P.push(part(shape([0.32, top(0.32) * 0.9, -0.26, top(-0.26) * 0.8, -0.1, top(0) + H * 1.6, 0.2, top(0) + H * 1.5]), { patch: 2 }));
    else if (d === 'tall') P.push(part(shape([0.3, top(0.3) * 0.9, 0.14, top(0.14) * 0.9, 0.2, top(0.2) + H * 1.3]), { patch: 2 }));
    else if (d === 'long') P.push(part(shape([0.36, top(0.36) * 0.9, 0.3, top(0.3) + H * 0.3, -0.26, top(-0.26) + H * 0.15, -0.28, top(-0.28) * 0.8]), { patch: 2 }));
    else if (d === 'streamer') P.push(part(shape([0.12, top(0.12) * 0.9, 0.02, top(0.02) * 0.9, -0.6, top(0) + H * 1.1]), { patch: 0 }), part(shape([0.12, bot(0.12) * 0.9, -0.2, bot(-0.2) * 0.8, -0.1, bot(0) - H * 0.5]), { patch: 5 }));
    else if (d === 'bat') P.push(part(shape([0.2, top(0.2) * 0.9, -0.26, top(-0.26) * 0.8, -0.2, top(0) + H * 0.9]), { patch: 2 }), part(shape([0.1, bot(0.1) * 0.9, -0.26, bot(-0.26) * 0.8, -0.2, bot(0) - H * 0.9]), { patch: 2 }));
    else if (!rat || f.blob) P.push(part(shape([0.12, top(0.12) * 0.9, -0.16, top(-0.16) * 0.85, -0.06, top(0) + H * (H > 0.6 ? 0.3 : 0.42)]), { patch: 2 }));
    if (H > 0.5 && !d) P.push(part(shape([0.04, bot(0.04) * 0.9, -0.22, bot(-0.22) * 0.85, -0.12, bot(0) - H * 0.3]), { patch: 2 }));
    if (d !== 'spiky') pectorals(P, 0.2, bot(0.2) * 0.35, fw(tOf(0.2)) * 0.9, Math.max(0.5, H * 1.4), 2, 0.9);
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
    P.push(part(loft(22, 16, t => 0.5 - t * (0.5 - x1), fh, fw)));
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
  turtle(sp) {
    const P = [];
    P.push(part(new THREE.SphereGeometry(1, 20, 14), { m: M(0, 0.03, 0, 0, 0, 0, 0.42, 0.14, 0.32) }));
    P.push(part(sphere(10), { patch: 2, m: M(0.47, 0.02, 0, 0, 0, 0, 0.11, 0.08, 0.08) }));
    eyes(P, 0.53, 0.04, 0.05, 0.015, false);
    for (const s of [-1, 1]) {
      P.push(part(sphere(10), { patch: 2, w: 1, m: M(0.2, -0.02, s * 0.36, 0, s * 0.5, 0, 0.1, 0.015, 0.22) }));
      P.push(part(sphere(8), { patch: 2, w: 2, m: M(-0.33, -0.02, s * 0.2, 0, -s * 0.4, 0, 0.09, 0.012, 0.1) }));
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
    return { P: [part(new THREE.ShapeGeometry(s), { uvFn: (x, y) => [clamp(x + 0.5, 0, 0.94), clamp(y / 0.66, 0, 1)] }), part(new THREE.CylinderGeometry(0.015, 0.02, 0.12, 5), { patch: 6, m: M(0, 0.06, 0) })], mode: 6, amp: 0.06, alphaTest: 0.5 };
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
  const cv = makeCanvas(), g = cv.getContext('2d'), f = sp.f || {}, [c0, c1, c2 = c1] = sp.c, W = 246, R = rng(hash(sp.id));
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
  if (sp.type === 'turtle') {
    g.fillStyle = c1; g.fillRect(0, 0, 248, 64); g.fillStyle = mix(sp.c[2], '#ffffff', 0.2); g.fillRect(0, 64, 248, 64);
    g.strokeStyle = c0; g.lineWidth = 2; for (let x = 0; x < 248; x += 30) for (let y = 4; y < 60; y += 20) { g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(x + 15 + Math.cos(a) * 13, y + 8 + Math.sin(a) * 9); } g.stroke(); }
    if (f.hawk) for (let i = 0; i < 80; i++) dot(R() * 248, R() * 60, 3, 'rgba(240,200,120,0.5)');
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
  // colour patches for eyes, fins, etc.
  const fin = f.finc || (sp.type === 'fish' && sp.c[2] ? mix(c0, c2, 0.4) : c0);
  ['#f4f4f0', '#0a0a0a', fin, f.tailc || fin, belly, c2, c0, '#ffffff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(248, i * 8, 8, 8); });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
function makeGlowTex(sp) {
  const cv = makeCanvas(), g = cv.getContext('2d'), s = sp.glow.s;
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#fff';
  if (s === 'belly') for (let x = 30; x < 200; x += 14) for (const y of [58, 70]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  if (s === 'red') { g.fillRect(20, 36, 16, 12); g.fillRect(20, 80, 16, 12); }
  if (s === 'body') { g.globalAlpha = 0.7; g.fillRect(0, 0, 248, 128); g.globalAlpha = 1; }
  if (s === 'ring') g.fillRect(0, 0, 248, 20);
  g.fillRect(248, 56, 8, 8); // glow patch
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

// ---------- per-species instanced meshes, animated in the vertex shader ----------
const MODE_GLSL = [
  '',
  // 1 fish: tail beat
  'float k = clamp(0.25 - position.x, 0.0, 0.8); transformed.z += sin(aPhase - position.x * 5.0) * uAmp * k * k * 4.0 + sin(aPhase) * uAmp * 0.06;',
  // 2 whale: vertical fluke beat
  'float k = clamp(0.1 - position.x, 0.0, 0.9); transformed.y += sin(aPhase - position.x * 4.0) * uAmp * k * k * 4.0;',
  // 3 ray: wing flap
  'transformed.y += sin(aPhase - abs(position.z) * 2.0) * uAmp * position.z * position.z * 4.0;',
  // 4 eel: whole-body wave
  'transformed.z += sin(aPhase - position.x * 12.0) * uAmp * (0.8 - position.x);',
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
  const mat = new THREE.MeshStandardMaterial({ map: makeTex(sp), roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, transparent: !!b.transparent, opacity: b.transparent || 1, depthWrite: !b.transparent, alphaTest: b.alphaTest || 0 });
  if (sp.glow) { mat.emissive = new Color(sp.glow.c); mat.emissiveMap = makeGlowTex(sp); mat.emissiveIntensity = 0; }
  const amp = b.amp || 0;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uAmp = { value: amp };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPhase;\nattribute float aW;\nuniform float uAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n{ ${MODE_GLSL[mode]} }`);
    caustify(sh);
  };
  mat.customProgramCacheKey = () => 'anim' + mode;
  let freq = FREQ[mode];
  if (mode === 1) freq = clamp(5 / Math.sqrt(sp.size), 2, 14);
  if (mode === 3) freq = sp.f?.sting ? 3 : 1.3;
  k = { sp, geo, mat, mode, freq, upright: UPRIGHT.has(sp.type) || !!sp.f?.garden, cap: 0, mesh: null, n: 0, list: [] };
  grow(k, 16); kinds.set(sp.id, k); return k;
}
function grow(k, cap) {
  if (k.mesh) { scene.remove(k.mesh); k.mesh.dispose(); }
  k.cap = cap; k.phase = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); k.phase.setUsage(THREE.DynamicDrawUsage);
  k.geo.setAttribute('aPhase', k.phase);
  k.mesh = new THREE.InstancedMesh(k.geo, k.mat, cap); k.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  k.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); k.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
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
  const m = new THREE.Mesh(g, rockMat); scene.add(m); return m;
}
function wallTile(kz, kd) {
  const N = 40, S = TILE / N, pos = [], col = [], idx = [], uv = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const z = kz * TILE + i * S, top = topDepth(z), d = Math.min(FLOOR, Math.max(kd * TILE + j * S, top));
    const rough = clamp((d - top) / 4, 0, 1) * (0.45 * vnoise(z * 0.6, d * 0.6) + 0.18 * vnoise(z * 2.2, d * 2.2));  // ledges & knobs
    const x = wallX(d, z) + rough;
    pos.push(x, -d, z); uv.push(z / 5, d / 5); const c = rockColor(x, d, z).multiplyScalar(0.85 + rough * 0.4); col.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + N + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return tileMesh(pos, col, idx, uv);
}
const SAND = new Color('#e6dcbc');
function plateauTile(kx, kz) {
  const N = 48, S = TILE / N, pos = [], col = [], idx = [], uv = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const z = kz * TILE + j * S, x = Math.min(kx * TILE + i * S, edgeX(z)), sand = fbm(x * 0.07, z * 0.07) - 0.1;
    // sand gets wave ripples; reef patches get lumpy coral rock
    const bump = sand > 0 ? 0.05 * Math.sin(x * 2.2 + z * 0.9 + vnoise(x * 0.3, z * 0.3) * 3) * smooth(0, 0.15, sand) : (0.35 * vnoise(x * 0.9, z * 0.9) + 0.15 * vnoise(x * 2.7, z * 2.7)) * smooth(0, 0.2, -sand);
    const d = plateau(x, z) - bump;
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

// ---------- surface, sun shafts, particles ----------
const surfTex = (() => { const cv = makeCanvas(256, 256), g = cv.getContext('2d'); g.fillStyle = '#9adcf0'; g.fillRect(0, 0, 256, 256); const R = rng(4); for (let i = 0; i < 70; i++) { const x = R() * 256, y = R() * 256, r = 10 + R() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const surface = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: surfTex, color: 0xdff6ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
surface.rotation.x = -Math.PI / 2; scene.add(surface);
const shaftTex = (() => { const cv = makeCanvas(4, 128), g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(cv); })();
const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfff8d8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, alphaMap: shaftTex, side: THREE.DoubleSide, fog: false });
const shaftGeo = new THREE.CylinderGeometry(1.2, 4, 70, 12, 1, true); shaftGeo.translate(0, -35, 0);
const shafts = Array.from({ length: 14 }, (_, i) => { const m = new THREE.Mesh(shaftGeo, shaftMat); m.userData.o = [h2(i, 1) * 90, h2(i, 2) * 90]; m.rotation.z = 0.18; m.rotation.x = 0.05; scene.add(m); return m; });
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
const haloS = points(1500, 0.6, 0xffffff, { colors: true, add: true }), haloL = points(400, 2.6, 0xffffff, { colors: true, add: true });

// ---------- diver: articulated model with neoprene, BCD, tank, regulator, hoses and flexing fins ----------
const diverModel = (() => {
  const grp = new THREE.Group(); grp.rotation.order = 'YZX';
  const grain = (() => { const cv = makeCanvas(128, 128), g = cv.getContext('2d'), R = rng(21); g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 2600; i++) { const v = 100 + R() * 60 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * 128, R() * 128, 1.5, 1.5); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t; })();
  const std = (color, rough, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const neo = std(0x121417, 0.85, { bumpMap: grain, bumpScale: 0.8 }), neoBlue = std(0x1d6fb8, 0.8, { bumpMap: grain, bumpScale: 0.8 });
  const bcd = std(0x24272c, 0.7, { bumpMap: grain, bumpScale: 0.4 }), web = std(0x0e0f11, 0.6), rubber = std(0x0b0c0e, 0.5), hoseMat = std(0x1a1b1e, 0.45);
  const tankMat = std(0xf2c418, 0.28, { metalness: 0.3 }), steel = std(0xd0d4d8, 0.22, { metalness: 0.95 }), skin = std(0xc99478, 0.6);
  const finMat = std(0x1668b0, 0.4, { side: THREE.DoubleSide }), finTip = std(0xf2d020, 0.4, { side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xaee4ff, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.4, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lens = std(0xfff6dd, 0.2, { emissive: 0xfff2cc, emissiveIntensity: 0 }), yellow = std(0xf2c418, 0.45);
  const add = (geo, mat, parent = grp, m = null) => { const o = new THREE.Mesh(geo, mat); if (m) o.applyMatrix4(m); parent.add(o); return o; };
  const capsule = (r, len) => { const g = new THREE.CapsuleGeometry(r, len, 6, 14); g.rotateZ(Math.PI / 2); return g; };  // along x
  const along = (from, to, r0, r1, mat, parent = grp) => { // tapered segment between two points
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
  add(new THREE.BoxGeometry(0.05, 0.03, 0.07), steel, grp, M(-0.12, -0.125, 0));   // belt buckle
  for (const s of [-1, 1]) { add(sphere(14), neo, grp, M(0.37, 0.0, s * 0.19, 0, 0, 0, 0.085)); add(new THREE.BoxGeometry(0.2, 0.012, 0.05), neoBlue, grp, M(0.3, 0.155, s * 0.1)); }
  // neck, head, hood, mask, regulator
  add(capsule(0.055, 0.08), neo, grp, M(0.49, 0.04, 0));
  const head = new THREE.Group(); head.position.set(0.61, 0.07, 0); head.rotation.z = -0.3; grp.add(head);
  add(sphere(20), neo, head, M(0, 0, 0, 0, 0, 0, 0.12, 0.115, 0.105));
  add(sphere(12), skin, head, M(0.085, -0.055, 0, 0, 0, 0, 0.04, 0.045, 0.065));
  add(new THREE.CylinderGeometry(0.068, 0.072, 0.05, 28), rubber, head, M(0.1, 0.015, 0, 0, 0, Math.PI / 2, 1, 1, 1.5));
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 28), glass, head, M(0.127, 0.015, 0, 0, 0, Math.PI / 2, 1, 1, 1.45));
  add(new THREE.TorusGeometry(0.108, 0.01, 6, 28), rubber, head, M(0.01, 0.02, 0, Math.PI / 2, 0, 0));
  add(new THREE.CylinderGeometry(0.03, 0.034, 0.07, 16), rubber, head, M(0.13, -0.075, 0.02, Math.PI / 2, 0, 0));
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), std(0x6a6f76, 0.4), head, M(0.16, -0.075, 0.02, 0, 0, Math.PI / 2));
  // tank with valve, first stage and bands
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.52, 28), tankMat, grp, M(0.0, 0.235, 0, 0, 0, Math.PI / 2));
  for (const x of [0.26, -0.26]) add(sphere(20), tankMat, grp, M(x, 0.235, 0, 0, 0, 0, 0.05, 0.09, 0.09));
  for (const x of [0.12, -0.1]) add(new THREE.CylinderGeometry(0.095, 0.095, 0.035, 28), web, grp, M(x, 0.235, 0, 0, 0, Math.PI / 2));
  add(new THREE.CylinderGeometry(0.022, 0.026, 0.07, 14), steel, grp, M(0.33, 0.235, 0, 0, 0, Math.PI / 2));
  add(new THREE.CylinderGeometry(0.032, 0.032, 0.07, 14), steel, grp, M(0.37, 0.24, 0, Math.PI / 2, 0, 0));
  add(new THREE.TorusGeometry(0.025, 0.007, 6, 14), rubber, grp, M(0.37, 0.28, 0, Math.PI / 2, 0, 0));
  hose([[0.37, 0.24, 0.035], [0.44, 0.2, 0.15], [0.56, 0.06, 0.15], [0.7, -0.03, 0.05], [0.73, -0.05, 0.02]], 0.011, hoseMat);           // regulator
  hose([[0.37, 0.24, -0.035], [0.43, 0.22, -0.17], [0.34, 0.08, -0.24], [0.22, -0.02, -0.21]], 0.014, std(0x3a3e44, 0.5));                // inflator
  hose([[0.36, 0.23, 0.04], [0.3, 0.14, 0.22], [0.1, -0.02, 0.24], [-0.02, -0.12, 0.2]], 0.01, hoseMat);                                   // gauge
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 24), rubber, grp, M(-0.04, -0.14, 0.19, 0.4, 0, 0));
  add(new THREE.CylinderGeometry(0.032, 0.032, 0.004, 24), std(0xe8eef2, 0.3, { emissive: 0x335544, emissiveIntensity: 0.2 }), grp, M(-0.04, -0.158, 0.197, 0.4, 0, 0));
  add(new THREE.CylinderGeometry(0.03, 0.034, 0.06, 14), yellow, grp, M(0.18, -0.14, 0.07, Math.PI / 2, 0, 0));    // octopus (spare regulator)
  // arms: left tucked under the chest, right holding the torch forward
  const arm = (s, elbow, hand) => {
    const sh = new Vector3(0.37, -0.02, s * 0.2), el = new Vector3(...elbow), wr = new Vector3(...hand);
    along(sh, el, 0.052, 0.045, neo); add(sphere(12), neo, grp, M(el.x, el.y, el.z, 0, 0, 0, 0.046));
    along(el, wr, 0.044, 0.036, neo); add(sphere(12), rubber, grp, M(wr.x + 0.035, wr.y, wr.z, 0, 0, 0, 0.05, 0.03, 0.042));
    return wr;
  };
  arm(-1, [0.3, -0.24, -0.2], [0.5, -0.2, -0.06]);
  const wr = arm(1, [0.52, -0.2, 0.26], [0.74, -0.16, 0.2]);
  add(new THREE.CylinderGeometry(0.026, 0.022, 0.17, 18), std(0x15171a, 0.35, { metalness: 0.4 }), grp, M(wr.x + 0.07, wr.y + 0.01, wr.z, 0, 0, -Math.PI / 2));
  const bulb = add(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 18), lens, grp, M(wr.x + 0.16, wr.y + 0.01, wr.z, 0, 0, -Math.PI / 2));
  // legs: hip → knee → ankle, each a pivot; fins flex in two parts
  const finShape = (w0, w1, len) => { const s = new THREE.Shape(); s.moveTo(0, -w0); s.lineTo(-len, -w1); s.quadraticCurveTo(-len - 0.03, 0, -len, w1); s.lineTo(0, w0); s.lineTo(0, -w0); const g = new THREE.ShapeGeometry(s); g.rotateX(Math.PI / 2); return g; };
  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(-0.33, -0.01, s * 0.085); grp.add(hip);
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
  return { grp, animate };
})();

// ---------- state ----------
const diver = { p: new Vector3(), v: new Vector3(), yaw: Math.PI, pitch: -0.15, kick: 0, breath: 0 };
const mobile = [];
let debugCam = null, site = null, pool = [], hosts = [], cells = new Map(), summoned = [], live = [], t = 0, firstPerson = false;
const keys = {};
const forward = (out = new Vector3()) => out.set(Math.cos(diver.pitch) * Math.cos(diver.yaw), Math.sin(diver.pitch), -Math.cos(diver.pitch) * Math.sin(diver.yaw));

function startDive(s) {
  site = s;
  pool = species.filter(sp => !sp.host);
  hosts = species.filter(sp => sp.host);
  cells = new Map(); summoned = [];
  diver.p.set(edgeX(0) + 7, -6, 0); diver.v.set(0, 0, 0); diver.yaw = Math.PI; diver.pitch = -0.15;
  $('site-name').textContent = `${s.name} · ${s.area}`;
  $('picker').hidden = true; $('hud').hidden = false; $('lookhint').hidden = false; closeCard();
  updateTiles(true);
  if (!startDive.seen) { startDive.seen = 1; $('help').hidden = false; }
}

// ---------- creatures ----------
const speedOf = sp => (SPEED[sp.type] ?? 0.5) * clamp(Math.sqrt(sp.size), 0.5, 3);
function density(sp, d) {
  if (d < sp.depth[0] || d > sp.depth[1]) return 0;
  const typ = sp.typ || sp.depth; return d >= typ[0] && d <= typ[1] ? 1 : 0.08;
}
function makeCreature(sp, p, extra) {
  const k = kindOf(sp);
  const c = { sp, kind: k, p: p.clone(), v: new Vector3(), q: new Quaternion(), yaw: Math.random() * 6.283, pitch: 0, size: sp.size * (0.85 + Math.random() * 0.3), ph: Math.random() * 10,
    fixed: sp.hab === 'benthic', home: p.clone(), tgt: p.clone(), next: sp.pred ? t + 5 + Math.random() * 40 : 0, flee: 0, full: 0, puff: 0, hide: 0, prey: null, leader: null, off: null, ...extra };
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
    let exp = sp.ab * dens * (site.featured[sp.id] || 1) * (mid > 200 ? 3 : 1);
    if (sp.hab === 'pelagic') exp *= K_PEL; else if (!reef) continue; else exp *= CORAL.has(sp.type) ? K_CORAL : K_REEF;
    const n = Math.floor(exp) + (r() < exp % 1 ? 1 : 0);
    for (let m = 0; m < n; m++) {
      let p, s = null;
      if (sp.hab === 'pelagic') p = new Vector3(x0 + r() * CELL, -clamp(d0 + r() * CELLY, Math.max(sp.depth[0], 0.5), sp.depth[1]), z0 + r() * CELL);
      else { s = findSurface(r, x0, d0, z0); if (!s) continue; p = s.p.clone(); if (sp.hab === 'reef') p.addScaledVector(s.n, 0.6 + r() * 4).add(_v.set(0, (r() - 0.5) * 2, (r() - 0.5) * 3)); }
      if (sp.hab !== 'benthic') { pushOut(p, 0.5); if (-p.y < sp.depth[0]) p.y = -Math.max(0.5, sp.depth[0]); }
      else if (s.n.x > 0) p.x -= 0.05;
      const lead = makeCreature(sp, p);
      if (s && sp.hab === 'benthic' && s.n.x > 0) { lead.yaw = 0; lead.q.setFromEuler(_e.set(0, 0, 0, 'YZX')); }
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
          if (sp.hab === 'benthic') { const pp = p.clone().add(s.n.x > 0 ? off.set(0, off.y, off.z) : off.set(off.x, 0, off.z)); if (s.n.y > 0) pp.y = -plateau(pp.x, pp.z); list.push(makeCreature(sp, pp)); }
          else list.push(makeCreature(sp, p.clone().add(off), { leader: lead, off }));
        }
      }
    }
  }
  return list;
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

let anyDead = false, lastCatchToast = -9;
function kill(c) { c.dead = true; anyDead = true; }
function toast(msg) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; $('toasts').prepend(el); setTimeout(() => el.remove(), 4500); while ($('toasts').children.length > 4) $('toasts').lastChild.remove(); }
const angLerp = (a, b, k) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
const _des = new Vector3(), _to = new Vector3(), UP = new Vector3(0, 1, 0);
function stepCreature(c, dt, dSpeed) {
  const sp = c.sp, dist = _to.subVectors(diver.p, c.p).length();
  if (c.fixed) {
    if (sp.mood === 'hide') { const near = dist < 3 + dSpeed * 1.5; c.hide = lerp(c.hide, near ? 1 : 0, Math.min(1, dt * (near ? 6 : 0.5))); }
    c.ph += dt * c.kind.freq; return;
  }
  const spd = speedOf(sp), up = c.kind.upright;
  let urgency = 1.5;
  _des.set(0, 0, 0);
  // reaction to the diver
  const mood = sp.mood || (['shark', 'whale', 'ray', 'turtle'].includes(sp.type) ? 'calm' : 'shy');
  if (mood === 'shy' && sp.type !== 'jelly' && sp.type !== 'siphonophore') { if (dist < 1.5 + c.size * 3 + dSpeed * 1.4) c.flee = t + 1.2; }
  else if (mood === 'puff') { const near = dist < 2.2 + dSpeed; c.puff = lerp(c.puff, near ? 1 : 0, Math.min(1, dt * (near ? 5 : 0.6))); }
  else if (mood === 'curious' && dist < 20) {
    if (dSpeed > 4 && dist < 6) c.flee = t + 1;
    else if (dSpeed < 2.5) { if (dist > 3 + c.size) _des.copy(_to).multiplyScalar(spd * 1.1 / dist); else _des.crossVectors(_to, UP).setLength(spd * 0.6); }
  } else if (mood === 'calm' && dist < c.size * 0.7 + 2) c.flee = t + 0.6;
  // predators hunt
  if (sp.pred && t > c.full && !c.leader) {
    if (!c.prey && t > c.next) {
      let best = null, bd = 18;
      for (const o of mobile) {
        if (o === c || o.dead || (o.sp.pred && o.size > c.size * 0.5)) continue;
        if (!['fish', 'squid', 'crust', 'cuttle'].includes(o.sp.type) || o.size > c.size * 0.35) continue;
        const dd = o.p.distanceTo(c.p); if (dd < bd) { bd = dd; best = o; }
      }
      if (best) { c.prey = best; c.chaseEnd = t + 8; } else c.next = t + 4 + Math.random() * 3;
    }
    if (c.prey) {
      const pr = c.prey;
      if (pr.dead || t > c.chaseEnd) { c.prey = null; c.next = t + 6; }
      else {
        _v2.subVectors(pr.p, c.p); const dd = _v2.length();
        _des.copy(_v2).multiplyScalar(spd * 3.5 / Math.max(dd, 0.01)); urgency = 4;
        pr.flee = t + 1; pr.fleeFrom = c;
        if (dd < c.size * 0.35 + pr.size * 0.5 + 0.1) {
          kill(pr); c.prey = null; c.full = t + 25 + Math.random() * 25;
          for (let i = 0; i < 25; i++) bitList.push({ p: pr.p.clone(), v: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.5), age: 0 });
          if (c.p.distanceTo(diver.p) < 35 && t > lastCatchToast + 3) lastCatchToast = t, toast(`${sp.type === 'shark' ? '🦈' : '🐟'} A ${sp.name.toLowerCase()} caught a ${pr.sp.name.toLowerCase()}!`);
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
      const L = c.leader; _v2.copy(c.off).applyAxisAngle(UP, L.yaw);
      _des.copy(L.p).add(_v2).add(_v.set(Math.sin(t * 0.7 + c.ph) * 0.3, Math.cos(t * 0.5 + c.ph) * 0.15, 0)).sub(c.p).multiplyScalar(1.4);
      if (_des.length() > spd * 2.5) _des.setLength(spd * 2.5);
    } else {
      if (c.leader) c.leader = null;
      if (t > c.next || c.p.distanceTo(c.tgt) < 0.8) {
        const R = Math.random;
        if (sp.hab === 'reef') c.tgt.copy(c.home).add(_v.set((R() - 0.5) * 12, (R() - 0.5) * 4, (R() - 0.5) * 12));
        else c.tgt.copy(c.p).add(_v.set((R() - 0.5) * 40, (R() - 0.5) * 8, (R() - 0.5) * 40));
        c.tgt.y = -clamp(-c.tgt.y, Math.max(sp.depth[0], 0.5), Math.min(sp.depth[1], FLOOR - 1));
        pushOut(c.tgt, 1 + c.size * 0.5); c.next = t + 4 + R() * 8;
      }
      _des.subVectors(c.tgt, c.p); if (_des.lengthSq() > 1e-6) _des.setLength(spd);
    }
  }
  c.v.lerp(_des, Math.min(1, dt * urgency));
  c.p.addScaledVector(c.v, dt);
  const d = -c.p.y; if (d < sp.depth[0] - 2) c.p.y = -(sp.depth[0] - 2); if (d > sp.depth[1] + 2) c.p.y = -(sp.depth[1] + 2);
  pushOut(c.p, 0.3 + c.size * 0.3);
  const sv = c.v.length();
  if (sv > 0.03) { c.yaw = angLerp(c.yaw, Math.atan2(-c.v.z, c.v.x), Math.min(1, dt * 4)); c.pitch = lerp(c.pitch, up ? 0 : clamp(Math.atan2(c.v.y, Math.hypot(c.v.x, c.v.z)), -0.6, 0.6), Math.min(1, dt * 3)); }
  c.q.setFromEuler(_e.set(0, c.yaw, c.pitch, 'YZX'));
  c.ph += dt * c.kind.freq * (0.5 + Math.min(3, sv / Math.max(0.05, spd)) * 0.6);
}

// ---------- diver ----------
function stepDiver(dt) {
  const f = forward(), r = _v2.set(Math.sin(diver.yaw), 0, Math.cos(diver.yaw));
  const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const lx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ly = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
  diver.yaw -= lx * dt * 1.8; diver.pitch = clamp(diver.pitch + ly * dt * 1.3, -1.45, 1.45);   // arrow keys look around
  const vt = (keys.Space ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
  const turbo = keys.ShiftLeft || keys.ShiftRight, depth = -diver.p.y;
  const max = turbo ? 12 + depth * 0.05 : 1.8;   // turbo scales with depth so the trenches are reachable
  _des.set(0, 0, 0).addScaledVector(f, fw).addScaledVector(r, st).add(_v.set(0, vt, 0));
  if (_des.lengthSq() > 0) _des.setLength(max);
  diver.v.lerp(_des, Math.min(1, dt * (turbo ? 3 : 2.2)));
  diver.p.addScaledVector(diver.v, dt);
  pushOut(diver.p, 0.9);
  diver.kick += dt * (1.5 + diver.v.length() * (turbo ? 0.3 : 2.5));
  if ((diver.breath -= dt) < 0 && depth > 1.5) { diver.breath = 3.5; for (let i = 0; i < 8; i++) bubbleList.push({ p: diver.p.clone().addScaledVector(f, 0.8).add(_v.set(0, 0.2, 0)), age: -i * 0.07, s: 0.5 + Math.random() }); }
}

// ---------- main loop ----------
const _mat = new Matrix4(), _pos = new Vector3(), _scl = new Vector3();
let last = performance.now(), hudT = 0, pickT = 0, aimed = null, fps = 60;
let frameMs = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const f0 = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now; fps = lerp(fps, 1 / Math.max(dt, 0.001), 0.05);
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
  mobile.length = 0; for (const c of live) if (!c.fixed) mobile.push(c);
  for (const c of live) stepCreature(c, dt, dSpeed);

  const depth = -diver.p.y, amb = ambient(depth), dark = 1 - amb;
  // camera
  const f = forward();
  diverModel.grp.visible = !firstPerson;
  if (firstPerson) camera.position.copy(diver.p).addScaledVector(f, 0.35).add(_v.set(0, 0.1, 0));
  else { camera.position.copy(diver.p).addScaledVector(f, -4.2).add(_v.set(0, 1.2, 0)); pushOut(camera.position, 0.3); }
  if (camera.position.y > -0.12) camera.position.y = -0.12;
  camera.lookAt(_v.copy(diver.p).addScaledVector(f, 8).add(_v2.set(0, 0.9, 0)));
  if (debugCam) { camera.position.copy(diver.p).add(debugCam.off); camera.lookAt(_v.copy(diver.p).add(debugCam.look || _v2.set(0, 0, 0))); }
  diverModel.grp.position.copy(diver.p);
  diverModel.grp.rotation.set(0, diver.yaw, diver.pitch);
  // light & water
  const camD = -camera.position.y, water = stops(WATER, camD);
  scene.background.set(water); scene.fog.color.set(water); scene.fog.density = 0.02 + 0.016 * (1 - ambient(camD));
  hemi.color.set(mix('#ffffff', water, 0.3)); hemi.groundColor.set(mix(water, '#000000', 0.6)); hemi.intensity = 0.04 + 1.0 * amb; scene.environmentIntensity = 0.02 + 0.9 * amb;
  sun.color.set(mix('#fff2dc', '#6fcbe6', clamp(depth / 40, 0, 1))); sun.intensity = 2.6 * amb;
  sun.position.copy(diver.p).add(_v.set(20, 60, 10)); sun.target.position.copy(diver.p);
  const torchK = clamp((dark - 0.35) / 0.4, 0, 1);
  torch.intensity = torchK * 45; torch.position.copy(diver.p).addScaledVector(f, 0.8); torch.target.position.copy(diver.p).addScaledVector(f, 20);
  diverLamp.intensity = torchK * 6; diverModel.animate(diver.kick, t, torchK); diverLamp.position.copy(camera.position);
  surface.position.set(diver.p.x, 0, diver.p.z); surfTex.offset.set(t * 0.01, t * 0.006); surface.visible = camD < 150;
  shafts.forEach(s => { s.visible = depth < 90; s.position.set(Math.floor(diver.p.x / 90) * 90 + s.userData.o[0] - 45, 0, Math.floor(diver.p.z / 90) * 90 + s.userData.o[1] - 45); });
  shaftMat.opacity = 0.07 * clamp(1 - depth / 80, 0, 1);
  floor.visible = depth > FLOOR - 400; floor.position.set(Math.round(diver.p.x / 50) * 50, -FLOOR, Math.round(diver.p.z / 50) * 50);

  // write instances (two passes: count, grow buffers, then fill)
  for (const k of kinds.values()) k.n = 0;
  const cam = camera.position;
  for (const c of live) if (c.p.distanceToSquared(cam) < 12000) c.kind.n++;
  for (const k of kinds.values()) { if (k.n > k.cap) { let cap = k.cap; while (cap < k.n) cap *= 2; grow(k, cap); } k.n = 0; }
  let hs = 0, hl = 0; const hsP = haloS.geometry.attributes.position.array, hsC = haloS.geometry.attributes.color.array, hlP = haloL.geometry.attributes.position.array, hlC = haloL.geometry.attributes.color.array;
  const glowK = clamp((depth - 60) / 250, 0, 1);
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
    } k.mesh.instanceColor.setXYZ(i, c.tint.r, c.tint.g, c.tint.b); k.phase.array[i] = c.ph; k.list[i] = c;
    if (c.sp.glow && glowK > 0 && d2 < 3600) {
      const col = _c.set(c.sp.glow.c).multiplyScalar(glowK * (0.6 + 0.4 * Math.sin(t * 2.5 + c.ph)));
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
    if (k.n) { k.mesh.instanceMatrix.needsUpdate = true; k.mesh.instanceColor.needsUpdate = true; k.phase.needsUpdate = true; }
    if (k.sp.glow) k.mat.emissiveIntensity = glowK * (k.sp.glow.s === 'ring' ? 0.6 + 0.8 * Math.max(0, Math.sin(t * 4)) : 1.2);
  }
  haloS.geometry.setDrawRange(0, hs); haloL.geometry.setDrawRange(0, hl);
  haloS.geometry.attributes.position.needsUpdate = haloS.geometry.attributes.color.needsUpdate = true;
  haloL.geometry.attributes.position.needsUpdate = haloL.geometry.attributes.color.needsUpdate = true;
  // marine snow wraps around the camera
  const sp = snow.geometry.attributes.position.array, ox = cam.x - 20, oy = cam.y - 20, oz = cam.z - 20;
  for (let i = 0; i < SNOW; i++) {
    const bx = snowBase[i * 3], by = snowBase[i * 3 + 1] - t * 0.08, bz = snowBase[i * 3 + 2];
    sp[i * 3] = ox + (((bx - ox) % 40) + 40) % 40; sp[i * 3 + 1] = oy + (((by - oy) % 40) + 40) % 40; sp[i * 3 + 2] = oz + (((bz - oz) % 40) + 40) % 40;
  }
  snow.geometry.attributes.position.needsUpdate = true; snow.material.opacity = 0.2 + 0.4 * clamp(depth / 150, 0, 1);
  // bubbles & bits
  const bp = bubbles.geometry.attributes.position.array; let bn = 0;
  for (const b of bubbleList) { b.age += dt; if (b.age > 0) { b.p.y += dt * (0.8 + b.s * 0.3); b.p.x += Math.sin(b.age * 6 + b.s * 9) * dt * 0.2; } }
  for (let i = bubbleList.length - 1; i >= 0; i--) if (bubbleList[i].p.y > -0.1 || bubbleList[i].age > 14) bubbleList.splice(i, 1);
  for (const b of bubbleList) if (b.age > 0 && bn < 200) { bp[bn * 3] = b.p.x; bp[bn * 3 + 1] = b.p.y; bp[bn * 3 + 2] = b.p.z; bn++; }
  bubbles.geometry.setDrawRange(0, bn); bubbles.geometry.attributes.position.needsUpdate = true;
  const tp = bits.geometry.attributes.position.array; let tn = 0;
  for (const b of bitList) { b.age += dt; b.p.addScaledVector(b.v, dt); b.v.multiplyScalar(0.96); }
  for (let i = bitList.length - 1; i >= 0; i--) if (bitList[i].age > 1.5) bitList.splice(i, 1);
  for (const b of bitList) if (tn < 200) { tp[tn * 3] = b.p.x; tp[tn * 3 + 1] = b.p.y; tp[tn * 3 + 2] = b.p.z; tn++; }
  bits.geometry.setDrawRange(0, tn); bits.geometry.attributes.position.needsUpdate = true;

  CAUST.uTime.value = t;
  renderer.render(scene, camera);

  frameMs = lerp(frameMs, performance.now() - f0, 0.05);
  if ((hudT -= dt) < 0) { hudT = 0.1; updateHud(); }
  if ((pickT -= dt) < 0) { pickT = 0.12; aimed = pick(); const lab = $('aim'); if (aimed) { lab.textContent = `${aimed.sp.name} · ${aimed.p.distanceTo(diver.p).toFixed(0)} m`; lab.hidden = false; } else lab.hidden = true; }
}

// ---------- picking: what is the crosshair (or mouse) pointing at? ----------
const ray = new THREE.Raycaster();
let mouseNDC = null;
function pick() {
  ray.setFromCamera(mouseNDC || { x: 0, y: 0 }, camera);
  ray.far = 60;
  const hit = ray.intersectObjects([...tiles.values()], false)[0], maxD = hit ? hit.distance : 60;
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
  return b.join(' · ');
}
const whereText = sp => sp.range || (sp.regions === 'all' ? 'Widespread, including the Maldives' : sp.regions.map(r => REGION[r]).join(', '));
function fillCard(prefix, sp) {
  const [label, col] = IUCN[sp.iucn], typ = sp.typ, fmt = n => n.toLocaleString();
  $(prefix + 'kind').textContent = sp.kind || (CORAL.has(sp.type) ? 'Coral' : KIND[sp.type]);
  $(prefix + 'name').textContent = sp.name; $(prefix + 'sci').textContent = sp.sci;
  $(prefix + 'status').textContent = label; $(prefix + 'status').style.background = col;
  $(prefix + 'native').textContent = isNative(sp) ? 'Native to the Maldives' : 'Not found in the Maldives';
  $(prefix + 'native').className = 'tag ' + (isNative(sp) ? 'yes' : 'no');
  $(prefix + 'depth').textContent = `${fmt(sp.depth[0])}–${fmt(sp.depth[1])} m` + (typ ? ` (usually ${fmt(typ[0])}–${fmt(typ[1])} m)` : '');
  $(prefix + 'size').textContent = sp.sizeTxt || (sp.size < 1 ? `~${Math.round(sp.size * 100)} cm` : `~${sp.size} m`);
  $(prefix + 'where').textContent = whereText(sp);
  $(prefix + 'behave').textContent = behaviour(sp);
  $(prefix + 'fact').textContent = sp.fact;
}
let cardSp = null;
function openCard(c) {
  cardSp = c.sp; fillCard('card-', c.sp);
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
    toast(`Dived to ${Math.round(d).toLocaleString()} m — where the ${sp.name.toLowerCase()} lives`);
  }
  const f = forward(), d = -diver.p.y;
  if (sp.hab === 'benthic') {
    const z = diver.p.z;
    let p;
    if (d > topDepth(z) + 0.5) { const dd = clamp(d, sp.depth[0], sp.depth[1]); p = new Vector3(wallX(dd, z) - 0.05, -dd, z); diver.p.set(p.x + 4, p.y + 0.8, z); diver.yaw = Math.PI; diver.pitch = -0.1; }
    else { const px = Math.min(diver.p.x - 3, edgeX(z) - 3); p = new Vector3(px, -plateau(px, z), z); }
    const n = sp.school ? sp.school[0] : 1;
    for (let i = 0; i < n; i++) summoned.push(makeCreature(sp, p.clone().add(_v.set(0, i ? (Math.random() - 0.5) * 2 : 0, i ? (Math.random() - 0.5) * 3 : 0)), { yaw: 0 }));
  } else {
    const p = diver.p.clone().addScaledVector(f, Math.max(4, sp.size * 1.2 + 3)); pushOut(p, 0.5);
    const lead = makeCreature(sp, p); summoned.push(lead);
    const n = sp.school ? Math.min(sp.school[1], 14) - 1 : 0, spread = Math.max(0.6, sp.size * 4);
    for (let i = 0; i < n; i++) { const off = new Vector3((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 2); summoned.push(makeCreature(sp, p.clone().add(off), { leader: lead, off })); }
  }
  toast(`${sp.name} is here — look ahead`);
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
    if (q && !(sp.name + ' ' + sp.sci).toLowerCase().includes(q)) return false;
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
    li.querySelector('b').textContent = sp.name; li.querySelector('i').textContent = sp.sci;
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

// ---------- input ----------
const uiOpen = () => !$('guide').hidden || !$('help').hidden || !$('picker').hidden;
let locked = false, lockFailed = false, drag = null;
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; $('lookhint').hidden = locked || !site; if (locked) mouseNDC = null; });
document.addEventListener('pointerlockerror', () => { lockFailed = true; });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') { if (e.code === 'Escape') $('guide').hidden = true; return; }
  if (e.code === 'Escape') { $('guide').hidden = true; $('help').hidden = true; closeCard(); return; }
  if (!site) return;
  if (e.code === 'KeyG') { e.preventDefault(); $('guide').hidden ? openGuide() : ($('guide').hidden = true); return; }
  if (e.code === 'KeyH') { $('help').hidden = !$('help').hidden; return; }
  if (e.code === 'KeyV') { firstPerson = !firstPerson; return; }
  if (e.code === 'KeyE') { const c = pick(); if (c) openCard(c); return; }
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const look = (dx, dy) => { diver.yaw -= dx * 0.0025; diver.pitch = clamp(diver.pitch - dy * 0.0025, -1.45, 1.45); };
canvas.addEventListener('mousedown', e => { drag = { moved: 0 }; });
addEventListener('mouseup', () => {
  if (!drag) return; const wasClick = drag.moved < 5; drag = null;
  if (!wasClick || !site || uiOpen()) return;
  const c = pick(); if (c) { openCard(c); return; }
  if (!locked && !lockFailed && $('card').hidden) { try { canvas.requestPointerLock?.()?.catch?.(() => { lockFailed = true; }); } catch { lockFailed = true; } }
});
addEventListener('mousemove', e => {
  if (locked) { look(e.movementX, e.movementY); return; }
  if (e.target === canvas) mouseNDC = { x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 };
  if (drag) { drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY); look(e.movementX, e.movementY); }
});
$('help-close').onclick = () => { $('help').hidden = true; };
$('open-help').onclick = () => { $('help').hidden = false; };
$('change-site').onclick = () => { site = null; $('hud').hidden = true; closeCard(); $('guide').hidden = true; $('picker').hidden = false; document.exitPointerLock?.(); };

// ---------- site picker ----------
for (const s of sites) {
  const el = document.createElement('button'); el.className = 'site';
  const stars = Object.entries(s.featured).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => SP[id].name);
  el.innerHTML = '<b></b><small></small><p></p><em></em><span class="go">Dive here →</span>';
  el.querySelector('b').textContent = s.name; el.querySelector('small').textContent = s.area;
  el.querySelector('p').textContent = s.desc; el.querySelector('em').textContent = 'Look for: ' + stars.join(', ');
  el.onclick = () => startDive(s); $('sites').appendChild(el);
}
$('species-count').textContent = species.length;
$('loading').hidden = true; $('picker').hidden = false;
window.scuba = { CAUST, frameMs: () => frameMs, setCam: c => { debugCam = c; }, diver, startDive, sites, summon, SP, live: () => live, kinds, fps: () => fps, keys }; // debug handle
requestAnimationFrame(frame);
})();
