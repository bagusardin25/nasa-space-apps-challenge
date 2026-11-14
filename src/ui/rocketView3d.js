// 3D "launch stack" view for the design room: the chosen rocket with a see-through fairing and the
// spacecraft the team designed inside it. Built from Three.js primitives only (no model files),
// using the same launcher proportions as the flight view.
// The dashboard is rebuilt as HTML on every change, so one WebGL view is kept alive here and
// re-attached to the fresh slot element after each re-render.
import { loadThree, ROCKETS } from './flightCanvas.js';

const FOV = 26;
const TAN = Math.tan((FOV / 2) * (Math.PI / 180));
/** Stylized spacecraft sizes [width, height] in scene units. Relative sizes are what matter. */
const SAT_SIZE = { cube6u: [0.2, 0.3], cube12u: [0.26, 0.34], smallsat: [0.46, 0.54], medium: [0.82, 1.08] };
const LENS = { thermal: 0xd98a5f, multispectral: 0x8fbfa6, optical: 0x9fb7c9, 'ir-spectro': 0xd6bf7c };
const LABEL_KEYS = ['fairing', 'payload', 'upper', 'first', 'boost', 'others'];

let view = null;
let building = false;
let failed = false;
let wanted = false;
let latest = null;
let failHandler = null;
/** View the player picked with the buttons in the 3D view; null follows the open design tab. */
let userFocus = null;

/** Called once if Three.js or WebGL is not available, so the page can fall back to the schematic. */
export function onRocketViewFail(fn) {
  failHandler = fn;
}

/** Show `stack` (from launchStack) inside `slot`. Call again after every re-render of the page. */
export function syncRocketView(slot, stack, focus) {
  if (failed || !slot) {
    detachRocketView();
    return;
  }
  wanted = true;
  latest = { stack, focus };
  if (view) {
    view.attach(slot);
    view.apply(stack, focus);
    return;
  }
  if (building) return;
  building = true;
  loadThree().then((THREE) => {
    building = false;
    if (!wanted) return;
    view = createView(THREE);
    const slotNow = document.querySelector('[data-rocket-slot]');
    if (slotNow && latest) {
      view.attach(slotNow);
      view.apply(latest.stack, latest.focus);
    }
  }).catch(() => {
    building = false;
    failed = true;
    failHandler?.();
  });
}

export function detachRocketView() {
  view?.detach();
}

/** Frees the WebGL context (called when leaving the design room, before the flight view starts). */
export function disposeRocketView() {
  wanted = false;
  userFocus = null;
  view?.dispose();
  view = null;
}

