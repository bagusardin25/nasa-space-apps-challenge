// Flight-phase renderer: a real-time 3D WebGL scene (Three.js) built only from procedural
// primitives, so there are no model files that could fail to load. Scenes: launch pad, cruise,
// Earth orbit, lunar orbit and the Sun–Earth L1 point (stylized, not to scale).
// Textures: NASA Blue Marble (GIBS WMS) and the NASA SVS CGI Moon Kit (LRO LROC).
// Three.js is imported lazily as a native ES module from a CDN (no build step). If it cannot
// load, or WebGL is unavailable, the Canvas 2D renderer in flightCanvas2d.js takes over.
import { tx as T } from '../i18n.js';
import { createFlightView2D, STATIONS, mulberry } from './flightCanvas2d.js';

const THREE_URLS = [
  'https://unpkg.com/three@0.160.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
];
// Live NASA GIBS WMS first; the bundled copy of the same image covers offline use or a GIBS outage.
const EARTH_TEXTURE = [
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_ShadedRelief_Bathymetry&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=1024&HEIGHT=512&FORMAT=image/jpeg',
  'assets/textures/earth-blue-marble-gibs-1k.jpg',
];
// NASA SVS CGI Moon Kit color map (svs.gsfc.nasa.gov/4720). Bundled because the SVS server only sends
// CORS headers for its own partner sites, and WebGL can only use cross-origin images that allow it.
const MOON_TEXTURE = ['assets/textures/moon-lroc-svs-1k.jpg'];

const D2R = Math.PI / 180;
const TAN_HALF_FOV = Math.tan(22.5 * D2R);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const damp = (dt, rate) => 1 - Math.exp(-rate * dt);

const images = {};
function loadImage(urls) {
  if (!images[urls[0]]) {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // WebGL needs CORS-clean pixels
    img.decoding = 'async';
    let i = 0;
    img.addEventListener('error', () => { if (++i < urls.length) img.src = urls[i]; });
    img.src = urls[0];
    images[urls[0]] = img;
  }
  return images[urls[0]];
}
const imageReady = (img) => img.complete && img.naturalWidth > 0;

let threeModule = null;
/** Imports Three.js once (falls back to a second CDN). Rejects when offline; a later call retries. */
export function loadThree() {
  if (!threeModule) {
    threeModule = (async () => {
      let lastErr;
      for (const url of THREE_URLS) {
        try { return await import(url); } catch (err) { lastErr = err; }
      }
      throw lastErr;
    })();
    threeModule.catch(() => { threeModule = null; });
  }
  return threeModule;
}

/** Warms the image cache and the Three.js module so the flight view starts instantly. */
export function preloadTextures() {
  loadImage(EARTH_TEXTURE);
  loadImage(MOON_TEXTURE);
  loadThree().catch(() => {});
}

/** Creates the flight view on `canvas`. Returns { setScene(name), setLost(), flash(kind), destroy() }. */
export function createFlightView(canvas, opts) {
  const state = { scene: 'countdown', since: performance.now(), lost: false };
  const textures = { earth: loadImage(EARTH_TEXTURE), moon: loadImage(MOON_TEXTURE) };
  let impl = null;
  let destroyed = false;
  const start = (view) => {
    impl = view;
    if (state.scene !== 'countdown') impl.setScene(state.scene);
    if (state.lost) impl.setLost();
  };
  const fallback = (target, err) => {
    console.warn('GO/NO-GO: 3D flight view unavailable, using the 2D view.', err);
    start(createFlightView2D(target, opts, textures));
  };
  loadThree().then((THREE) => {
    if (destroyed) return;
    let view;
    try {
      view = createFlightView3D(THREE, canvas, opts, textures, state);
    } catch (err) {
      // A failed WebGL attempt can leave the canvas bound to a context, so 2D gets a fresh copy.
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      fallback(fresh, err);
      return;
    }
    start(view);
  }, (err) => { if (!destroyed) fallback(canvas, err); });

  return {
    setScene(name) {
      state.scene = name;
      state.since = performance.now();
      impl?.setScene(name);
    },
    setLost() {
      state.lost = true;
      impl?.setLost();
    },
    flash(kind) {
      impl?.flash(kind);
    },
    destroy() {
      destroyed = true;
      impl?.destroy();
      impl = null;
    },
  };
}

// Launcher silhouettes (scene units ≈ 4.5 m). Rideshare payloads fly on a medium-heavy host rocket.
export const ROCKETS = {
  'lv-small': { r: 0.42, body: 7.6, fair: 1.9, fairR: 0.46, dark: true, strapons: 0, sideCores: 0 },
  'lv-medium': { r: 0.55, body: 9.4, fair: 2.5, fairR: 0.66, dark: false, strapons: 6, sideCores: 0 },
  'lv-mediumheavy': { r: 0.6, body: 11.6, fair: 2.8, fairR: 0.72, dark: false, strapons: 0, sideCores: 0 },
  'lv-heavy': { r: 0.6, body: 11.6, fair: 3.1, fairR: 0.76, dark: false, strapons: 0, sideCores: 2 },
};

// ---------- GLSL ----------
const NOISE_GLSL = `
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise3(p); p *= 2.03; a *= 0.5; } return s; }
`;

const SKY_VS = `varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// uSpace blends a twilight launch sky (0) into deep space (1). Output is raw sRGB, like the particles.
const SKY_FS = `uniform vec3 uSunDir; uniform float uSpace; uniform float uMilky; uniform float uSunGlow;
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  vec3 space = mix(vec3(0.039, 0.071, 0.149), vec3(0.020, 0.035, 0.075), smoothstep(-0.6, 0.8, d.y));
  float band = exp(-pow(dot(d, normalize(vec3(0.42, 0.78, -0.46))) / 0.2, 2.0));
  float n = fbm3(d * 5.0);
  space += vec3(0.09, 0.10, 0.15) * band * (0.25 + n * n * 1.6) * uMilky;
  float h = d.y;
  vec3 horizon = vec3(0.30, 0.34, 0.50);
  vec3 sky = mix(horizon, vec3(0.03, 0.06, 0.16), pow(clamp(h, 0.0, 1.0), 0.5));
  vec3 sunFlat = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-5);
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), sunFlat), 0.0);
  sky += vec3(0.95, 0.50, 0.24) * pow(toward, 4.0) * (1.0 - smoothstep(0.0, 0.42, h)) * 0.75;
  sky += vec3(1.0, 0.80, 0.55) * pow(max(dot(d, uSunDir), 0.0), 64.0) * 0.5;
  sky = mix(sky, horizon * 0.32, smoothstep(0.0, -0.12, h));
  vec3 col = mix(sky, space, uSpace);
  float s = max(dot(d, uSunDir), 0.0);
  col += vec3(1.0, 0.93, 0.80) * (pow(s, 2400.0) * 4.0 + pow(s, 90.0) * 0.18 + pow(s, 12.0) * 0.04) * uSunGlow;
  gl_FragColor = vec4(col, 1.0);
}`;

const STAR_VS = `attribute float aSize; attribute vec3 aColor; attribute float aSeed;
uniform float uPixelRatio; uniform float uTime; uniform float uAlpha;
varying vec3 vColor; varying float vAlpha;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vAlpha = uAlpha * (0.72 + 0.28 * sin(uTime * (0.6 + aSeed * 2.4) + aSeed * 43.0));
  vColor = aColor;
  gl_PointSize = aSize * uPixelRatio;
}`;
const STAR_FS = `varying vec3 vColor; varying float vAlpha;
void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float a = 1.0 - d; gl_FragColor = vec4(vColor, vAlpha * a * a); }`;

const PARTICLE_VS = `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aSeed;
uniform float uScale; uniform float uMaxPoint;
varying vec3 vColor; varying float vAlpha; varying float vSeed;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.01), 0.0, uMaxPoint);
  vColor = aColor; vAlpha = aAlpha; vSeed = aSeed;
}`;
const PARTICLE_FS = `uniform float uFlame;
varying vec3 vColor; varying float vAlpha; varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a;
  if (uFlame > 0.5) a = pow(1.0 - d, 1.8);
  else {
    float ang = atan(c.y, c.x);
    float edge = 0.78 + 0.22 * sin(ang * 3.0 + vSeed * 6.283) * cos(ang * 2.0 - vSeed * 9.0);
    a = 1.0 - smoothstep(edge * 0.35, edge, d);
  }
  gl_FragColor = vec4(vColor, vAlpha * a);
}`;

const WORLD_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// Day side lit by the Sun with a soft terminator, ocean sun glint and limb haze (Earth only).
const PLANET_FS = `uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uFallback; uniform vec3 uSunDir;
uniform float uWater; uniform float uAtmo; uniform float uTerm; uniform float uGain; uniform float uNight;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  vec3 tex = texture2D(uMap, vUv).rgb;
  vec3 albedo = mix(uFallback, tex, uHasMap) * uGain;
  float ndl = dot(n, uSunDir);
  float diff = clamp((ndl + uTerm) / (1.0 + uTerm), 0.0, 1.0);
  vec3 col = albedo * (diff * 1.2 + (vec3(0.012) + vec3(0.010, 0.016, 0.035)) * uNight);
  float water = uWater * uHasMap * smoothstep(0.015, 0.06, tex.b - max(tex.r, tex.g) * 0.85);
  vec3 hv = normalize(uSunDir + v);
  col += vec3(1.0, 0.93, 0.8) * pow(max(dot(n, hv), 0.0), 140.0) * water * smoothstep(0.0, 0.15, ndl) * 0.45;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  col += vec3(0.25, 0.5, 1.0) * fres * uAtmo * 0.55 * smoothstep(-0.2, 0.4, ndl);
  col += vec3(0.6, 0.22, 0.06) * albedo * uAtmo * smoothstep(-0.12, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.18, ndl)) * 0.8;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
// Back-face shell: glow peaks at the planet's limb and fades out at the shell edge (rim glow).
const ATMO_FS = `uniform vec3 uSunDir; uniform vec3 uColor; uniform float uEdge; uniform float uStrength;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float k = clamp(-dot(n, v) / uEdge, 0.0, 1.0);
  float sun = smoothstep(-0.35, 0.45, dot(n, uSunDir)) * 0.88 + 0.12;
  gl_FragColor = vec4(uColor * pow(k, 2.2) * sun * uStrength, 1.0);
}`;
const SUN_FS = `uniform float uTime;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
${NOISE_GLSL}
void main() {
  vec3 n = normalize(vN);
  float mu = max(dot(n, normalize(cameraPosition - vW)), 0.0);
  float limb = pow(mu, 0.45);
  float g = fbm3(n * 7.0 + vec3(0.0, uTime * 0.12, uTime * 0.05));
  vec3 col = mix(vec3(0.95, 0.42, 0.10), vec3(1.0, 0.74, 0.32), limb);
  col = mix(col, vec3(1.0, 0.97, 0.86), limb * limb * 0.8);
  gl_FragColor = vec4(col * (0.85 + 0.35 * g) * 1.2, 1.0);
}`;