function createView(THREE) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrap = document.createElement('div');
  wrap.className = 'rk3d-view';
  wrap.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  const labelLayer = document.createElement('div');
  labelLayer.className = 'rk3d-labels';
  const hint = document.createElement('span');
  hint.className = 'rk3d-hint';
  // Buttons to look at the whole rocket or at the spacecraft inside the fairing.
  const modes = document.createElement('div');
  modes.className = 'rk3d-modes';
  const modeBtns = {};
  for (const id of ['rocket', 'payload']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rk3d-mode';
    b.addEventListener('click', () => {
      userFocus = id;
      if (latest) apply(latest.stack, latest.focus);
    });
    modes.append(b);
    modeBtns[id] = b;
  }
  wrap.append(canvas, labelLayer, hint, modes);
  const labelEls = {};
  for (const key of LABEL_KEYS) {
    const el = document.createElement('span');
    el.className = 'rk3d-label';
    el.hidden = true;
    labelLayer.append(el);
    labelEls[key] = el;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
  // A small studio (dark room, bright soft boxes) baked into an environment map, so metal parts
  // such as the gold foil and the engine bells pick up reflections instead of looking flat.
  {
    const studio = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12), new THREE.MeshBasicMaterial({ color: 0x23262d, side: THREE.BackSide }));
    studio.add(room);
    const panel = (x, y, z, sx, sy, sz, level) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color: new THREE.Color(level, level, level * 1.04) }));
      m.position.set(x, y, z);
      studio.add(m);
    };
    panel(0, 22, 0, 26, 1, 26, 7);
    panel(20, 6, 12, 1, 18, 14, 5);
    panel(-20, 4, -8, 1, 14, 12, 3);
    panel(0, 4, 24, 16, 12, 1, 3.5);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(studio, 0.03).texture;
    pmrem.dispose();
    studio.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }
  scene.add(new THREE.HemisphereLight(0xeef1f6, 0x2a2c31, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(5, 8, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc6d4ea, 1.3);
  rim.position.set(-7, 5, -6);
  scene.add(rim);
  const turntable = new THREE.Group();
  scene.add(turntable);

  // ---------- small helpers ----------
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o });
  const cyl = (rt, rb, h, seg = 40, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  /** Tangent-ogive nose profile as [radius, height] points, base radius r, length len. */
  const ogivePts = (r, len, n = 18) => {
    const rho = (r * r + len * len) / (2 * r);
    return Array.from({ length: n + 1 }, (_, i) => {
      const x = (len * i) / n;
      return new THREE.Vector2(Math.max(0.0001, Math.sqrt(rho * rho - x * x) + r - rho), x);
    });
  };
  const disposeTree = (root) => root.traverse((o) => {
    o.geometry?.dispose();
    if (Array.isArray(o.material)) o.material.forEach((mm) => mm.dispose());
    else o.material?.dispose();
  });

  // Launch pad, so the rocket does not float.
  const pad = new THREE.Group();
  add(cyl(2.7, 2.9, 0.18, 56), std(0x1c1e22, { roughness: 0.9 }), pad, 0, -1.3, 0);
  const padRing = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2) * 2.7, -1.2, Math.sin((i / 64) * Math.PI * 2) * 2.7))),
    new THREE.LineBasicMaterial({ color: 0x6c7179, transparent: true, opacity: 0.7 }),
  );
  pad.add(padRing);
  scene.add(pad);

  // ---------- rocket ----------
  function buildRocket(R, ghost) {
    const g = new THREE.Group();
    // Parts that do not turn with the rocket: the cut-away fairing always opens toward the camera.
    const fixed = new THREE.Group();
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8f8a80, transparent: true, opacity: 0.13, depthWrite: false });
    const M = ghost ? () => ghostMat : std;
    const hull = M(R.dark ? 0x40444d : 0xe6e2d8, { roughness: 0.5 });
    const band = M(0x1d1f24, { roughness: 0.5, metalness: 0.4 });
    const metal = M(0x5b606a, { roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide });
    const finMat = M(R.dark ? 0x565b66 : 0x2f343d, { roughness: 0.5, metalness: 0.3 });
    const bell = (rt, re, len) => new THREE.LatheGeometry(
      Array.from({ length: 11 }, (_, i) => new THREE.Vector2(rt + (re - rt) * (i / 10) ** 0.6, -len * (i / 10))), 28);

    // Core: first stage, interstage band, upper stage.
    const s1 = R.body * 0.64;
    const s2 = R.body - s1 - 0.3;
    add(cyl(R.r, R.r, s1), hull, g, 0, s1 / 2);
    add(cyl(R.r * 1.012, R.r * 1.012, 0.3), band, g, 0, s1 + 0.15);
    add(cyl(R.r, R.r, s2), hull, g, 0, s1 + 0.3 + s2 / 2);
    add(cyl(R.r * 1.02, R.r * 1.08, 0.5), band, g, 0, 0.12);
    add(bell(R.r * 0.24, R.r * 0.68, R.r * 1.4), metal, g, 0, -0.12);

    const finShape = new THREE.Shape();
    const span = R.r * 1.15;
    finShape.moveTo(0, 1.9);
    finShape.lineTo(0, 0);
    finShape.lineTo(span, -0.12);
    finShape.lineTo(span, 0.6);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.07, bevelEnabled: false }).translate(0, 0, -0.035);
    const fins = (parent, angles) => {
      for (const a of angles) {
        const pivot = new THREE.Group();
        pivot.rotation.y = a;
        parent.add(pivot);
        add(finGeo, finMat, pivot, R.r * 0.96, 0.05, 0);
      }
    };
    if (!R.sideCores) fins(g, [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2));

    // Payload fairing: drawn as glass so the spacecraft inside stays visible.
    const y0 = R.body + 0.35;
    const fairCyl = R.fair * 0.45;
    add(cyl(R.fairR, R.r, 0.35, 40, true), hull, g, 0, R.body + 0.175);
    const glass = ghost ? ghostMat : new THREE.MeshStandardMaterial({
      color: 0xe6e2d8, transparent: true, opacity: 0.2, roughness: 0.25, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    if (ghost) {
      add(cyl(R.fairR, R.fairR, fairCyl, 48, true), glass, g, 0, y0 + fairCyl / 2).renderOrder = 2;
      add(new THREE.LatheGeometry(ogivePts(R.fairR, R.fair - fairCyl), 48), glass, g, 0, y0 + fairCyl).renderOrder = 2;
    } else {
      // Cut-away: the far half shell is solid, the near half is faint glass, so the payload is in plain view.
      const inside = std(R.dark ? 0x565b66 : 0xcfcbc1, { roughness: 0.8, side: THREE.DoubleSide });
      glass.opacity = 0.07;
      const pts = ogivePts(R.fairR, R.fair - fairCyl);
      for (const [mat, start, order] of [[inside, Math.PI / 2, 0], [glass, -Math.PI / 2, 2]]) {
        add(new THREE.CylinderGeometry(R.fairR, R.fairR, fairCyl, 32, 1, true, start, Math.PI), mat, fixed, 0, y0 + fairCyl / 2).renderOrder = order;
        add(new THREE.LatheGeometry(pts, 32, start, Math.PI), mat, fixed, 0, y0 + fairCyl).renderOrder = order;
      }
    }
    const lineMat = new THREE.LineBasicMaterial({ color: 0xece9e2, transparent: true, opacity: ghost ? 0.25 : 0.85 });
    const circle = (y) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 48 }, (_, i) => new THREE.Vector3(Math.cos((i / 48) * Math.PI * 2) * R.fairR * 1.003, y, Math.sin((i / 48) * Math.PI * 2) * R.fairR * 1.003))), lineMat);
    (ghost ? g : fixed).add(circle(y0), circle(y0 + fairCyl));
    // Two seams: a real fairing is two half shells that split apart in flight.
    const profile = [new THREE.Vector2(R.fairR, 0), ...ogivePts(R.fairR, R.fair - fairCyl).map((pt) => new THREE.Vector2(pt.x, pt.y + fairCyl))];
    for (const side of [1, -1]) {
      (ghost ? g : fixed).add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(profile.map((pt) => new THREE.Vector3(side * pt.x * 1.003, y0 + pt.y, 0))), lineMat));
    }

    // Strap-on boosters (medium launcher).
    for (let k = 0; k < R.strapons; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      const bg = new THREE.Group();
      bg.position.set(Math.cos(a) * (R.r + 0.21), 0, Math.sin(a) * (R.r + 0.21));
      g.add(bg);
      add(cyl(0.2, 0.2, 4.4, 20), hull, bg, 0, 2.4);
      add(new THREE.LatheGeometry(ogivePts(0.2, 0.75, 10), 20), hull, bg, 0, 4.6);
      add(cyl(0.21, 0.21, 0.3, 20), band, bg, 0, 0.35);
      add(bell(0.06, 0.15, 0.32), metal, bg, 0, 0.2);
    }
    // Side boosters (heavy launcher).
    for (let k = 0; k < R.sideCores; k++) {
      const side = k === 0 ? -1 : 1;
      const bg = new THREE.Group();
      bg.position.set(side * (2 * R.r + 0.1), 0, 0);
      g.add(bg);
      const len = R.body * 0.8;
      add(cyl(R.r, R.r, len, 36), hull, bg, 0, len / 2);
      add(cyl(R.r * 1.01, R.r * 1.01, 0.4, 36), band, bg, 0, len * 0.7);
      add(new THREE.LatheGeometry(ogivePts(R.r, 1.6, 12), 36), hull, bg, 0, len);
      add(cyl(R.r * 1.02, R.r * 1.08, 0.5, 36), band, bg, 0, 0.12);
      add(bell(R.r * 0.2, R.r * 0.6, R.r * 1.3), metal, bg, 0, -0.12);
      fins(bg, [Math.PI / 2, -Math.PI / 2]);
    }
    const halfWidth = R.sideCores ? 3 * R.r + 0.1 : R.strapons ? R.r + 0.45 : R.r * 2.2;
    /** Fairing radius at height y (cylinder below, ogive above). */
    const fairingRadius = (y) => {
      const x = y - (y0 + fairCyl);
      if (x <= 0) return R.fairR;
      const len = R.fair - fairCyl;
      if (x >= len) return 0;
      const rho = (R.fairR * R.fairR + len * len) / (2 * R.fairR);
      return Math.sqrt(rho * rho - x * x) + R.fairR - rho;
    };
    return { group: g, fixed, y0, top: y0 + R.fair, halfWidth, fairingRadius };
  }

  // ---------- spacecraft (stowed for launch) ----------
  function buildSat(S, alarm) {
    const g = new THREE.Group();
    const [w, h] = SAT_SIZE[S.bus] ?? SAT_SIZE.smallsat;
    const glow = alarm ? { emissive: 0xc0271c, emissiveIntensity: 0.6 } : {};
    const foil = std(0xd9a441, { metalness: 0.85, roughness: 0.32, ...glow });
    const cell = std(0x2f55a0, { metalness: 0.4, roughness: 0.3, ...glow });
    const lift = S.thruster ? w * 0.22 : 0.03;
    const bus = add(box(w, h, w), foil, g, 0, lift + h / 2, 0);
    // A bright outline so your spacecraft stands out from the rocket and the other payloads.
    bus.add(new THREE.LineSegments(new THREE.EdgesGeometry(box(w * 1.004, h * 1.004, w * 1.004)),
      new THREE.LineBasicMaterial({ color: alarm ? 0xff6a5c : 0xffe2a3, transparent: true, opacity: 0.9 })));
    if (S.solar === 'wings') {
      // Folded wings: two stacked panels against each side.
      for (const side of [-1, 1]) for (const layer of [0, 1]) add(box(0.022, h * 0.9, w * 0.9), cell, g, side * (w / 2 + 0.02 + layer * 0.03), lift + h / 2, 0);
    } else if (S.solar === 'body') {
      for (const side of [-1, 1]) {
        add(box(w * 0.84, h * 0.84, 0.012), cell, g, 0, lift + h / 2, side * (w / 2 + 0.007));
        add(box(0.012, h * 0.84, w * 0.84), cell, g, side * (w / 2 + 0.007), lift + h / 2, 0);
      }
    }
    let topExtra = 0;
    const n = Math.min(S.instruments.length, 5);
    S.instruments.slice(0, n).forEach((inst, i) => {
      const r = inst.size === 'L' ? w * 0.2 : inst.size === 'M' ? w * 0.15 : w * 0.11;
      const len = r * 2.2;
      const x = n === 1 ? 0 : (i / (n - 1) - 0.5) * w * 0.62;
      const z = n > 3 ? (i % 2 ? 1 : -1) * w * 0.18 : 0;
      add(cyl(r, r, len, 24), std(LENS[inst.cap] ?? 0xb3a6cf, { roughness: 0.45, metalness: 0.2, ...glow }), g, x, lift + h + len / 2, z);
      topExtra = Math.max(topExtra, len);
    });
    if (S.antenna === 'dish') {
      const dish = add(cyl(w * 0.26, w * 0.04, w * 0.13, 24, true), std(0xd9d5cb, { side: THREE.DoubleSide, roughness: 0.4 }), g, 0, lift + h * 0.6, w / 2 + w * 0.09);
      dish.rotation.x = Math.PI / 2;
    } else if (S.antenna === 'whip') {
      add(cyl(0.008, 0.008, h * 0.5, 8), std(0xd9d5cb), g, w * 0.38, lift + h + h * 0.25, -w * 0.38);
      topExtra = Math.max(topExtra, h * 0.5);
    }
    if (S.thruster) {
      add(cyl(w * 0.07, w * 0.15, w * 0.2, 20, true), std(0x9a5a34, { side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 }), g, 0, lift - w * 0.1, 0);
    }
    return { group: g, h: lift + h + topExtra, r: (w / 2) * 1.42 + (S.solar === 'wings' ? 0.06 : 0.02) };
  }

  function buildPayload(stack, R, y0) {
    const g = new THREE.Group();
    const inner = R.fairR * 0.84;
    const darkMat = std(0x2b2f35, { metalness: 0.5 });
    add(cyl(R.fairR * 0.5, R.fairR * 0.82, 0.14, 32), darkMat, g, 0, y0 + 0.07);
    let base = y0 + 0.14;
    if (stack.rideshare) {
      // Other customers' payloads share the ring below yours.
      const other = std(0x4b4f58, { transparent: true, opacity: 0.55, roughness: 0.8 });
      for (let k = 0; k < 5; k++) {
        const a = (k * Math.PI * 2) / 5;
        const b = add(box(0.26, 0.3, 0.26), other, g, Math.cos(a) * inner * 0.62, base + 0.15, Math.sin(a) * inner * 0.62);
        b.rotation.y = -a;
      }
      add(cyl(inner * 0.92, inner * 0.92, 0.03, 32), darkMat, g, 0, base + 0.36);
      base += 0.39;
    }
    if (!stack.sat) {
      // Nothing designed yet: a dashed outline marks the empty payload space.
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box(0.46, 0.54, 0.46)), new THREE.LineDashedMaterial({ color: 0x8f8a80, dashSize: 0.06, gapSize: 0.05 }));
      edges.computeLineDistances();
      edges.position.set(0, base + 0.27, 0);
      g.add(edges);
      return { group: g, centerY: base + 0.27, height: 0.54, radius: 0.33 };
    }
    const proto = buildSat(stack.sat, stack.alarm);
    const n = stack.count;
    const fit = inner / proto.r;
    const per = n === 1 ? 1 : fit >= 2.45 ? Math.min(4, n) : fit >= 2.05 ? 2 : 1;
    const ringR = per === 1 ? 0 : per === 2 ? proto.r * 1.02 : proto.r * 1.45;
    const pitch = proto.h + 0.07;
    const tiers = Math.ceil(n / per);
    const stackG = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const tier = Math.floor(i / per);
      const inTier = Math.min(per, n - tier * per);
      const a = inTier === 1 ? 0 : ((i % per) * Math.PI * 2) / inTier + (tier % 2) * (Math.PI / inTier);
      const rr = inTier === 1 ? 0 : ringR;
      const s = i === 0 ? proto.group : proto.group.clone();
      s.position.set(Math.cos(a) * rr, tier * pitch, Math.sin(a) * rr);
      s.rotation.y = -a;
      stackG.add(s);
    }
    if (n > 1) add(cyl(0.035, 0.035, tiers * pitch, 12), darkMat, stackG, 0, (tiers * pitch) / 2, 0);
    const height = tiers * pitch - 0.07;
    const radius = (per === 1 ? 0 : ringR) + proto.r;
    // The game checks mass, not volume, so a stack that passes the mass check is drawn to fit.
    const usable = R.fair * 0.72 - (base - y0);
    const scale = stack.alarm ? 1 : Math.min(1, usable / height, inner / radius);
    stackG.scale.setScalar(scale);
    stackG.position.y = base;
    g.add(stackG);
    return { group: g, centerY: base + (height * scale) / 2, height: height * scale, radius: Math.max(0.14, radius * scale * 0.8) };
  }

  // ---------- state ----------
  let rocket = null;
  let payload = null;
  let rocketSig = '';
  let payloadSig = '';
  let anchors = {};
  let frameSpec = { cy: 6, half: 8, halfW: 2, el: 0.07 };
  const goal = { cy: 6, dist: 40, el: 0.07 };
  const cur = { cy: 6, dist: 40, el: 0.07 };
  let snap = true;
  let az = 0.7;
  let holdUntil = 0;
  let raf = 0;
  let last = 0;
  let visible = true;
  let w = 0;
  let h = 0;
  let focusMode = 'rocket';

  const swap = (part) => {
    if (!part) return;
    turntable.remove(part.group);
    disposeTree(part.group);
    if (part.fixed) {
      scene.remove(part.fixed);
      disposeTree(part.fixed);
    }
  };

  function reframe() {
    const aspect = w > 0 && h > 0 ? w / h : 1.15;
    goal.cy = frameSpec.cy;
    goal.el = frameSpec.el;
    goal.dist = Math.max(frameSpec.half / TAN, frameSpec.halfW / (TAN * aspect));
    if (snap || reduced) {
      Object.assign(cur, goal);
      snap = false;
    }
  }

  function apply(stack, focus) {
    const R = ROCKETS[stack.hostId] ?? ROCKETS['lv-mediumheavy'];
    const rSig = `${stack.hostId}|${stack.ghost}`;
    if (rSig !== rocketSig) {
      swap(rocket);
      rocket = buildRocket(R, stack.ghost);
      turntable.add(rocket.group);
      scene.add(rocket.fixed);
      rocketSig = rSig;
      payloadSig = '';
    }
    const pSig = JSON.stringify([stack.sat, stack.count, stack.rideshare, stack.alarm]);
    if (pSig !== payloadSig) {
      swap(payload);
      payload = buildPayload(stack, R, rocket.y0);
      turntable.add(payload.group);
      payloadSig = pSig;
    }
    if (userFocus) focus = userFocus;
    if (stack.ghost && !stack.sat) focus = 'rocket';
    focusMode = focus;
    modeBtns.rocket.textContent = stack.labels.viewRocket ?? 'Rocket';
    modeBtns.payload.textContent = stack.labels.viewPayload ?? 'Payload';
    for (const [id, b] of Object.entries(modeBtns)) {
      b.classList.toggle('is-on', id === focus);
      b.setAttribute('aria-pressed', String(id === focus));
    }
    // Close up, the fairing label sits above the payload so it never covers it.
    const fairY = focus === 'rocket' ? rocket.y0 + R.fair * 0.5
      : Math.min(rocket.top - 0.25, Math.max(rocket.y0 + R.fair * 0.5, payload.centerY + payload.height / 2 + 0.16));
    anchors = {
      fairing: { y: fairY, r: Math.max(0.05, rocket.fairingRadius(fairY)), side: 1 },
      payload: stack.sat ? { y: payload.centerY, r: payload.radius, side: -1 } : null,
      upper: { y: R.body * 0.84, r: R.r, side: 1 },
      first: { y: R.body * 0.34, r: R.r, side: 1 },
      boost: R.strapons ? { y: 3, r: R.r + 0.42, side: -1 } : R.sideCores ? { y: R.body * 0.42, r: R.r * 2.3, side: -1 } : null,
      others: stack.rideshare && focus === 'payload' ? { y: rocket.y0 + 0.3, r: R.fairR * 0.7, side: -1 } : null,
    };
    for (const k of LABEL_KEYS) labelEls[k].textContent = stack.labels[k] ?? '';
    hint.textContent = stack.labels.hint ?? '';
    frameSpec = focus === 'rocket'
      ? { cy: (rocket.top - 1.3) / 2, half: ((rocket.top + 1.3) / 2) * 1.08, halfW: rocket.halfWidth * 1.4, el: 0.07 }
      : { cy: payload.centerY, half: Math.max(payload.height * 1.3, R.fairR * 0.95), halfW: R.fairR * 1.04, el: 0.2 };
    reframe();
  }

  const v3 = new THREE.Vector3();
  function placeLabels() {
    const taken = { 1: [], '-1': [] };
    for (const k of LABEL_KEYS) {
      const el = labelEls[k];
      const a = anchors[k];
      let show = Boolean(a && el.textContent);
      let px = 0;
      let py = 0;
      if (show) {
        v3.set(a.side * a.r, a.y, 0).project(camera);
        px = (v3.x * 0.5 + 0.5) * w;
        py = (-v3.y * 0.5 + 0.5) * h;
        show = py > 14 && py < h - 14;
      }
      let toRight = true;
      if (show) {
        const est = el.textContent.length * 6.4 + 18;
        // Flip a label to the other side of its anchor when it would run off the edge.
        toRight = a.side > 0 ? px + 6 + est < w - 4 : !(px - 6 - est > 4);
        const lane = toRight ? 1 : -1;
        show = !taken[lane].some((y) => Math.abs(y - py) < 17);
        if (show) taken[lane].push(py);
      }
      if (show) {
        const pos = toRight ? `${(px + 6).toFixed(0)}px|auto` : `auto|${(w - px + 6).toFixed(0)}px`;
        const css = `${pos}|${py.toFixed(0)}px`;
        if (el.dataset.css !== css) {
          el.dataset.css = css;
          const [left, right] = pos.split('|');
          el.style.left = left;
          el.style.right = right;
          el.style.top = `${py.toFixed(0)}px`;
          el.classList.toggle('is-left', !toRight);
        }
      }
      if (el.hidden === show) el.hidden = !show;
    }
  }

  function resize() {
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (!cw || !ch || (cw === w && ch === h)) return;
    w = cw;
    h = ch;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    snap = true;
    reframe();
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (!visible || document.hidden || !w) return;
    if (!reduced && now > holdUntil) az += dt * (focusMode === 'rocket' ? 0.4 : 0.3);
    turntable.rotation.y = az;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
    cur.cy += (goal.cy - cur.cy) * k;
    cur.dist += (goal.dist - cur.dist) * k;
    cur.el += (goal.el - cur.el) * k;
    camera.position.set(0, cur.cy + cur.dist * Math.sin(cur.el), cur.dist * Math.cos(cur.el));
    camera.lookAt(0, cur.cy, 0);
    renderer.render(scene, camera);
    placeLabels();
  }

  // Drag sideways to turn the rocket.
  let dragX = null;
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragX = e.clientX;
    wrap.setPointerCapture(e.pointerId);
    wrap.classList.add('is-dragging');
  });
  wrap.addEventListener('pointermove', (e) => {
    if (dragX == null) return;
    az += (e.clientX - dragX) * 0.012;
    dragX = e.clientX;
    holdUntil = performance.now() + 4000;
  });
  const endDrag = () => {
    dragX = null;
    wrap.classList.remove('is-dragging');
  };
  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', endDrag);

  const ro = new ResizeObserver(resize);
  ro.observe(wrap);
  const io = new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; });
  io.observe(wrap);

  return {
    attach(slot) {
      if (wrap.parentNode !== slot) slot.replaceChildren(wrap);
      resize();
      if (!raf) raf = requestAnimationFrame(tick);
    },
    detach() {
      cancelAnimationFrame(raf);
      raf = 0;
      wrap.remove();
    },
    apply,
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      wrap.remove();
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