const VIEW_VS = `varying vec2 vUv; varying vec3 vNv; varying vec3 vVp;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vVp = mv.xyz;
  vNv = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;
// Soft light cone (floodlight beams, instrument field of view). uFlip picks which end is bright.
const BEAM_FS = `uniform vec3 uColor; uniform float uOpacity; uniform float uFlip;
varying vec2 vUv; varying vec3 vNv; varying vec3 vVp;
void main() {
  float facing = abs(dot(normalize(vNv), normalize(-vVp)));
  float along = mix(vUv.y, 1.0 - vUv.y, uFlip);
  gl_FragColor = vec4(uColor, uOpacity * pow(facing, 1.5) * pow(along, 1.3));
}`;
// Engine plume core: white-hot at the nozzle, orange and transparent toward the tip.
const PLUME_FS = `uniform float uLevel; uniform float uTime;
varying vec2 vUv; varying vec3 vNv; varying vec3 vVp;
void main() {
  float facing = abs(dot(normalize(vNv), normalize(-vVp)));
  float along = vUv.y;
  vec3 col = mix(vec3(1.0, 0.96, 0.82), vec3(1.0, 0.45, 0.12), smoothstep(0.0, 0.75, along));
  float a = uLevel * pow(facing, 1.2) * pow(1.0 - along, 1.4) * (0.85 + 0.15 * sin(uTime * 70.0 + along * 24.0));
  gl_FragColor = vec4(col, a);
}`;
const GLOW_FS = `uniform vec3 uColor; uniform float uIntensity; uniform float uPower; uniform float uRays; uniform float uRing; uniform float uTime;
varying vec2 vUv; varying vec3 vNv; varying vec3 vVp;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float a = uRing > 0.0 ? exp(-pow((r - 0.82) / 0.1, 2.0)) : pow(1.0 - r, uPower);
  if (uRays > 0.0) {
    float ang = atan(c.y, c.x);
    a *= 1.0 + uRays * (0.5 + 0.5 * sin(ang * 12.0 + uTime * 0.3) * sin(ang * 7.0 - uTime * 0.2)) * (1.0 - r);
  }
  gl_FragColor = vec4(uColor * uIntensity, a);
}`;
const LINK_VS = `attribute float aDist; varying float vDist;
void main() { vDist = aDist; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// Dashes flow from the spacecraft toward the ground: a downlink.
const LINK_FS = `uniform float uTime; uniform vec3 uColor; uniform float uDash;
varying float vDist;
void main() { if (fract(vDist / uDash - uTime * 1.6) > 0.55) discard; gl_FragColor = vec4(uColor, 0.85); }`;
// Full-screen overlay: scene-change fade, the red "mission lost" vignette and the event border flash.
const OVERLAY_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const OVERLAY_FS = `uniform vec2 uRes; uniform float uFade; uniform float uLost; uniform float uFlash; uniform vec3 uFlashColor;
varying vec2 vUv;
void main() {
  vec2 px = vUv * uRes;
  float r0 = min(uRes.x, uRes.y) * 0.2;
  float r1 = max(uRes.x, uRes.y) * 0.75;
  float a = clamp((length(px - uRes * 0.5) - r0) / (r1 - r0), 0.0, 1.0) * 0.28 * uLost;
  vec3 col = vec3(1.0, 0.314, 0.314) * a;
  float e = min(min(px.x, uRes.x - px.x), min(px.y, uRes.y - px.y));
  float band = (1.0 - smoothstep(9.0, 10.5, e)) * uFlash;
  col = uFlashColor * band + col * (1.0 - band);
  a = band + a * (1.0 - band);
  col *= 1.0 - uFade;
  a = uFade + a * (1.0 - uFade);
  gl_FragColor = vec4(col, a);
}`;

function createFlightView3D(THREE, canvas, opts, textures, state) {
  const { orbit, scenario, count = 1, network, launcher, reducedMotion = false } = opts;
  const speed = reducedMotion ? 0.35 : 1;
  const motion = reducedMotion ? 0 : 1;
  const rand = mulberry(42);
  const rr = (a, b) => a + (b - a) * rand();
  const jr = (a, b) => a + (b - a) * Math.random();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const t0 = performance.now();
  const disposables = new Set();
  const cleanups = [];
  const keep = (x) => { disposables.add(x); return x; };
  let destroyed = false;

  // Throws when WebGL is unavailable; the caller then falls back to the 2D view.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const labelLayer = document.createElement('div');
  try {
    return build();
  } catch (err) {
    labelLayer.remove();
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    throw err;
  }

  function build() {
    renderer.setClearColor(0x050913, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const gl = renderer.getContext();
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    // Only launch-pad materials opt into fog. Fog is applied after the sRGB conversion, so its
    // color is given as raw sRGB values to match the sky shader.
    scene.fog = new THREE.Fog(0x000000, 90, 950);
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 4000);
    const U = {
      time: { value: 0 },
      sunDir: { value: V(1, 0.18, 0.45).normalize() },
      pointScale: { value: 300 },
      pixelRatio: { value: 1 },
      maxPoint: { value: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)?.[1] ?? 64 },
    };
    const tmp = V();
    const tmp2 = V();
    const tmp3 = V();
    const mat4 = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const Y = V(0, 1, 0);

    // ---------- Material and mesh helpers ----------
    const std = (p) => keep(new THREE.MeshStandardMaterial({ fog: false, ...p }));
    const padStd = (p) => keep(new THREE.MeshStandardMaterial({ fog: true, ...p }));
    const basic = (p) => keep(new THREE.MeshBasicMaterial({ fog: false, toneMapped: false, ...p }));
    const lineMat = (p) => keep(new THREE.LineBasicMaterial({ fog: false, toneMapped: false, transparent: true, depthWrite: false, ...p }));
    const shader = (p) => keep(new THREE.ShaderMaterial(p));
    const G = {
      box: (...a) => keep(new THREE.BoxGeometry(...a)),
      cyl: (...a) => keep(new THREE.CylinderGeometry(...a)),
      cone: (...a) => keep(new THREE.ConeGeometry(...a)),
      sphere: (...a) => keep(new THREE.SphereGeometry(...a)),
      lathe: (pts, seg) => keep(new THREE.LatheGeometry(pts, seg)),
      plane: (...a) => keep(new THREE.PlaneGeometry(...a)),
    };
    const mesh = (geometry, material, parent, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(geometry, material);
      o.position.set(x, y, z);
      parent?.add(o);
      return o;
    };
    const group = (parent, x = 0, y = 0, z = 0) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent?.add(g);
      return g;
    };
    const canvasTexture = (c) => {
      const tex = keep(new THREE.CanvasTexture(c));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      return tex;
    };
    const canvas2d = (cw, ch) => {
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      return [c, c.getContext('2d')];
    };
    const billboards = [];
    const glowMat = (color, { intensity = 1, power = 2, rays = 0, ring = 0 } = {}) => shader({
      uniforms: { uColor: { value: V(...color) }, uIntensity: { value: intensity }, uPower: { value: power }, uRays: { value: rays }, uRing: { value: ring }, uTime: U.time },
      vertexShader: VIEW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const quadGeo = G.plane(1, 1);
    const glow = (parent, color, size, opts2) => {
      const m = mesh(quadGeo, glowMat(color, opts2), parent);
      m.scale.setScalar(size);
      m.renderOrder = 30;
      billboards.push(m);
      return m;
    };
    const latLon = (lat, lon, r = 1, out = V()) => out.set(
      r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.sin(lat * D2R), -r * Math.cos(lat * D2R) * Math.sin(lon * D2R));
    const fitDist = (radius) => radius / Math.min(TAN_HALF_FOV, TAN_HALF_FOV * camera.aspect);

    // ---------- Lights: one fixed rig, re-tuned per scene (a fixed light count avoids shader recompiles) ----------
    const ambient = new THREE.AmbientLight(0xffffff, 0.05);
    const hemi = new THREE.HemisphereLight(0x5d78b8, 0x16171d, 0);
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    const glowA = new THREE.PointLight(0xff9a4a, 0, 0, 2); // engine flame
    const glowB = new THREE.PointLight(0xdfe9ff, 0, 0, 2); // floodlight, then explosion flash
    scene.add(ambient, hemi, sun, sun.target, glowA, glowB);

    // ---------- Environment map for metals (procedural studio, prefiltered once) ----------
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(10, 32, 16);
    const envColors = [];
    const ep = envGeo.attributes.position;
    for (let i = 0; i < ep.count; i++) {
      const y = ep.getY(i) / 10;
      const c = y > 0 ? [lerp(0.28, 0.55, y), lerp(0.3, 0.62, y), lerp(0.36, 0.82, y)] : [lerp(0.28, 0.05, -y), lerp(0.3, 0.07, -y), lerp(0.36, 0.12, -y)];
      envColors.push(...c);
    }
    envGeo.setAttribute('color', new THREE.Float32BufferAttribute(envColors, 3));
    const envMats = [
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 15, 13) }),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.6, 3) }),
    ];
    const envSunGeo = new THREE.SphereGeometry(1.4, 16, 8);
    const envBarGeo = new THREE.BoxGeometry(7, 0.5, 0.5);
    envScene.add(new THREE.Mesh(envGeo, envMats[0]));
    mesh(envSunGeo, envMats[1], envScene, 7, 4, 5);
    mesh(envBarGeo, envMats[2], envScene, -4, 6.5, -3);
    const envRT = keep(pmrem.fromScene(envScene, 0.03));
    scene.environment = envRT.texture;
    pmrem.dispose();
    [envGeo, envSunGeo, envBarGeo, ...envMats].forEach((d) => d.dispose());

    // ---------- Sky dome, stars, overlay ----------
    const skyMat = shader({
      uniforms: { uSunDir: U.sunDir, uSpace: { value: 1 }, uMilky: { value: 1 }, uSunGlow: { value: 1 } },
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false,
    });
    const sky = mesh(G.sphere(1500, 48, 24), skyMat, scene);
    sky.renderOrder = -100;
    sky.frustumCulled = false;

    const starAlpha = { value: 1 };
    const starMaterial = (alpha) => shader({
      uniforms: { uPixelRatio: U.pixelRatio, uTime: U.time, uAlpha: alpha },
      vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pointCloud = (n, place, sizeFn, colorFn, material) => {
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const size = new Float32Array(n);
      const seed = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        place(tmp, i);
        pos.set([tmp.x, tmp.y, tmp.z], i * 3);
        col.set(colorFn(i), i * 3);
        size[i] = sizeFn(i);
        seed[i] = rand();
      }
      const g = keep(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      const p = new THREE.Points(g, material);
      p.frustumCulled = false;
      return p;
    };
    const stars = pointCloud(2400, (v) => {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      v.set(s * Math.cos(a), u, s * Math.sin(a)).multiplyScalar(1400);
    }, () => 0.7 + rand() ** 5 * 2.6, () => {
      const k = rand();
      return k < 0.5 ? [0.8, 0.87, 1] : k < 0.85 ? [0.95, 0.96, 1] : [1, 0.9, 0.76];
    }, starMaterial(starAlpha));
    stars.renderOrder = -90;
    scene.add(stars);

    const overlayU = { uRes: { value: new THREE.Vector2(1, 1) }, uFade: { value: 0 }, uLost: { value: 0 }, uFlash: { value: 0 }, uFlashColor: { value: V(1, 0.42, 0.42) } };
    const overlay = mesh(G.plane(2, 2), shader({
      uniforms: overlayU, vertexShader: OVERLAY_VS, fragmentShader: OVERLAY_FS,
      transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
    }), scene);
    overlay.frustumCulled = false;
    overlay.renderOrder = 1e6;

    // ---------- DOM labels (crisp text over the canvas; decorative, the canvas has an aria-label) ----------
    labelLayer.className = 'flight-labels';
    labelLayer.setAttribute('aria-hidden', 'true');
    labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    canvas.after(labelLayer);
    const TONES = { text: 'rgba(232,238,249,.88)', sun: 'rgba(255,209,102,.92)', dim: 'rgba(180,192,216,.82)', warm: 'rgba(255,177,135,.95)' };
    const labels = [];
    function addLabel(owner, text, pos, { dx = 0, dy = 0, align = 'center', tone = 'text', when = null } = {}) {
      const el = document.createElement('span');
      el.textContent = text;
      el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;font:500 11px/1.2 var(--mono, ui-monospace, monospace);color:${TONES[tone]};text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.9);opacity:0;transition:opacity .3s;will-change:transform;`;
      labelLayer.append(el);
      const l = { el, owner, pos, dx, dy, shift: align === 'left' ? 0 : align === 'right' ? 1 : 0.5, width: 0, when, shown: false };
      labels.push(l);
      return l;
    }
    function placeLabel(l, x, y, show) {
      if (show) {
        // Measured once per text; then the label is kept fully inside the canvas.
        if (!l.width || l.text !== l.el.textContent) { l.width = l.el.offsetWidth; l.text = l.el.textContent; }
        const left = clamp(x - l.width * l.shift, 6, Math.max(6, w - l.width - 6));
        l.el.style.transform = `translate(${left.toFixed(1)}px, ${clamp(y, 10, h - 10).toFixed(1)}px) translateY(-50%)`;
      }
      if (show !== l.shown) {
        l.el.style.opacity = show ? '1' : '0';
        l.shown = show;
      }
    }
    function updateLabels() {
      for (const l of labels) {
        if (l === sunLabel) continue;
        let show = (!l.owner || l.owner.visible) && (!l.when || l.when());
        if (show) {
          tmp.copy(typeof l.pos === 'function' ? l.pos(tmp2) : l.pos).project(camera);
          show = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
        }
        placeLabel(l, ((tmp.x + 1) / 2) * w + l.dx, ((1 - tmp.y) / 2) * h + l.dy, show);
      }
    }
    // "Sun" marker: next to the Sun when it is on screen, otherwise pinned to the edge, pointing at it.
    const sunLabel = addLabel(null, '', V(), { tone: 'sun' });
    let sunLabelOn = false;
    function updateSunLabel() {
      if (!sunLabelOn || !activeScene) { placeLabel(sunLabel, 0, 0, false); return; }
      tmp.copy(U.sunDir.value).transformDirection(camera.matrixWorldInverse);
      tmp2.copy(camera.position).addScaledVector(U.sunDir.value, 1000).project(camera);
      const name = T('Sun', 'Matahari');
      if (tmp.z < 0 && Math.abs(tmp2.x) < 0.85 && Math.abs(tmp2.y) < 0.8) {
        sunLabel.el.textContent = name;
        placeLabel(sunLabel, ((tmp2.x + 1) / 2) * w, ((1 - tmp2.y) / 2) * h + 22, true);
        return;
      }
      const ang = Math.atan2(tmp.y, tmp.x);
      const ax = Math.cos(ang);
      const ay = Math.sin(ang);
      const k = Math.min((w / 2 - 46) / Math.max(1e-3, Math.abs(ax)), (h / 2 - 18) / Math.max(1e-3, Math.abs(ay)));
      const arrows = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];
      const arrow = arrows[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
      sunLabel.el.textContent = ax >= 0 ? `${name} ${arrow}` : `${arrow} ${name}`;
      placeLabel(sunLabel, w / 2 + ax * k, h / 2 - ay * k, true);
    }

    // ---------- Particles (CPU-simulated, GPU point sprites) ----------
    function particleSystem(max, flame) {
      const g = keep(new THREE.BufferGeometry());
      const pos = new Float32Array(max * 3);
      const col = new Float32Array(max * 3);
      const size = new Float32Array(max);
      const alpha = new Float32Array(max);
      const seed = new Float32Array(max);
      const attrs = [['position', pos, 3], ['aColor', col, 3], ['aSize', size, 1], ['aAlpha', alpha, 1], ['aSeed', seed, 1]].map(([name, arr, n]) => {
        const a = new THREE.BufferAttribute(arr, n);
        a.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute(name, a);
        return a;
      });
      g.setDrawRange(0, 0);
      const points = new THREE.Points(g, shader({
        uniforms: { uScale: U.pointScale, uMaxPoint: U.maxPoint, uFlame: { value: flame ? 1 : 0 } },
        vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS, transparent: true, depthWrite: false,
        blending: flame ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      points.frustumCulled = false;
      points.renderOrder = flame ? 20 : 10;
      scene.add(points);
      // Per-particle state: velocity(3) base color(3), then age, life, size0, size1, alpha0, drag, lift, lit.
      const vel = new Float32Array(max * 3);
      const base = new Float32Array(max * 3);
      const F = 8;
      const s = new Float32Array(max * F);
      let n = 0;
      const sys = {
        floor: -Infinity,
        tint: [1, 1, 1],
        glowAt: V(),
        glowLevel: 0,
        get count() { return n; },
        /** p: { x, y, z, vx, vy, vz, life, s0, s1, a, r, g, b, drag, lift, lit } */
        spawn(p) {
          if (n >= max) return;
          const i = n++;
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          vel[i * 3] = p.vx; vel[i * 3 + 1] = p.vy; vel[i * 3 + 2] = p.vz;
          base[i * 3] = p.r ?? 1; base[i * 3 + 1] = p.g ?? 1; base[i * 3 + 2] = p.b ?? 1;
          s.set([0, p.life, p.s0, p.s1, p.a ?? 1, p.drag ?? 0, p.lift ?? 0, p.lit ?? 0], i * F);
          seed[i] = Math.random();
        },
        clear() { n = 0; },
        update(dt) {
          let i = 0;
          while (i < n) {
            const o = i * F;
            s[o] += dt;
            if (s[o] >= s[o + 1]) {
              n--;
              if (i !== n) {
                pos.copyWithin(i * 3, n * 3, n * 3 + 3);
                vel.copyWithin(i * 3, n * 3, n * 3 + 3);
                base.copyWithin(i * 3, n * 3, n * 3 + 3);
                s.copyWithin(o, n * F, n * F + F);
                seed[i] = seed[n];
              }
              continue;
            }
            const f = s[o] / s[o + 1];
            const dragK = Math.exp(-s[o + 5] * dt);
            const j = i * 3;
            vel[j] *= dragK; vel[j + 1] = vel[j + 1] * dragK + s[o + 6] * dt; vel[j + 2] *= dragK;
            pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
            if (pos[j + 1] < sys.floor && vel[j + 1] < 0) {
              // Flame hits the pad: deflect sideways through the flame trench (along X).
              const sp = -vel[j + 1];
              pos[j + 1] = sys.floor;
              vel[j + 1] = sp * 0.06;
              vel[j] += (seed[i] < 0.5 ? -1 : 1) * sp * 0.8;
              vel[j + 2] += (seed[i] - 0.5) * sp * 0.5;
            }
            if (flame) {
              let r;
              let gg;
              let b;
              if (f < 0.22) { const k = f / 0.22; r = 1; gg = lerp(0.96, 0.72, k); b = lerp(0.82, 0.3, k); }
              else if (f < 0.6) { const k = (f - 0.22) / 0.38; r = lerp(1, 0.92, k); gg = lerp(0.72, 0.32, k); b = lerp(0.3, 0.1, k); }
              else { const k = (f - 0.6) / 0.4; r = lerp(0.92, 0.35, k); gg = lerp(0.32, 0.08, k); b = lerp(0.1, 0.04, k); }
              col[j] = r * base[j]; col[j + 1] = gg * base[j + 1]; col[j + 2] = b * base[j + 2];
              alpha[i] = s[o + 4] * (1 - f) ** 1.3;
              size[i] = lerp(s[o + 2], s[o + 3], f);
            } else {
              const dx = pos[j] - sys.glowAt.x;
              const dy = pos[j + 1] - sys.glowAt.y;
              const dz = pos[j + 2] - sys.glowAt.z;
              const gl2 = s[o + 7] * sys.glowLevel * clamp(1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / 20);
              col[j] = base[j] * sys.tint[0] * (1 - gl2) + gl2 * 1.0;
              col[j + 1] = base[j + 1] * sys.tint[1] * (1 - gl2) + gl2 * 0.56;
              col[j + 2] = base[j + 2] * sys.tint[2] * (1 - gl2) + gl2 * 0.26;
              alpha[i] = s[o + 4] * smooth(0, 0.07, f) * (1 - f) ** 1.4;
              size[i] = lerp(s[o + 2], s[o + 3], 1 - (1 - f) ** 2);
            }
            i++;
          }
          g.setDrawRange(0, n);
          attrs.forEach((a) => { a.needsUpdate = true; });
        },
      };
      return sys;
    }
    const flames = particleSystem(1800, true);
    const smoke = particleSystem(1400, false);
    const P = {};
    const puff = (sys, x, y, z, vx, vy, vz, life, s0, s1, a, extra) => {
      P.x = x; P.y = y; P.z = z; P.vx = vx; P.vy = vy; P.vz = vz; P.life = life; P.s0 = s0; P.s1 = s1; P.a = a;
      P.r = 1; P.g = 1; P.b = 1; P.drag = 0; P.lift = 0; P.lit = 0;
      if (extra) Object.assign(P, extra);
      sys.spawn(P);
    };

    // Debris: one instanced mesh of tumbling boxes shared by every explosion.
    const DEBRIS_MAX = 72;
    const debrisMesh = keep(new THREE.InstancedMesh(G.box(1, 1, 1), std({ color: 0xffffff, roughness: 0.55, metalness: 0.35 }), DEBRIS_MAX));
    debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    debrisMesh.frustumCulled = false;
    const debrisColors = [0xe8edf5, 0x9aa3b2, 0x2a2e36, 0xd4a017, 0x1d3d8f].map((c) => new THREE.Color(c));
    for (let i = 0; i < DEBRIS_MAX; i++) debrisMesh.setColorAt(i, debrisColors[0]);
    debrisMesh.count = 0;
    scene.add(debrisMesh);
    const debris = [];
    const shock = glow(scene, [1, 0.78, 0.5], 1, { ring: 1, intensity: 0.8 });
    shock.visible = false;
    let shockT = 9;
    let shockSize = 1;
    let flashLight = 0;
    let shake = 0;

    function explode(center, scale, inherit, { fire = 260, dark = 140, parts = 34, gravity = 8, light = 5000 } = {}) {
      for (let i = 0; i < fire; i++) {
        tmp.randomDirection().multiplyScalar(jr(4, 18) * scale);
        puff(flames, center.x + tmp.x * 0.03, center.y + tmp.y * 0.03, center.z + tmp.z * 0.03,
          tmp.x + inherit.x, tmp.y + inherit.y, tmp.z + inherit.z, jr(0.5, 1.3), 1.1 * scale, jr(3.5, 7) * scale, 1, { drag: 2.4, lift: 1.4 * scale });
      }
      for (let i = 0; i < dark; i++) {
        tmp.randomDirection().multiplyScalar(jr(1.5, 8) * scale);
        const c = jr(0.14, 0.3);
        puff(smoke, center.x, center.y, center.z, tmp.x + inherit.x * 0.5, tmp.y + inherit.y * 0.5, tmp.z + inherit.z * 0.5,
          jr(3, 6), 2 * scale, jr(6, 11) * scale, 0.78, { r: c, g: c * 0.94, b: c * 0.9, drag: 1.5, lift: 0.9 * scale, lit: 0.9 });
      }
      for (let i = 0; i < parts && debris.length < DEBRIS_MAX; i++) {
        const v = V().randomDirection().multiplyScalar(jr(6, 20) * scale).add(inherit);
        v.y += 3 * scale;
        debris.push({
          p: center.clone(), v, q: new THREE.Quaternion().random(), axis: V().randomDirection(), spin: jr(2, 9),
          s: V(jr(0.12, 0.55), jr(0.1, 0.4), jr(0.05, 0.3)).multiplyScalar(scale), age: 0, life: jr(3.5, 5.5),
          ember: Math.random() < 0.6, g: gravity * scale,
        });
        debrisMesh.setColorAt(debris.length - 1, debrisColors[Math.floor(Math.random() * debrisColors.length)]);
      }
      if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;
      shock.position.copy(center);
      shockT = 0;
      shockSize = 11 * scale;
      glowB.position.copy(center);
      glowB.color.setHex(0xffb470);
      glowB.distance = 0;
      flashLight = light * scale * scale;
      shake = 1;
    }
    function updateEffects(dt) {
      flames.update(dt);
      smoke.update(dt);
      let n = 0;
      for (const d of debris) {
        d.age += dt;
        if (d.age > d.life) continue;
        d.v.y -= d.g * dt;
        d.v.multiplyScalar(Math.exp(-0.25 * dt));
        d.p.addScaledVector(d.v, dt);
        d.q.multiply(quat.setFromAxisAngle(d.axis, d.spin * dt));
        tmp.copy(d.s).multiplyScalar(1 - smooth(0.75, 1, d.age / d.life));
        debrisMesh.setMatrixAt(n++, mat4.compose(d.p, d.q, tmp));
        if (d.ember && d.age < 2.2 && Math.random() < dt * 30) {
          puff(flames, d.p.x, d.p.y, d.p.z, 0, 0.5, 0, jr(0.25, 0.5), d.s.x * 1.5, d.s.x * 3, 0.8);
        }
      }
      if (n === 0 && debris.length) debris.length = 0;
      debrisMesh.count = n;
      debrisMesh.instanceMatrix.needsUpdate = true;
      shockT += dt;
      shock.visible = shockT < 0.55;
      if (shock.visible) {
        shock.scale.setScalar(0.5 + shockSize * clamp(shockT / 0.55) ** 0.5);
        shock.material.uniforms.uIntensity.value = 0.8 * (1 - shockT / 0.55) ** 2;
      }
      if (flashLight > 0) {
        flashLight *= Math.exp(-2.6 * dt);
        glowB.intensity = flashLight;
        if (flashLight < 1) flashLight = 0;
      }
      shake *= Math.exp(-1.8 * dt);
    }

    // ---------- Procedural textures ----------
    function foilTexture() {
      const [c, x] = canvas2d(256, 256);
      const grad = x.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#f2c14e');
      grad.addColorStop(0.5, '#c8901e');
      grad.addColorStop(1, '#e8b23a');
      x.fillStyle = grad;
      x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 150; i++) {
        x.fillStyle = `hsla(${rr(36, 48)}, 80%, ${rr(30, 72)}%, ${rr(0.25, 0.55)})`;
        x.beginPath();
        const cx = rr(0, 256);
        const cy = rr(0, 256);
        for (let k = 0; k < 5; k++) x.lineTo(cx + rr(-34, 34), cy + rr(-34, 34));
        x.fill();
      }
      x.strokeStyle = 'rgba(90,55,8,.45)';
      x.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        x.beginPath();
        x.moveTo(rr(0, 256), rr(0, 256));
        x.lineTo(rr(0, 256), rr(0, 256));
        x.stroke();
      }
      return canvasTexture(c);
    }
    function cellTexture() {
      const [c, x] = canvas2d(256, 200);
      x.fillStyle = '#8f9bb0';
      x.fillRect(0, 0, 256, 200);
      const cols = 8;
      const rows = 6;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const cx = (i * 256) / cols + 2;
          const cy = (j * 200) / rows + 2;
          const cw = 256 / cols - 4;
          const ch = 200 / rows - 4;
          const g2 = x.createLinearGradient(cx, cy, cx + cw, cy + ch);
          g2.addColorStop(0, '#24479e');
          g2.addColorStop(1, '#0b1a45');
          x.fillStyle = g2;
          x.fillRect(cx, cy, cw, ch);
          x.fillStyle = 'rgba(170,190,230,.35)';
          x.fillRect(cx, cy + ch * 0.33, cw, 1);
          x.fillRect(cx, cy + ch * 0.66, cw, 1);
        }
      }
      return canvasTexture(c);
    }
    function padTexture() {
      const [c, x] = canvas2d(512, 512);
      x.fillStyle = '#5b6270';
      x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 3000; i++) {
        x.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)';
        x.fillRect(rr(0, 512), rr(0, 512), 2, 2);
      }
      x.strokeStyle = 'rgba(20,24,32,.35)';
      x.lineWidth = 2;
      for (let k = 0; k <= 512; k += 64) {
        x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 512); x.stroke();
        x.beginPath(); x.moveTo(0, k); x.lineTo(512, k); x.stroke();
      }
      const scorch = x.createRadialGradient(256, 256, 8, 256, 256, 210);
      scorch.addColorStop(0, 'rgba(12,12,14,.9)');
      scorch.addColorStop(1, 'rgba(12,12,14,0)');
      x.fillStyle = scorch;
      x.fillRect(0, 0, 512, 512);
      x.fillStyle = '#17191e';
      x.fillRect(0, 228, 512, 56);
      x.strokeStyle = '#d9a63a';
      x.lineWidth = 6;
      x.setLineDash([22, 14]);
      x.beginPath();
      x.arc(256, 256, 236, 0, Math.PI * 2);
      x.stroke();
      return canvasTexture(c);
    }
    // Rocket skin: u runs around the body (u = 0 faces +Z), v along it. Lettering faces the camera.
    function bodyTexture(p, faceU) {
      const [c, x] = canvas2d(512, 1024);
      x.fillStyle = p.dark ? '#1c1f26' : '#eef2f8';
      x.fillRect(0, 0, 512, 1024);
      x.fillStyle = p.dark ? 'rgba(255,255,255,.05)' : 'rgba(30,45,70,.10)';
      for (let y = 40; y < 1024; y += 64) x.fillRect(0, y, 512, 2);
      x.fillStyle = p.dark ? '#0d0f13' : '#15181f';
      x.fillRect(0, Math.round(1024 * 0.3), 512, 44);
      x.fillStyle = '#ff7a3d';
      x.fillRect(0, 1024 - 120, 512, 10);
      // The skin is stretched more along the body than around it; squash the glyphs to compensate.
      const stretch = (p.body / 1024) / ((2 * Math.PI * p.r) / 512);
      x.save();
      x.translate(faceU * 512, 1024 * 0.6);
      x.rotate(-Math.PI / 2);
      x.scale(1 / stretch, 1);
      x.font = '700 60px "Space Grotesk", system-ui, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = p.dark ? '#e8eef9' : '#13213f';
      x.fillText('GO/NO-GO', 0, 0);
      x.restore();
      return canvasTexture(c);
    }
    const foilTex = foilTexture();
    const cellTex = cellTexture();

    // ---------- Image textures (NASA) ----------
    function imageMap(img) {
      const tex = keep(new THREE.Texture(img));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      const has = { value: 0 };
      const ready = () => {
        if (destroyed) return;
        tex.needsUpdate = true;
        has.value = 1;
      };
      if (imageReady(img)) ready();
      else {
        img.addEventListener('load', ready);
        cleanups.push(() => img.removeEventListener('load', ready));
      }
      return { tex, has };
    }
    const earthMap = imageMap(textures.earth);
    const moonMap = imageMap(textures.moon);
    const planetGeo = G.sphere(1, 96, 64);
    const atmoGeo = G.sphere(1, 64, 40);
    function makePlanet(parent, kind, radius) {
      const isEarth = kind === 'earth';
      const map = isEarth ? earthMap : moonMap;
      const root = group(parent);
      const spin = group(root);
      const body = mesh(planetGeo, shader({
        uniforms: {
          uMap: { value: map.tex }, uHasMap: map.has, uFallback: { value: new THREE.Color(isEarth ? 0x2a63b8 : 0x8f8f8f) }, uSunDir: U.sunDir,
          uWater: { value: isEarth ? 1 : 0 }, uAtmo: { value: isEarth ? 1 : 0 }, uTerm: { value: isEarth ? 0.1 : 0.02 }, uGain: { value: isEarth ? 1 : 1.12 }, uNight: { value: isEarth ? 1 : 0.15 },
        },
        vertexShader: WORLD_VS, fragmentShader: PLANET_FS,
      }), spin);
      body.scale.setScalar(radius);
      if (isEarth) {
        const s = 1.07;
        const atmo = mesh(atmoGeo, shader({
          uniforms: { uSunDir: U.sunDir, uColor: { value: V(0.33, 0.62, 1.0) }, uEdge: { value: Math.sqrt(s * s - 1) / s }, uStrength: { value: 1.15 } },
          vertexShader: WORLD_VS, fragmentShader: ATMO_FS, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }), root);
        atmo.scale.setScalar(radius * s);
      }
      return { root, spin, radius };
    }

    // ---------- Satellite: gold-foil bus, two deployable blue solar wings, high-gain dish, camera ----------
    const satGeo = {
      bus: G.box(1, 1, 1.25),
      deck: G.box(1.04, 0.05, 1.29),
      boom: G.cyl(0.035, 0.035, 0.4, 8),
      panel: G.box(0.92, 0.03, 0.72),
      dish: G.sphere(0.42, 28, 6, 0, Math.PI * 2, 0, 0.55).translate(0, -0.42, 0),
      mast: G.cyl(0.03, 0.03, 0.14, 8),
      feedRod: G.cyl(0.012, 0.012, 0.21, 6),
      feed: G.cone(0.04, 0.08, 10),
      lens: G.cyl(0.2, 0.24, 0.32, 24),
      glass: keep(new THREE.CircleGeometry(0.16, 24)),
      tracker: G.cyl(0.07, 0.07, 0.16, 12),
      thruster: G.cone(0.06, 0.12, 12, 1, true),
    };
    function buildSatellite() {
      const m = {
        foil: std({ map: foilTex, bumpMap: foilTex, bumpScale: 1.5, metalness: 1, roughness: 0.34, envMapIntensity: 1.25 }),
        cells: std({ map: cellTex, metalness: 0.45, roughness: 0.3, envMapIntensity: 0.9 }),
        back: std({ color: 0xd3d9e3, metalness: 0.2, roughness: 0.6 }),
        white: std({ color: 0xeef1f6, metalness: 0.1, roughness: 0.45 }),
        dish: std({ color: 0xf2f4f8, metalness: 0.15, roughness: 0.4, side: THREE.DoubleSide }),
        metal: std({ color: 0xb9c2cf, metalness: 0.9, roughness: 0.3 }),
        dark: std({ color: 0x23272f, metalness: 0.5, roughness: 0.5 }),
        glass: std({ color: 0x0c1a33, metalness: 0.3, roughness: 0.05, envMapIntensity: 1.5 }),
      };
      const root = new THREE.Group();
      mesh(satGeo.bus, m.foil, root);
      mesh(satGeo.deck, m.white, root, 0, 0.52, 0);
      mesh(satGeo.tracker, m.dark, root, -0.3, 0.6, -0.4).rotation.x = 0.5;
      mesh(satGeo.tracker, m.dark, root, -0.1, 0.6, -0.45).rotation.x = 0.5;
      mesh(satGeo.thruster, m.metal, root, 0.25, -0.25, -0.68).rotation.x = -Math.PI / 2;
      mesh(satGeo.thruster, m.metal, root, -0.25, 0.25, -0.68).rotation.x = -Math.PI / 2;
      // Nadir side (-Y): science camera and the high-gain dish both look at the planet / Earth.
      mesh(satGeo.lens, m.dark, root, -0.18, -0.66, -0.15);
      mesh(satGeo.glass, m.glass, root, -0.18, -0.825, -0.15).rotation.x = Math.PI / 2;
      mesh(satGeo.mast, m.metal, root, 0.18, -0.57, 0.36);
      const dish = group(root, 0.18, -0.64, 0.36);
      mesh(satGeo.dish, m.dish, dish);
      mesh(satGeo.feedRod, m.metal, dish, 0, -0.105, 0);
      mesh(satGeo.feed, m.metal, dish, 0, -0.23, 0);
      // Wings hinge on the ±X sides. Each has three panels that fold like an accordion.
      const wings = [1, -1].map((side) => {
        const wing = group(root, 0.5 * side, 0, 0);
        wing.rotation.order = 'YXZ';
        wing.rotation.y = side > 0 ? 0 : Math.PI;
        mesh(satGeo.boom, m.metal, wing, 0.2, 0, 0).rotation.z = Math.PI / 2;
        const hinges = [];
        let parent = wing;
        for (let k = 0; k < 3; k++) {
          const hinge = group(parent, k === 0 ? 0.4 : 0.95, 0, 0);
          mesh(satGeo.panel, [m.back, m.back, m.cells, m.back, m.back, m.back], hinge, 0.47, 0, 0);
          hinges.push(hinge);
          parent = hinge;
        }
        return { wing, hinges, side };
      });
      const baseColor = {};
      const baseEnv = {};
      for (const [k, mm] of Object.entries(m)) { baseColor[k] = mm.color.clone(); baseEnv[k] = mm.envMapIntensity; }
      return { root, m, wings, baseColor, baseEnv };
    }
    function deploy(sat, p) {
      const f = 1 - easeInOut(clamp(p));
      for (const { hinges } of sat.wings) {
        hinges[0].rotation.z = -f * Math.PI / 2;
        hinges[1].rotation.z = f * Math.PI;
        hinges[1].position.y = f * 0.035;
        hinges[2].rotation.z = -f * Math.PI;
        hinges[2].position.y = -f * 0.035;
      }
    }
    const GRAY = new THREE.Color(0x7c879e);
    function tintSat(sat, shade, lostK) {
      for (const [k, mm] of Object.entries(sat.m)) {
        mm.color.copy(sat.baseColor[k]).multiplyScalar(shade);
        if (lostK > 0) mm.color.lerp(GRAY, lostK * 0.7);
        mm.envMapIntensity = sat.baseEnv[k] * shade;
      }
    }
    function fadeSat(sat, k) {
      for (const mm of Object.values(sat.m)) {
        if (!mm.transparent) { mm.transparent = true; mm.depthWrite = true; mm.needsUpdate = true; }
        mm.opacity = 1 - 0.68 * k;
      }
    }
    const basisX = V();
    const basisY = V();
    const basisZ = V();
    /** Points the craft's -Y side at `nadir`, +Z along `vel`, and turns the solar wings toward the Sun. */
    function orient(f, nadir) {
      basisY.copy(f.pos).sub(nadir).normalize();
      basisZ.copy(f.vel).addScaledVector(basisY, -f.vel.dot(basisY));
      if (basisZ.lengthSq() < 1e-10) basisZ.set(0, 0, 1);
      basisZ.normalize();
      basisX.crossVectors(basisY, basisZ);
      f.holder.quaternion.setFromRotationMatrix(mat4.makeBasis(basisX, basisY, basisZ));
      tmp.copy(U.sunDir.value).applyQuaternion(quat.copy(f.holder.quaternion).invert());
      const a = Math.atan2(tmp.z, tmp.y);
      f.sat.wings[0].wing.rotation.x = a;
      f.sat.wings[1].wing.rotation.x = -a;
    }
    function makeFleet(parent, n, scale, coneLength = 0) {
      return Array.from({ length: n }, () => {
        const holder = group(parent);
        const sat = buildSatellite();
        sat.root.scale.setScalar(scale);
        holder.add(sat.root);
        let fov = null;
        if (coneLength > 0) {
          fov = mesh(G.cone(coneLength * Math.tan(16 * D2R), coneLength, 32, 1, true), shader({
            uniforms: { uColor: { value: V(0.49, 0.78, 1) }, uOpacity: { value: 0.07 }, uFlip: { value: 1 } },
            vertexShader: VIEW_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
          }), holder, 0, -coneLength / 2 - scale * 0.8, 0);
        }
        return { holder, sat, fov, pos: V(), vel: V(), shade: 1, alive: true, lostAge: 0, spinAxis: V(), link: null };
      });
    }
    function loseFleet(fleet, scale) {
      for (const f of fleet) {
        if (!f.alive) continue;
        f.alive = false;
        f.spinAxis.randomDirection();
        if (f.fov) f.fov.visible = false;
        f.link?.hide();
        explode(f.pos, scale, V(), { fire: 46, dark: 0, parts: 6, gravity: 0, light: 900 });
      }
    }
    function updateLost(f, dt) {
      f.lostAge += dt;
      f.holder.rotateOnAxis(f.spinAxis, dt * 0.6);
      const k = smooth(0, 2.5, f.lostAge);
      tintSat(f.sat, lerp(f.shade, 0.7, k), k);
      fadeSat(f.sat, k);
    }
    function eclipse(f, center, radius, dt) {
      tmp.copy(f.pos).sub(center);
      const along = tmp.dot(U.sunDir.value);
      const off = tmp.addScaledVector(U.sunDir.value, -along).length();
      const target = along < 0 && off < radius * 0.98 ? 0.3 : 1;
      f.shade += (target - f.shade) * damp(dt, 6);
      tintSat(f.sat, f.shade, 0);
    }

    // ---------- Downlinks ----------
    const linkMats = {};
    function makeLink(parent, dash) {
      linkMats[dash] ??= shader({
        uniforms: { uTime: U.time, uColor: { value: V(0.435, 0.89, 0.757) }, uDash: { value: dash } },
        vertexShader: LINK_VS, fragmentShader: LINK_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const g = keep(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      g.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(2), 1));
      const line = new THREE.Line(g, linkMats[dash]);
      line.frustumCulled = false;
      line.visible = false;
      line.renderOrder = 25;
      parent.add(line);
      return {
        set(a, b) {
          g.attributes.position.array.set([a.x, a.y, a.z, b.x, b.y, b.z]);
          g.attributes.aDist.array[1] = a.distanceTo(b);
          g.attributes.position.needsUpdate = true;
          g.attributes.aDist.needsUpdate = true;
          line.visible = true;
        },
        hide() { line.visible = false; },
      };
    }
    const contactWindow = (time) => ((time * speed) / 9) % 1 < Math.min(1, (orbit.contact?.dsn ?? 480) / 1440);

    // ---------- Orbits ----------
    /** Circular orbit position. World axes: +Y = north pole, +X = 0° longitude / vernal equinox. */
    function orbitPoint(out, r, inc, raan, u) {
      const cO = Math.cos(raan);
      const sO = Math.sin(raan);
      const ci = Math.cos(inc);
      const si = Math.sin(inc);
      const cu = Math.cos(u);
      const su = Math.sin(u);
      return out.set(r * (cO * cu - sO * su * ci), r * su * si, -r * (sO * cu + cO * su * ci));
    }
    const orbitNormal = (inc, raan) => V(Math.sin(inc) * Math.sin(raan), Math.cos(inc), Math.sin(inc) * Math.cos(raan));
    /** Node longitude chosen so the lighting is physically right for the orbit type. */
    function orbitRaan(o) {
      const s = U.sunDir.value;
      if (o.lighting === 'terminator') return Math.atan2(s.x, s.z); // orbit plane faces the Sun: rides the day–night line
      if (o.sso) return Math.atan2(-s.z, s.x) - 22.5 * D2R + Math.PI; // descending node at 10:30 local time
      return -35 * D2R;
    }
    function ringMesh(parent, radius, normal, color = 0x7cc8ff, opacity = 0.7) {
      const ring = mesh(keep(new THREE.TorusGeometry(radius, 0.0045 * Math.max(1, radius), 6, 256)),
        basic({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }), parent);
      ring.quaternion.setFromUnitVectors(V(0, 0, 1), normal);
      ring.userData.opacity = opacity;
      return ring;
    }
    function dashedLoop(parent, pts, color, opacity, dash) {
      const line = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(pts)),
        keep(new THREE.LineDashedMaterial({ color, dashSize: dash, gapSize: dash * 0.9, transparent: true, opacity, fog: false, toneMapped: false, depthWrite: false })));
      line.computeLineDistances();
      parent.add(line);
      return line;
    }
    const circlePts = (r, n = 180) => Array.from({ length: n + 1 }, (_, i) => V(r * Math.cos((i / n) * Math.PI * 2), 0, r * Math.sin((i / n) * Math.PI * 2)));
    /** Starting phase that puts the craft on the camera-facing side of its orbit. */
    function frontPhase(r, inc, raan, camDir) {
      let best = 0;
      let bestDot = -Infinity;
      for (let i = 0; i < 72; i++) {
        const u = (i / 72) * Math.PI * 2;
        const d = orbitPoint(tmp, r, inc, raan, u).dot(camDir);
        if (d > bestDot) { bestDot = d; best = u; }
      }
      return best - 0.55;
    }
    // Shared camera move for orbit scenes: chase the craft (commissioning), then pull back to the overview.
    const chase = V();
    const look = V();
    // Returns the pull-back progress (0 = close-up, 1 = overview); the orbit ring fades in with it.
    function orbitCamera(t, f, overPos, overTarget, chaseDist, ring) {
      const e = reducedMotion || !f ? 1 : easeInOut(clamp((t - 0.5) / 2.8));
      if (ring) ring.material.opacity = ring.userData.opacity * smooth(0.35, 0.9, e);
      if (e >= 1) {
        camera.position.copy(overPos);
        camera.lookAt(overTarget);
        return e;
      }
      chase.set(0.5, 0.32, -1).multiplyScalar(chaseDist).applyQuaternion(f.holder.quaternion).add(f.pos);
      camera.position.lerpVectors(chase, overPos, e);
      look.lerpVectors(f.pos, overTarget, e);
      camera.lookAt(look);
      if (shake > 0.01 && motion) camera.position.addScalar(jr(-1, 1) * shake * 0.03);
      return e;
    }

    // =====================================================================
    // Scene: launch pad
    // =====================================================================
    function buildLaunch() {
      const root = group(scene);
      const R = ROCKETS[launcher?.id] ?? ROCKETS['lv-mediumheavy'];
      const PAD_Y = 0.9;
      const baseY = PAD_Y + 1.6;
      const HOLD = 0.45;
      const ACC = 20;
      const az0 = 0.58;
      const H = R.body + 0.35 + R.fair;
      const halfWidth = R.sideCores ? 3 * R.r + 0.1 : R.strapons ? R.r + 0.42 : R.r;
      const SUN = V(-0.62, 0.05, -0.78).normalize();

      // Ground, pad, launch mount
      mesh(G.box(1, 1, 1), padStd({ color: 0x0e1420, roughness: 1 }), root, 0, -0.5, 0).scale.set(2800, 1, 2800);
      const padSide = padStd({ color: 0x3d4350, roughness: 0.9 });
      mesh(G.cyl(9, 10, PAD_Y, 64), [padSide, padStd({ map: padTexture(), roughness: 0.92 }), padSide], root, 0, PAD_Y / 2, 0);
      const steel = padStd({ color: 0x4f5a70, roughness: 0.5, metalness: 0.55 });
      const mw = halfWidth + 0.5;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) mesh(G.box(0.32, 1.6, 0.32), steel, root, sx * mw, PAD_Y + 0.8, sz * mw);
        mesh(G.box(0.25, 0.22, mw * 2 + 0.3), steel, root, sx * mw, baseY - 0.1, 0);
        mesh(G.box(mw * 2 + 0.3, 0.22, 0.25), steel, root, 0, baseY - 0.1, sx * mw);
      }

      // Launch gantry: a lattice tower (one instanced draw call) with two retracting access arms.
      const towerX = -(halfWidth + 1.6 + 1.2);
      const towerZ = -0.3;
      const towerH = baseY + H + 2.2;
      const beams = [];
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [towerX + a * 1.2, towerZ + b * 1.2]);
      for (const [cx, cz] of corners) beams.push([cx, 0, cz, cx, towerH, cz, 0.2]);
      const level = 1.7;
      for (let y = 0; y <= towerH + 1e-6; y += level) {
        for (let k = 0; k < 4; k++) {
          const [ax, az] = corners[k];
          const [bx, bz] = corners[(k + 1) % 4];
          beams.push([ax, y, az, bx, y, bz, 0.12]);
          if (y + level <= towerH) {
            beams.push([ax, y, az, bx, y + level, bz, 0.07]);
            beams.push([bx, y, bz, ax, y + level, az, 0.07]);
          }
        }
      }
      const tower = keep(new THREE.InstancedMesh(G.box(1, 1, 1), padStd({ color: 0x59657e, roughness: 0.5, metalness: 0.55 }), beams.length));
      beams.forEach(([ax, ay, az, bx, by, bz, th], i) => {
        tmp.set(ax, ay, az);
        tmp2.set(bx, by, bz);
        tmp3.subVectors(tmp2, tmp);
        const len = tmp3.length();
        quat.setFromUnitVectors(Y, tmp3.normalize());
        tower.setMatrixAt(i, mat4.compose(tmp.add(tmp2).multiplyScalar(0.5), quat, V(th, len, th)));
      });
      root.add(tower);
      const armMat = padStd({ color: 0xc86a35, roughness: 0.55, metalness: 0.35 });
      const towerFace = towerX + 1.2;
      // Lower arm reaches the outermost stage at that height; the upper one the payload fairing.
      const arms = [[baseY + R.body * 0.62, R.sideCores ? halfWidth : R.r], [baseY + H - R.fair * 0.55, R.fairR]].map(([y, reach], i) => {
        const pivot = group(root, towerFace, y, towerZ + 0.3);
        const len = -towerFace - reach - 0.05;
        mesh(G.box(len, 0.3, 0.45), armMat, pivot, len / 2, 0, 0);
        if (i === 1) mesh(G.box(0.9, 0.9, 0.9), padStd({ color: 0xe9edf3, roughness: 0.6 }), pivot, len - 0.45, 0.05, 0);
        return pivot;
      });
      mesh(G.box(6, 0.3, 0.3), steel, root, towerX + 1.4, towerH + 0.3, towerZ);
      mesh(G.cyl(0.07, 0.07, 4, 6), steel, root, towerX, towerH + 2, towerZ);
      const beaconMat = basic({ color: 0xff2a1a });
      const beacons = [mesh(G.sphere(0.16, 10, 6), beaconMat, root, towerX, towerH + 4, towerZ)];
      // Lightning masts, a water tower and far hills for the skyline.
      for (const [x, z] of [[-17, -15], [16, -17], [-22, 2]]) {
        mesh(G.cyl(0.12, 0.2, 28, 8), steel, root, x, 14, z);
        beacons.push(mesh(G.sphere(0.2, 10, 6), beaconMat, root, x, 28.2, z));
      }
      mesh(G.cyl(0.3, 0.3, 12, 8), steel, root, 40, 6, -46);
      mesh(G.sphere(2.6, 20, 12), padStd({ color: 0x8d97aa, roughness: 0.6 }), root, 40, 13.5, -46);
      for (let i = 0; i < 11; i++) {
        const a = rr(-Math.PI, Math.PI);
        const d = rr(520, 760);
        const hill = mesh(G.sphere(1, 16, 8), padStd({ color: 0x101622, roughness: 1 }), root, Math.cos(a) * d, 0, Math.sin(a) * d);
        hill.scale.set(rr(80, 170), rr(10, 26), rr(60, 120));
      }
      const groundLights = pointCloud(140, (v) => {
        const a = rand() * Math.PI * 2;
        const d = rr(55, 650);
        v.set(Math.cos(a) * d, rr(0.4, 3), Math.sin(a) * d);
      }, () => rr(1.1, 2.4), () => (rand() < 0.6 ? [1, 0.82, 0.55] : [0.85, 0.92, 1]), starMaterial({ value: 0.9 }));
      root.add(groundLights);

      // Floodlights: lamp heads, soft volumetric beams aimed at the rocket; glowB is the real light.
      const beamMat = shader({
        uniforms: { uColor: { value: V(0.75, 0.83, 1) }, uOpacity: { value: 0.07 }, uFlip: { value: 0 } },
        vertexShader: VIEW_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      });
      const lampMat = basic({ color: 0xf2f6ff });
      const housing = padStd({ color: 0x2a303c, roughness: 0.6, metalness: 0.4 });
      const lamps = [V(13, 9, 2), V(-9, 8, 8)];
      for (const lamp of lamps) {
        mesh(G.cyl(0.12, 0.16, lamp.y, 8), steel, root, lamp.x, lamp.y / 2, lamp.z);
        const target = V(0, baseY + H * 0.45, 0);
        const head = mesh(G.box(1.4, 0.8, 0.25), [housing, housing, housing, housing, lampMat, housing], root, lamp.x, lamp.y + 0.3, lamp.z);
        head.lookAt(target);
        glow(root, [0.9, 0.95, 1], 2.4, { power: 3, intensity: 0.7 }).position.copy(head.position).addScaledVector(tmp.subVectors(target, lamp).normalize(), 0.3);
        const len = lamp.distanceTo(target);
        const beam = mesh(G.cone(4.2, len, 24, 1, true), beamMat, root);
        beam.position.lerpVectors(lamp, target, 0.5);
        beam.quaternion.setFromUnitVectors(Y, tmp.subVectors(lamp, target).normalize());
        beam.renderOrder = 15;
      }

      // The rocket. Lettering faces the camera's starting azimuth.
      const rk = buildRocket(R, az0 / (Math.PI * 2));
      rk.group.position.y = baseY;
      root.add(rk.group);

      const rocketVel = V();
      const down = V();
      const exitW = V();
      const lookAt = V(0, baseY + H * 0.5, 0);
      let followY = 0;
      let alt = 0;
      let retract = 0;
      let exploded = false;
      let explodedAt = V();

      function separate(b, vy) {
        b.free = true;
        root.attach(b.group);
        b.vel = tmp.copy(b.out).multiplyScalar(2.4).applyQuaternion(rk.group.quaternion).add(rocketVel).clone();
        b.vel.y = vy * 0.92;
        b.axis = V(b.out.z, 0, -b.out.x).normalize();
        for (const n of rk.nozzles) if (n.obj === b.group) n.burning = false;
      }

      return {
        root,
        near: 0.3,
        enter() {
          U.sunDir.value.copy(SUN);
          skyMat.uniforms.uMilky.value = 0.45;
          skyMat.uniforms.uSunGlow.value = 0;
          ambient.color.setHex(0x8090b0);
          ambient.intensity = 0.22;
          hemi.intensity = 0.95;
          sun.color.setHex(0xffa766);
          sun.intensity = 1.4;
          glowB.position.copy(lamps[0]).add(V(0, 0.3, 0));
          glowB.color.setHex(0xdfe9ff);
          glowB.intensity = 320;
          smoke.tint = [0.58, 0.62, 0.74];
          flames.floor = PAD_Y + 0.05;
          sunLabelOn = false;
        },
        lose() {
          if (exploded) return;
          exploded = true;
          explodedAt = rk.group.localToWorld(V(0, H * 0.45, 0));
          rk.group.visible = false;
          for (const b of rk.boosters) b.group.visible = b.free;
          explode(explodedAt, 1 + R.r * 0.6, rocketVel.clone().multiplyScalar(0.35));
        },
        update(t, dt, time, tc) {
          const ignited = state.scene === 'launch';
          const tl = ignited ? t : 0;
          retract = Math.max(retract, ignited ? 1 : smooth(0.15, 1.6, tc));
          arms.forEach((a, i) => { a.rotation.y = (1.15 + i * 0.2) * easeInOut(retract); });
          beaconMat.color.setRGB(Math.sin(time * 5.5) > 0.2 ? 1 : 0.16, 0.08, 0.05);

          const eng = exploded || !ignited ? 0 : smooth(0, 0.3, tl);
          const tm = Math.max(0, tl - HOLD);
          const vy = ACC * tm;
          const pitch = smooth(1.4, 3.4, tl) * 0.16;
          if (!exploded) {
            alt = 0.5 * ACC * tm * tm;
            rk.group.position.set(alt * Math.tan(pitch) * 0.45, baseY + alt, 0);
            rk.group.rotation.z = -pitch;
            rocketVel.set(Math.sin(pitch), Math.cos(pitch), 0).multiplyScalar(vy);
            for (const b of rk.boosters) if (!b.free && tl > b.sepAt) separate(b, vy);
          }
          for (const b of rk.boosters) {
            if (!b.free) continue;
            b.vel.y -= 7 * dt;
            b.group.position.addScaledVector(b.vel, dt);
            b.group.rotateOnWorldAxis(b.axis, dt * 0.7);
          }

          // Engine plumes, nozzle glow, exhaust particles, engine light.
          rk.plumeLevel.value = eng * (0.9 + 0.1 * Math.random());
          rk.nozzleMat.emissiveIntensity = eng * 2.2;
          for (const n of rk.nozzles) {
            n.plume.visible = eng > 0.01 && n.burning;
            n.plume.scale.set(1 + alt / 120, 1 + alt / 28, 1 + alt / 120);
          }
          down.set(0, -1, 0).applyQuaternion(rk.group.quaternion);
          let burning = 0;
          for (const n of rk.nozzles) if (n.burning) burning++;
          if (eng > 0.01) {
            const flameRate = (520 / Math.sqrt(burning)) * eng * dt;
            for (const n of rk.nozzles) {
              if (!n.burning) continue;
              n.obj.localToWorld(exitW.copy(n.local));
              for (let k = Math.floor(flameRate + Math.random()); k > 0; k--) {
                const back = Math.random() * dt;
                const ex = jr(22, 32);
                const lx = jr(-1, 1) * n.r * 2.2;
                const lz = jr(-1, 1) * n.r * 2.2;
                puff(flames,
                  exitW.x + (down.x * ex - rocketVel.x) * back, exitW.y + (down.y * ex) * back, exitW.z + (down.z * ex) * back,
                  rocketVel.x + down.x * ex + lx, rocketVel.y + down.y * ex, rocketVel.z + down.z * ex + lz,
                  jr(0.14, 0.3) * (1 + alt / 45), n.r * 1.7, n.r * 3.6, 0.85);
              }
              if (n.core && alt > 2 && Math.random() < 60 * eng * dt * 3) {
                puff(smoke, exitW.x + down.x * 3.2, exitW.y + down.y * 3.2, exitW.z + down.z * 3.2,
                  jr(-1.2, 1.2), rocketVel.y * 0.12 + jr(-1, 1), jr(-1.2, 1.2), jr(2.4, 3.6), 1.3, 5, 0.38,
                  { drag: 0.7, lift: 0.2, lit: 1, r: 0.92, g: 0.93, b: 0.96 });
              }
            }
            const nearPad = 1 - smooth(0, 32, alt);
            for (let k = Math.floor(170 * eng * nearPad * dt + Math.random()); k > 0; k--) {
              const side = Math.random() < 0.5 ? -1 : 1;
              puff(smoke, side * jr(4, 7), PAD_Y + 0.7, jr(-1.6, 1.6), side * jr(9, 18), jr(1, 4), jr(-3, 3),
                jr(4, 7), 2.6, jr(10, 15), 0.55, { drag: 1.1, lift: 0.6, lit: 1, r: 0.9, g: 0.91, b: 0.94 });
            }
            for (let k = Math.floor(45 * eng * nearPad * dt + Math.random()); k > 0; k--) {
              tmp.set(jr(-1, 1), 0, jr(-1, 1)).normalize().multiplyScalar(jr(5, 10));
              puff(smoke, tmp.x * 0.3, PAD_Y + 1, tmp.z * 0.3, tmp.x, jr(2, 5), tmp.z, jr(3, 5), 2, jr(7, 11), 0.5,
                { drag: 1.3, lift: 0.8, lit: 1, r: 0.9, g: 0.91, b: 0.94 });
            }
          } else if (!ignited && !exploded) {
            // Liquid-oxygen boil-off venting before liftoff.
            for (const vy0 of [R.body * 0.38, R.body * 0.78]) {
              if (Math.random() < 22 * dt) {
                rk.group.localToWorld(exitW.set(0, vy0, 0));
                tmp.set(Math.sin(az0 + 0.6), 0, Math.cos(az0 + 0.6));
                puff(smoke, exitW.x + tmp.x * R.r, exitW.y, exitW.z + tmp.z * R.r, tmp.x * 1.4, -0.5, tmp.z * 1.4,
                  jr(1.3, 2), 0.35, 2.2, 0.32, { drag: 0.9, lift: -0.3, r: 1, g: 1, b: 1 });
              }
            }
          }
          rk.core.obj.localToWorld(exitW.copy(rk.core.local));
          glowA.position.copy(exitW).addScaledVector(down, 1.5);
          glowA.intensity = eng * 1500 * (0.85 + 0.3 * Math.random());
          smoke.glowAt.copy(exitW);
          smoke.glowLevel = eng * 0.85;

          // Sky darkens toward space as the rocket climbs.
          const space = smooth(4, 80, alt) * 0.9;
          skyMat.uniforms.uSpace.value = space;
          starAlpha.value = lerp(0.12, 0.95, space);
          scene.fog.color.setRGB(lerp(0.3, 0.05, space), lerp(0.34, 0.07, space), lerp(0.5, 0.14, space), THREE.LinearSRGBColorSpace);
          hemi.intensity = 0.95 * (1 - space * 0.6);

          // Cinematic camera: slow orbit around the pad, then a lagging tilt-up chase of the rocket.
          const D = fitDist((H + 4) * 0.62) * lerp(1.12, 1, smooth(0, 2.2, tc));
          const az = az0 + tc * 0.03 * motion;
          followY += ((exploded ? explodedAt.y - baseY - H * 0.45 : alt) - followY) * damp(dt, 3);
          tmp.set(rk.group.position.x, baseY + H * 0.48 + alt, 0);
          if (exploded) tmp.copy(explodedAt);
          lookAt.lerp(tmp, damp(dt, ignited ? 7 : 3));
          camera.position.set(Math.sin(az) * D, 3.4 + followY * 0.8, Math.cos(az) * D);
          const sh = motion * (eng * 0.1 * (1 - smooth(0, 30, alt)) + shake * 0.5);
          if (sh > 0.001) camera.position.add(tmp.set(jr(-1, 1), jr(-1, 1), jr(-1, 1)).multiplyScalar(sh));
          camera.lookAt(lookAt);
        },
      };
    }

    function buildRocket(R, faceU) {
      const g = new THREE.Group();
      const nozzles = [];
      const boosters = [];
      const plumeLevel = { value: 0 };
      const plumeMat = shader({
        uniforms: { uLevel: plumeLevel, uTime: U.time },
        vertexShader: VIEW_VS, fragmentShader: PLUME_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      });
      const light = R.dark ? 0x1d2028 : 0xeef2f8;
      const plain = padStd({ color: light, roughness: 0.42, metalness: 0.08, envMapIntensity: 0.45 });
      const dark = padStd({ color: 0x23262d, roughness: 0.5, metalness: 0.55 });
      const finMat = padStd({ color: R.dark ? 0x3a3f4a : 0x2a2f3a, roughness: 0.45, metalness: 0.3 });
      const nozzleMat = padStd({ color: 0x3b3f47, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide, emissive: 0xff6a1a, emissiveIntensity: 0 });
      const bell = (rt, re, len) => G.lathe(Array.from({ length: 13 }, (_, i) => new THREE.Vector2(rt + (re - rt) * (i / 12) ** 0.6, -len * (i / 12))), 32);
      const ogive = (r, len) => {
        const rho = (r * r + len * len) / (2 * r);
        return G.lathe(Array.from({ length: 21 }, (_, i) => {
          const x = (len * i) / 20;
          return new THREE.Vector2(Math.max(0, Math.sqrt(rho * rho - x * x) + r - rho), x);
        }), 48);
      };
      const addNozzle = (obj, r, len, y, core = false) => {
        mesh(bell(r * 0.35, r, len), nozzleMat, obj, 0, y, 0);
        const exit = V(0, y - len, 0);
        const plumeLen = r * 8;
        // The plume hangs from a pivot at the nozzle exit so it can stretch as the air thins.
        const plume = group(obj, 0, exit.y, 0);
        const cone = mesh(G.cone(r * 0.95, plumeLen, 20, 1, true), plumeMat, plume, 0, -plumeLen / 2, 0);
        cone.rotation.x = Math.PI;
        cone.renderOrder = 21;
        plume.visible = false;
        const n = { obj, local: exit, r, plume, burning: true, core };
        nozzles.push(n);
        return n;
      };

      mesh(G.cyl(R.r, R.r, R.body, 48), padStd({ map: bodyTexture(R, faceU), roughness: 0.42, metalness: 0.08, envMapIntensity: 0.45 }), g, 0, R.body / 2, 0);
      mesh(G.cyl(R.r * 1.02, R.r * 1.08, 0.5, 48), dark, g, 0, 0.12, 0);
      const core = addNozzle(g, R.r * 0.68, R.r * 1.4, -0.12, true);
      const finShape = new THREE.Shape();
      const span = R.r * 1.15;
      finShape.moveTo(0, 1.9);
      finShape.lineTo(0, 0);
      finShape.lineTo(span, -0.12);
      finShape.lineTo(span, 0.6);
      finShape.closePath();
      const finGeo = keep(new THREE.ExtrudeGeometry(finShape, { depth: 0.07, bevelEnabled: false })).translate(0, 0, -0.035);
      if (!R.sideCores) {
        for (let k = 0; k < 4; k++) {
          const pivot = group(g);
          pivot.rotation.y = Math.PI / 4 + (k * Math.PI) / 2;
          mesh(finGeo, finMat, pivot, R.r * 0.96, 0.05, 0);
        }
      }
      mesh(G.cyl(R.fairR, R.r, 0.35, 48, 1, true), plain, g, 0, R.body + 0.175, 0);
      const fairCyl = R.fair * 0.45;
      mesh(G.cyl(R.fairR, R.fairR, fairCyl, 48, 1, true), plain, g, 0, R.body + 0.35 + fairCyl / 2, 0);
      mesh(ogive(R.fairR, R.fair - fairCyl), plain, g, 0, R.body + 0.35 + fairCyl, 0);

      // Strap-on solid boosters (medium launcher), dropped at about T+1.9 s in this compressed timeline.
      for (let k = 0; k < R.strapons; k++) {
        const a = (k * Math.PI) / 3 + Math.PI / 6;
        const out = V(Math.cos(a), 0, Math.sin(a));
        const bg = group(g, out.x * (R.r + 0.21), 0, out.z * (R.r + 0.21));
        mesh(G.cyl(0.2, 0.2, 4.4, 20), plain, bg, 0, 2.4, 0);
        mesh(ogive(0.2, 0.75), plain, bg, 0, 4.6, 0);
        mesh(G.cyl(0.21, 0.21, 0.3, 20), dark, bg, 0, 0.35, 0);
        addNozzle(bg, 0.15, 0.32, 0.2);
        boosters.push({ group: bg, out, sepAt: 1.9, free: false });
      }
      // Side cores (heavy launcher), each with its own engine, fins and nose cone.
      for (let k = 0; k < R.sideCores; k++) {
        const side = k === 0 ? -1 : 1;
        const out = V(side, 0, 0);
        const bg = group(g, side * (2 * R.r + 0.1), 0, 0);
        const len = R.body * 0.8;
        mesh(G.cyl(R.r, R.r, len, 40), plain, bg, 0, len / 2, 0);
        mesh(G.cyl(R.r * 1.01, R.r * 1.01, 0.4, 40), dark, bg, 0, len * 0.7, 0);
        mesh(ogive(R.r, 1.6), plain, bg, 0, len, 0);
        mesh(G.cyl(R.r * 1.02, R.r * 1.08, 0.5, 40), dark, bg, 0, 0.12, 0);
        addNozzle(bg, R.r * 0.6, R.r * 1.3, -0.12);
        for (const y of [1.2, len * 0.72]) mesh(G.box(0.3, 0.16, 0.16), dark, bg, -side * (R.r + 0.05), y, 0);
        for (let f = 0; f < 2; f++) {
          const pivot = group(bg);
          pivot.rotation.y = f === 0 ? Math.PI / 2 : -Math.PI / 2;
          mesh(finGeo, finMat, pivot, R.r * 0.96, 0.05, 0);
        }
        boosters.push({ group: bg, out, sepAt: 2.45, free: false });
      }
      return { group: g, nozzles, core, boosters, plumeLevel, nozzleMat };
    }

    // =====================================================================
    // Scene: cruise (to the Moon or L1)
    // =====================================================================
    function buildCruise() {
      const root = group(scene);
      const toMoon = orbit.body === 'moon';
      const earth = makePlanet(root, 'earth', 0.85);
      earth.root.position.set(-3.7, -1.05, 0);
      earth.spin.rotation.y = (-90 - 100) * D2R;
      const destPos = V(3.9, 1.3, -0.7);
      let dest;
      if (toMoon) {
        dest = makePlanet(root, 'moon', 0.42);
        dest.root.position.copy(destPos);
      } else {
        dest = { root: group(root, destPos.x, destPos.y, destPos.z) };
        l1Marker(dest.root);
      }
      const p0 = V(0.95, 0.35, 0.2).add(earth.root.position);
      const p2 = V(-0.62, -0.08, 0.15).add(destPos);
      const curve = new THREE.QuadraticBezierCurve3(p0, V(0.1, 3.1, 1), p2);
      const pts = curve.getPoints(160);
      dashedLoop(root, pts, 0x7cc8ff, 0.5, 0.1);
      const doneGeo = keep(new THREE.BufferGeometry().setFromPoints(pts));
      root.add(new THREE.Line(doneGeo, lineMat({ color: 0xa8e1ff, opacity: 0.95 })));
      const [craft] = makeFleet(root, 1, 0.11);
      const engineGlow = glow(craft.holder, [0.55, 0.75, 1], 0.32, { power: 2.5, intensity: 1.2 });
      engineGlow.position.set(0, 0, -0.14);
      addLabel(root, T('Earth', 'Bumi'), () => tmp2.copy(earth.root.position).add(tmp3.set(0, -1.05, 0)));
      addLabel(root, toMoon ? T('Moon', 'Bulan') : T('Sun–Earth L1', 'L1 Matahari–Bumi'), () => tmp2.copy(destPos).add(tmp3.set(0, -0.62, 0)));
      let lost = false;
      return {
        root,
        near: 0.05,
        enter() {
          setSpaceLights(V(1, 0.2, 0.4));
          sunLabelOn = toMoon;
        },
        lose() {
          if (lost) return;
          lost = true;
          craft.alive = false;
          craft.holder.visible = false;
          explode(craft.pos, 0.07, V(), { fire: 160, dark: 0, parts: 14, gravity: 0, light: 2500 });
        },
        update(t, dt, time) {
          earth.spin.rotation.y += dt * 12 * D2R * speed;
          if (dest.spin) dest.spin.rotation.y += dt * 3 * D2R * speed;
          const p = clamp(t / 2.4);
          doneGeo.setDrawRange(0, Math.max(2, Math.round(p * 161)));
          if (craft.alive) {
            curve.getPointAt(Math.min(p, 0.999), craft.pos);
            curve.getTangentAt(Math.min(p, 0.999), craft.vel);
            craft.holder.position.copy(craft.pos);
            deploy(craft.sat, smooth(0.15, 1.3, t));
            orient(craft, earth.root.position);
            engineGlow.material.uniforms.uIntensity.value = 0.9 + 0.3 * Math.sin(time * 30);
          }
          const D = fitDist(4.9);
          camera.position.set(0.3 + t * 0.06 * motion, 0.75, D);
          camera.lookAt(0.2, 0.25, 0);
          if (shake > 0.01 && motion) camera.position.addScalar(jr(-1, 1) * shake * 0.05);
        },
      };
    }
    function l1Marker(parent) {
      const m = basic({ color: 0xe8eef9, transparent: true, opacity: 0.85 });
      mesh(G.box(0.34, 0.018, 0.018), m, parent);
      mesh(G.box(0.018, 0.34, 0.018), m, parent);
      glow(parent, [0.75, 0.88, 1], 0.5, { power: 3, intensity: 0.9 });
      const ring = glow(parent, [0.49, 0.78, 1], 0.6, { ring: 1, intensity: 0.8 });
      return ring;
    }
    function setSpaceLights(dir) {
      U.sunDir.value.copy(dir).normalize();
      skyMat.uniforms.uSpace.value = 1;
      skyMat.uniforms.uMilky.value = 1;
      skyMat.uniforms.uSunGlow.value = 1;
      starAlpha.value = 1;
      ambient.color.setHex(0x6070a0);
      ambient.intensity = 0.06;
      hemi.intensity = 0;
      sun.color.setHex(0xfff6ea);
      sun.intensity = 3.2;
      glowA.intensity = 0;
      if (!flashLight) glowB.intensity = 0;
      smoke.tint = [1, 1, 1];
      smoke.glowLevel = 0;
      flames.floor = -Infinity;
    }

    // =====================================================================
    // Scene: Earth orbit (LEO / SSO / GEO)
    // =====================================================================
    function buildEarthOrbit() {
      const root = group(scene);
      const isGeo = orbit.id === 'geo';
      const SUN = V(1, 0.18, 0.45).normalize();
      U.sunDir.value.copy(SUN);
      const earth = makePlanet(root, 'earth', 1);
      const R = isGeo ? 4.2 : 1.16 + (orbit.alt / 6378) * 0.9;
      const inc = orbit.inc * D2R;
      const raan = orbitRaan(orbit);
      const normal = orbitNormal(inc, raan);
      const satScale = isGeo ? 0.16 : 0.055;
      const camDir = V(0, Math.sin(16 * D2R), Math.cos(16 * D2R));
      const lon0 = isGeo ? 108 - 58 : 100;
      earth.spin.rotation.y = (-90 - lon0) * D2R;

      const ring = ringMesh(root, R, normal);
      if (!isGeo) {
        dashedLoop(root, circlePts(R), 0x9fb0cc, 0.32, 0.05);
        // Inclination: arc between the equator and the orbit at the node nearest the camera.
        const asc = orbitPoint(V(), R, inc, raan, 0);
        const sgn = asc.dot(camDir) >= 0 ? 1 : -1;
        const node = asc.multiplyScalar(sgn);
        const east = V().crossVectors(Y, node).normalize();
        const rho = 0.26;
        const arc = Array.from({ length: 33 }, (_, i) => {
          const s = (i / 32) * inc;
          return node.clone().addScaledVector(east, rho * Math.cos(s)).addScaledVector(Y, sgn * rho * Math.sin(s));
        });
        const gold = lineMat({ color: 0xffd166, opacity: 0.9 });
        root.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(arc)), gold));
        const mid = inc / 2;
        const labelPos = node.clone().addScaledVector(east, rho * 1.9 * Math.cos(mid)).addScaledVector(Y, sgn * rho * 1.9 * Math.sin(mid));
        addLabel(root, T(`inclination ${orbit.inc}°`, `inklinasi ${orbit.inc}°`), labelPos, { tone: 'sun', align: 'left', dx: 6 });
      }

      // Ground stations and the scenario target ride on the spinning Earth.
      const stations = (STATIONS[network?.id] ?? []).map((s) => {
        const local = latLon(s.lat, s.lon, 1.004);
        const m = mesh(G.sphere(0.016, 10, 6), basic({ color: 0x6fe3c1 }), earth.spin, local.x, local.y, local.z);
        return { ...s, mesh: m, world: V(), up: V() };
      });
      const facing = (p) => tmp3.copy(camera.position).sub(p).normalize().dot(tmp.copy(p).normalize());
      for (const s of stations) {
        if (s.label && !scenario.target) {
          addLabel(root, s.label, () => s.mesh.getWorldPosition(tmp2), { align: 'left', dx: 8, dy: 10, when: () => facing(s.mesh.getWorldPosition(tmp2)) > 0.2 });
        }
      }
      let pulse = null;
      if (scenario.target) {
        const tgt = scenario.target;
        const up = latLon(tgt.lat, tgt.lon, 1);
        const cone = mesh(G.cone(0.028, 0.09, 12), basic({ color: 0xff8a4c }), earth.spin);
        cone.position.copy(up).multiplyScalar(1.045);
        cone.quaternion.setFromUnitVectors(Y, up);
        pulse = mesh(keep(new THREE.RingGeometry(0.02, 0.028, 32)), basic({ color: 0xff8a4c, transparent: true, side: THREE.DoubleSide, depthWrite: false }), earth.spin);
        pulse.position.copy(up).multiplyScalar(1.003);
        pulse.quaternion.setFromUnitVectors(V(0, 0, 1), up);
        addLabel(root, T(tgt.label, tgt.labelId), () => cone.getWorldPosition(tmp2), { align: 'left', dx: 10, dy: -10, tone: 'warm', when: () => facing(cone.getWorldPosition(tmp2)) > 0.15 });
      }

      const fleet = makeFleet(root, count, satScale, isGeo ? 0 : R - 1.0);
      fleet.forEach((f) => { f.link = makeLink(root, isGeo ? 0.12 : 0.05); });
      const u0 = frontPhase(R, inc, raan, camDir);
      const geoPos = V();
      if (isGeo) {
        root.updateMatrixWorld(true);
        earth.spin.localToWorld(latLon(0, 108, R, geoPos));
        addLabel(root, T('Geostationary: hovers over 108° E', 'Geostasioner: diam di atas 108° BT'), () => tmp2.copy(geoPos), { dy: -30 });
      }
      const PERIOD = 7;
      const overPos = V();
      const center = V();
      let lost = false;
      return {
        root,
        near: 0.01,
        enter() {
          setSpaceLights(SUN);
          sunLabelOn = true;
        },
        lose() {
          if (lost) return;
          lost = true;
          loseFleet(fleet, satScale * 0.9);
        },
        update(t, dt, time) {
          if (!isGeo) earth.spin.rotation.y = (-90 - lon0) * D2R + t * 6 * D2R * speed;
          if (pulse) {
            const k = (time * 0.8) % 1;
            pulse.scale.setScalar(1 + k * 3);
            pulse.material.opacity = 0.9 * (1 - k);
          }
          for (const s of stations) {
            s.mesh.getWorldPosition(s.world);
            s.up.copy(s.world).normalize();
          }
          const base = (t * speed * Math.PI * 2) / PERIOD;
          fleet.forEach((f, k) => {
            if (f.alive) {
              if (isGeo) {
                f.pos.copy(geoPos).addScaledVector(Y, Math.sin(time * 0.6) * 0.01);
                f.vel.crossVectors(Y, f.pos);
              } else {
                const u = u0 + base + (k * Math.PI * 2) / fleet.length;
                orbitPoint(f.pos, R, inc, raan, u);
                orbitPoint(f.vel, R, inc, raan, u + 0.01).sub(f.pos);
              }
              f.holder.position.copy(f.pos);
              orient(f, center);
              deploy(f.sat, reducedMotion ? smooth(0, 1, t) : smooth(0.25, 1.35, t));
              eclipse(f, center, 1, dt);
              let best = null;
              let bestD = Infinity;
              for (const s of stations) {
                tmp.copy(f.pos).sub(s.world);
                const d = tmp.length();
                if (tmp.dot(s.up) / d > 0.05 && d < bestD) { bestD = d; best = s; }
              }
              if (best && !lost) f.link.set(f.pos, best.world);
              else f.link.hide();
            } else updateLost(f, dt);
          });
          const D = fitDist(R * (isGeo ? 1.12 : 1.3));
          const sway = 0.1 * Math.sin(time * 0.08) * motion;
          overPos.set(Math.sin(sway), 0, Math.cos(sway)).multiplyScalar(D * Math.cos(16 * D2R)).setY(D * Math.sin(16 * D2R));
          orbitCamera(t, fleet[0], overPos, center, isGeo ? 1.2 : 0.42, ring);
        },
      };
    }

    // =====================================================================
    // Scene: low lunar polar orbit
    // =====================================================================
    function buildMoonOrbit() {
      const root = group(scene);
      const SUN = V(1, 0.15, 0.35).normalize();
      const moon = makePlanet(root, 'moon', 1);
      const earth = makePlanet(root, 'earth', 0.36);
      earth.root.position.set(-4.4, 2.3, -8.5);
      earth.spin.rotation.y = (-90 - 100) * D2R;
      const R = 1.2;
      const inc = orbit.inc * D2R;
      const raan = -35 * D2R;
      const satScale = 0.05;
      const ring = ringMesh(root, R, orbitNormal(inc, raan), 0x7cc8ff, 0.65);
      const pole = mesh(G.cone(0.035, 0.1, 12), basic({ color: 0xc9b8ff }), moon.spin, 0, -1.05, 0);
      pole.rotation.x = Math.PI;
      addLabel(root, T('South pole', 'Kutub selatan'), V(0, -1.12, 0), { align: 'left', dx: 12, dy: 6 });
      addLabel(root, T('Earth · DSN', 'Bumi · DSN'), () => tmp2.copy(earth.root.position).add(tmp3.set(0, -0.6, 0)));
      const camDir = V(0.1, 0.18, 1).normalize();
      const fleet = makeFleet(root, count, satScale, R - 1.0);
      fleet.forEach((f) => { f.link = makeLink(root, 0.3); });
      const u0 = frontPhase(R, inc, raan, camDir);
      const overPos = V();
      const center = V(0.15, 0, 0);
      const earthSurf = V();
      let lost = false;
      return {
        root,
        near: 0.01,
        enter() {
          setSpaceLights(SUN);
          sunLabelOn = true;
        },
        lose() {
          if (lost) return;
          lost = true;
          loseFleet(fleet, satScale * 0.9);
        },
        update(t, dt, time) {
          moon.spin.rotation.y = t * 4 * D2R * speed;
          earth.spin.rotation.y += dt * 20 * D2R * speed;
          const base = (t * speed * Math.PI * 2) / 6;
          fleet.forEach((f, k) => {
            if (f.alive) {
              const u = u0 + base + (k * Math.PI * 2) / fleet.length;
              orbitPoint(f.pos, R, inc, raan, u);
              orbitPoint(f.vel, R, inc, raan, u + 0.01).sub(f.pos);
              f.holder.position.copy(f.pos);
              orient(f, moon.root.position);
              deploy(f.sat, 1);
              eclipse(f, moon.root.position, 1, dt);
              // Behind the Moon, as seen from Earth, there is no line of sight to the DSN.
              earthSurf.copy(earth.root.position).sub(f.pos).normalize();
              const occluded = f.pos.dot(earthSurf) < 0 && tmp.copy(f.pos).addScaledVector(earthSurf, -f.pos.dot(earthSurf)).length() < 1;
              if (!lost && !occluded && contactWindow(time)) {
                f.link.set(f.pos, earthSurf.multiplyScalar(-0.36).add(earth.root.position));
              } else f.link.hide();
            } else updateLost(f, dt);
          });
          const D = fitDist(R * 1.32);
          const sway = 0.08 * Math.sin(time * 0.07) * motion;
          overPos.set(Math.sin(sway) * D, D * 0.18, Math.cos(sway) * D).add(center);
          orbitCamera(t, fleet[0], overPos, center, 0.4, ring);
        },
      };
    }

    // =====================================================================
    // Scene: Sun–Earth L1 halo orbit
    // =====================================================================
    function buildL1() {
      const root = group(scene);
      const sunPos = V(-11, 0.4, -5);
      const earthPos = V(4.4, -0.35, 0.8);
      const L1 = V(0.2, 0, 0.1);
      const sunMesh = mesh(planetGeo, shader({ uniforms: { uTime: U.time }, vertexShader: WORLD_VS, fragmentShader: SUN_FS }), root, sunPos.x, sunPos.y, sunPos.z);
      sunMesh.scale.setScalar(3.4);
      glow(root, [1, 0.72, 0.32], 17, { power: 2.2, rays: 0.8, intensity: 0.9 }).position.copy(sunPos);
      const earth = makePlanet(root, 'earth', 0.62);
      earth.root.position.copy(earthPos);
      earth.spin.rotation.y = (-90 - 100) * D2R;
      const lineDir = V().subVectors(earthPos, sunPos).normalize();
      const lateral = V().crossVectors(lineDir, Y).normalize();
      const up = V().crossVectors(lateral, lineDir).normalize();
      // Bow shock: where the solar wind meets Earth's magnetic field.
      const shockPts = Array.from({ length: 24 }, (_, i) => {
        const r = (i / 23) * 1.7;
        return new THREE.Vector2(r, -0.45 * r * r);
      });
      const bow = mesh(G.lathe(shockPts, 48), shader({
        uniforms: { uColor: { value: V(0.45, 0.7, 1) }, uOpacity: { value: 0.22 }, uFlip: { value: 1 } },
        vertexShader: VIEW_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }), root);
      bow.position.copy(earthPos).addScaledVector(lineDir, -1.05);
      bow.quaternion.setFromUnitVectors(Y, tmp.copy(lineDir).negate());
      l1Marker(group(root, L1.x, L1.y, L1.z));
      // Halo orbit: a loop around L1 that, seen from Earth, circles the Sun (hence "halo").
      const halo = (th, out) => out.copy(L1).addScaledVector(lineDir, 0.5 * Math.cos(th)).addScaledVector(up, 1.15 * Math.cos(th)).addScaledVector(lateral, 1.5 * Math.sin(th));
      dashedLoop(root, Array.from({ length: 241 }, (_, i) => halo((i / 240) * Math.PI * 2, V())), 0x7cc8ff, 0.75, 0.08);
      const satScale = 0.11;
      const fleet = makeFleet(root, count, satScale);
      fleet.forEach((f) => { f.link = makeLink(root, 0.25); });
      // Solar wind streaks.
      const WIND = reducedMotion ? 0 : 64;
      const windPos = new Float32Array(Math.max(1, WIND) * 6);
      const windCol = new Float32Array(Math.max(1, WIND) * 6);
      const wind = Array.from({ length: WIND }, () => ({ s: rr(0, 16), a: rr(0, Math.PI * 2), r: rr(0.3, 3.2), v: rr(3, 6), len: rr(0.25, 0.55) }));
      for (let i = 0; i < WIND; i++) windCol.set([1, 0.78, 0.35, 0, 0, 0], i * 6);
      const windGeo = keep(new THREE.BufferGeometry());
      windGeo.setAttribute('position', new THREE.BufferAttribute(windPos, 3));
      windGeo.setAttribute('color', new THREE.BufferAttribute(windCol, 3));
      const windLines = new THREE.LineSegments(windGeo, lineMat({ vertexColors: true, opacity: 0.45, blending: THREE.AdditiveBlending }));
      windLines.frustumCulled = false;
      root.add(windLines);
      const windStart = V().copy(sunPos).addScaledVector(lineDir, 3.6);

      addLabel(root, T('Earth', 'Bumi'), () => tmp2.copy(earthPos).add(tmp3.set(0, -0.82, 0)));
      addLabel(root, 'L1', L1, { align: 'left', dx: 12, dy: -12 });
      addLabel(root, T('Halo orbit around L1', 'Orbit halo di sekitar L1'), () => tmp2.copy(L1).add(tmp3.set(0, -1.55, 0)));
      addLabel(root, T('1.5 million km (not to scale)', '1,5 juta km (bukan skala sebenarnya)'), () => tmp2.lerpVectors(L1, earthPos, 0.62).add(tmp3.set(0, 1.25, 0)), { tone: 'dim' });
      addLabel(root, T('Solar wind →', 'Angin Matahari →'), () => tmp2.lerpVectors(windStart, L1, 0.45).add(tmp3.set(0, 1.9, 0)), { tone: 'sun' });
      const overPos = V();
      const overTarget = V(-0.4, 0, 0);
      const earthSurf = V();
      let lost = false;
      return {
        root,
        near: 0.01,
        enter() {
          setSpaceLights(tmp.subVectors(sunPos, L1));
          skyMat.uniforms.uSunGlow.value = 0;
          sunLabelOn = false;
        },
        lose() {
          if (lost) return;
          lost = true;
          loseFleet(fleet, satScale * 0.9);
        },
        update(t, dt, time) {
          earth.spin.rotation.y += dt * 20 * D2R * speed;
          const base = (t * speed * Math.PI * 2) / 14;
          fleet.forEach((f, k) => {
            if (f.alive) {
              const th = base + (k * Math.PI * 2) / fleet.length - 0.6;
              halo(th, f.pos);
              halo(th + 0.01, f.vel).sub(f.pos);
              f.holder.position.copy(f.pos);
              orient(f, earthPos);
              deploy(f.sat, 1);
              tintSat(f.sat, 1, 0);
              if (!lost && contactWindow(time)) f.link.set(f.pos, earthSurf.subVectors(f.pos, earthPos).setLength(0.62).add(earthPos));
              else f.link.hide();
            } else updateLost(f, dt);
          });
          for (let i = 0; i < WIND; i++) {
            const p = wind[i];
            p.s = (p.s + p.v * dt) % 16;
            tmp.copy(windStart).addScaledVector(lineDir, p.s).addScaledVector(lateral, Math.cos(p.a) * p.r).addScaledVector(up, Math.sin(p.a) * p.r);
            windPos.set([tmp.x, tmp.y, tmp.z], i * 6);
            tmp.addScaledVector(lineDir, -p.len);
            windPos.set([tmp.x, tmp.y, tmp.z], i * 6 + 3);
          }
          windGeo.attributes.position.needsUpdate = true;
          const D = fitDist(4.7);
          const sway = 0.05 * Math.sin(time * 0.06) * motion;
          overPos.set(0.6 + Math.sin(sway) * D, D * 0.3, Math.cos(sway) * D);
          orbitCamera(t, fleet[0], overPos, overTarget, 0.45);
        },
      };
    }

    // ---------- Scene switching ----------
    const scenes = { launch: buildLaunch() };
    const orbitKey = orbit.body === 'moon' ? 'moon' : orbit.body === 'l1' ? 'l1' : 'earth';
    if (orbit.body !== 'earth') scenes.cruise = buildCruise();
    scenes[orbitKey] = orbitKey === 'moon' ? buildMoonOrbit() : orbitKey === 'l1' ? buildL1() : buildEarthOrbit();
    let activeScene = null;
    let activeKey = '';
    let lost = false;
    let flashStart = -1;
    let fade = 0;
    function activate(key) {
      const first = !activeScene;
      for (const [k, sc] of Object.entries(scenes)) sc.root.visible = k === key;
      activeKey = key;
      activeScene = scenes[key];
      camera.near = activeScene.near;
      camera.updateProjectionMatrix();
      if (!first) {
        flames.clear();
        smoke.clear();
        debris.length = 0;
      }
      activeScene.enter();
      sun.position.copy(U.sunDir.value).multiplyScalar(50);
      if (!first) fade = 1;
    }
    activate('launch');
    // Compile every shader up front (in parallel where supported) so later scene changes do not stall.
    renderer.compileAsync?.(scene, camera).catch(() => {});

    // ---------- Sizing and frame loop ----------
    let w = 1;
    let h = 1;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      U.pixelRatio.value = pixelRatio;
      U.pointScale.value = (h * pixelRatio) / (2 * TAN_HALF_FOV);
      overlayU.uRes.value.set(w, h);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let raf = 0;
    let last = performance.now();
    let slowTime = 0;
    let frames = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const rawDt = (now - last) / 1000;
      const dt = Math.min(0.05, Math.max(0, rawDt));
      last = now;
      const time = now / 1000;
      U.time.value = time % 1000;
      activeScene.update((now - state.since) / 1000, dt, time, (now - t0) / 1000);
      updateEffects(dt);
      for (const b of billboards) b.quaternion.copy(camera.quaternion);
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      fade = Math.max(0, fade - dt / 0.5);
      overlayU.uFade.value = fade * fade;
      overlayU.uLost.value = lost ? smooth(0, 0.8, (now - lostAt) / 1000) : 0;
      if (flashStart >= 0) {
        const age = (now - flashStart) / 1000;
        overlayU.uFlash.value = age > 1.6 ? 0 : 0.9 * (1 - age / 1.6);
        if (age > 1.6) flashStart = -1;
      }
      renderer.render(scene, camera);
      updateLabels();
      updateSunLabel();
      // Adaptive resolution: drop the pixel ratio on GPUs that cannot hold ~30 fps.
      if (document.visibilityState === 'visible' && rawDt < 0.25 && pixelRatio > 1) {
        frames++;
        if (rawDt > 1 / 30) slowTime += rawDt;
        if (frames > 90) {
          if (slowTime > 1.2) {
            pixelRatio = Math.max(1, pixelRatio - 0.5);
            resize();
          }
          frames = 0;
          slowTime = 0;
        }
      }
    }
    let lostAt = 0;
    raf = requestAnimationFrame(frame);

    return {
      setScene(name) {
        const key = name === 'countdown' || name === 'launch' ? 'launch' : name === 'cruise' && scenes.cruise ? 'cruise' : orbitKey;
        if (key !== activeKey) activate(key);
      },
      setLost() {
        if (lost) return;
        lost = true;
        lostAt = performance.now();
        activeScene.lose();
      },
      flash(kind) {
        flashStart = performance.now();
        overlayU.uFlashColor.value.set(...(kind === 'opportunity' ? [1, 0.82, 0.4] : [1, 0.42, 0.42]));
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        cancelAnimationFrame(raf);
        ro.disconnect();
        cleanups.forEach((fn) => fn());
        labelLayer.remove();
        scene.environment = null;
        disposables.forEach((d) => d.dispose());
        disposables.clear();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  }
}
