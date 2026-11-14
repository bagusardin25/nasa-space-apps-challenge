// Canvas 2D fallback for the flight phase, used when Three.js or WebGL is unavailable
// (offline, CDN blocked, old GPU). Draws stylized (not-to-scale) scenes:
// launch, cruise, Earth orbit, lunar orbit and the Sun–Earth L1 point.
// The NASA texture images are loaded by flightCanvas.js and passed in.
import { tx as T } from '../i18n.js';

const D2R = Math.PI / 180;
/** Wrap any angle into [-180, 180). (JavaScript's % keeps the sign, so negatives need care.) */
const wrap180 = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

export const STATIONS = {
  single: [{ lat: -7.25, lon: 112.75, label: 'Surabaya' }],
  commercial: [
    { lat: 78.2, lon: 15.4 }, { lat: 64.8, lon: -147.7 }, { lat: -33.4, lon: -70.6 }, { lat: -25.9, lon: 28.0 },
    { lat: -31.8, lon: 115.9 }, { lat: 1.35, lon: 103.8 }, { lat: 19.8, lon: -155.5 }, { lat: 52.2, lon: 4.4 },
    { lat: -7.25, lon: 112.75, label: 'Surabaya' }, { lat: 35.4, lon: 139.4 }, { lat: 13.0, lon: 77.6 }, { lat: -72.0, lon: 2.5 },
  ],
};

/** `textures` = { earth: HTMLImageElement, moon: HTMLImageElement }. Same return contract as createFlightView. */
export function createFlightView2D(canvas, opts, textures) {
  const { orbit, scenario, count = 1, network, reducedMotion = false } = opts;
  const g = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let scene = 'countdown';
  let sceneStart = performance.now();
  let lost = false;
  let flash = null;
  const speed = reducedMotion ? 0.35 : 1;
  const earthTex = textures.earth;
  const moonTex = textures.moon;

  const rand = mulberry(42);
  const stars = Array.from({ length: 160 }, () => ({ x: rand(), y: rand(), r: rand() * 1.2 + 0.2, a: rand() * 0.7 + 0.2 }));
  const wind = Array.from({ length: 70 }, () => ({ x: rand(), y: rand(), v: 0.2 + rand() * 0.4 }));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function frame(now) {
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function draw(now) {
    const t = (now - sceneStart) / 1000;
    g.clearRect(0, 0, w, h);
    background();
    if (scene === 'countdown' || scene === 'launch') drawLaunch(scene === 'launch' ? t : 0);
    else if (scene === 'cruise') drawCruise(t);
    else if (orbit.body === 'moon') drawMoonScene(now / 1000);
    else if (orbit.body === 'l1') drawL1Scene(now / 1000);
    else drawEarthScene(now / 1000);
    if (lost) {
      const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      grd.addColorStop(0, 'rgba(255,80,80,0)');
      grd.addColorStop(1, 'rgba(255,80,80,0.28)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }
    if (flash) {
      const age = (now - flash.start) / 1000;
      if (age > 1.6) flash = null;
      else {
        g.save();
        g.strokeStyle = flash.color;
        g.globalAlpha = Math.max(0, 1 - age / 1.6);
        g.lineWidth = 10;
        g.strokeRect(5, 5, w - 10, h - 10);
        g.restore();
      }
    }
  }

  function background() {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#050913');
    grd.addColorStop(1, '#0a1226');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    for (const s of stars) {
      g.globalAlpha = s.a;
      g.fillStyle = '#dfe8ff';
      g.beginPath();
      g.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // ---------- Launch ----------
  function drawLaunch(t) {
    const ground = h * 0.86;
    const sky = g.createLinearGradient(0, ground - h * 0.5, 0, ground);
    sky.addColorStop(0, 'rgba(40,70,130,0)');
    sky.addColorStop(1, 'rgba(60,100,170,0.35)');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, ground);
    g.fillStyle = '#0b1424';
    g.fillRect(0, ground, w, h - ground);
    g.fillStyle = '#16233d';
    g.fillRect(0, ground, w, 2);
    const ease = t <= 0 ? 0 : Math.min(1, (t / 2.8) ** 2.1);
    const shake = !reducedMotion && t > 0 && t < 1.2 ? (Math.random() - 0.5) * 2.5 : 0;
    const rx = w * 0.5 + shake;
    const ry = ground - 6 - ease * (ground + 120);
    // tower
    g.strokeStyle = '#2a3b5f';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w * 0.5 - 26, ground);
    g.lineTo(w * 0.5 - 26, ground - 92);
    g.moveTo(w * 0.5 - 26, ground - 60);
    g.lineTo(w * 0.5 - 10, ground - 60);
    g.stroke();
    // smoke
    if (t > 0) {
      for (let i = 0; i < 18; i++) {
        const k = (i / 18 + t * 0.6) % 1;
        g.globalAlpha = 0.18 * (1 - k);
        g.fillStyle = '#9fb0cc';
        g.beginPath();
        g.arc(w * 0.5 + Math.sin(i * 1.7) * 60 * k, ground - 4 - k * 18, 10 + 40 * k, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    // flame
    if (t > 0) {
      const fl = 26 + Math.random() * 14;
      const grd = g.createLinearGradient(rx, ry + 30, rx, ry + 30 + fl * 2);
      grd.addColorStop(0, '#fff3c4');
      grd.addColorStop(0.4, '#ff9a3d');
      grd.addColorStop(1, 'rgba(255,90,40,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(rx - 7, ry + 30);
      g.quadraticCurveTo(rx, ry + 30 + fl * 2.4, rx + 7, ry + 30);
      g.fill();
    }
    // rocket
    g.fillStyle = '#e8eef9';
    g.beginPath();
    g.moveTo(rx, ry - 34);
    g.quadraticCurveTo(rx + 9, ry - 20, rx + 8, ry + 30);
    g.lineTo(rx - 8, ry + 30);
    g.quadraticCurveTo(rx - 9, ry - 20, rx, ry - 34);
    g.fill();
    g.fillStyle = '#ff7a3d';
    g.fillRect(rx - 8, ry + 6, 16, 4);
    g.fillStyle = '#9fb0cc';
    g.beginPath();
    g.moveTo(rx - 8, ry + 18);
    g.lineTo(rx - 15, ry + 32);
    g.lineTo(rx - 8, ry + 30);
    g.moveTo(rx + 8, ry + 18);
    g.lineTo(rx + 15, ry + 32);
    g.lineTo(rx + 8, ry + 30);
    g.fill();
  }

  // ---------- Cruise ----------
  function drawCruise(t) {
    const p = Math.min(1, t / 2.4);
    const ex = w * 0.16;
    const ey = h * 0.62;
    const er = Math.min(w, h) * 0.09;
    drawGlobe(earthTex, ex, ey, er, (performance.now() / 1000) * 12, '#2a63b8');
    const tx = w * 0.84;
    const ty = h * 0.38;
    if (orbit.body === 'moon') drawGlobe(moonTex, tx, ty, er * 0.7, 0, '#8f8f8f');
    else drawL1Marker(tx, ty);
    g.setLineDash([4, 6]);
    g.strokeStyle = 'rgba(124,200,255,.55)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(ex + er, ey);
    g.quadraticCurveTo(w * 0.5, h * 0.12, tx - er, ty);
    g.stroke();
    g.setLineDash([]);
    const bx = quad(ex + er, w * 0.5, tx - er, p);
    const by = quad(ey, h * 0.12, ty, p);
    drawSat(bx, by, '#ff9a5c', 1);
    label(orbit.body === 'moon' ? T('Moon', 'Bulan') : T('Sun–Earth L1', 'L1 Matahari–Bumi'), tx, ty + er + 18);
    label(T('Earth', 'Bumi'), ex, ey + er + 18);
  }

  // ---------- Earth orbit ----------
  function drawEarthScene(time) {
    const isGeo = orbit.id === 'geo';
    const r = Math.min(w, h) * (isGeo ? 0.13 : 0.25);
    const cx = w * 0.5;
    const cy = h * 0.54;
    const lon0 = isGeo ? 108 : 60 + time * 9 * speed;
    const incEff = orbit.inc > 90 ? 180 - orbit.inc : orbit.inc;
    const tilt = -incEff * 0.72 * D2R;
    const k = isGeo ? 3.4 : 1.16 + (orbit.alt / 6378) * 0.9;
    const rx = r * k;
    const ry = rx * (isGeo ? 0.22 : 0.3);
    const periodS = isGeo ? 40 : 7;
    const theta0 = (time * speed * 2 * Math.PI) / periodS;

    const pt = (th) => {
      const x = rx * Math.cos(th);
      const y = ry * Math.sin(th);
      return [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
    };
    drawEllipseHalf(pt, false);
    drawGlobe(earthTex, cx, cy, r, lon0, '#2a63b8');

    // target / region markers
    if (scenario.target) {
      const p = project(scenario.target.lat, scenario.target.lon, lon0, cx, cy, r);
      if (p.visible) {
        marker(p.x, p.y, '#ff8a4c');
        label(T(scenario.target.label, scenario.target.labelId), p.x + 10, p.y - 8, 'left');
      }
    }
    const stations = STATIONS[network?.id] ?? [];
    const visibleStations = stations.map((s) => ({ ...s, ...project(s.lat, s.lon, lon0, cx, cy, r) })).filter((s) => s.visible);
    for (const s of visibleStations) {
      g.fillStyle = '#6fe3c1';
      g.fillRect(s.x - 2.5, s.y - 2.5, 5, 5);
      if (s.label && !scenario.target) label(s.label, s.x + 8, s.y + 12, 'left');
    }

    drawEllipseHalf(pt, true);
    for (let i = 0; i < count; i++) {
      const th = isGeo ? -Math.PI * 0.62 : theta0 + (i * 2 * Math.PI) / count;
      const [x, y] = isGeo ? [cx + Math.sin(time * 0.6) * 2, cy - r * 2.3] : pt(th);
      const behind = !isGeo && Math.sin(th) < 0 && Math.hypot(x - cx, y - cy) < r;
      if (behind) continue;
      const inShadow = !isGeo && x < cx && Math.abs(y - cy) < r * 0.95 && Math.sin(th) < 0.2;
      // link to the nearest visible station
      if (!lost) {
        let best = null;
        for (const s of visibleStations) {
          const dist = Math.hypot(s.x - x, s.y - y);
          if ((isGeo || dist < r * 0.95) && (!best || dist < best.dist)) best = { ...s, dist };
        }
        if (best) link(x, y, best.x, best.y, time);
      }
      drawSat(x, y, lost ? '#7c879e' : inShadow ? '#8a6a4f' : '#ff9a5c', inShadow ? 0.7 : 1);
    }
    label(T('Sun →', 'Matahari →'), w - 14, 22, 'right', 'rgba(255,209,102,.8)');
    if (isGeo) label(T('Geostationary: hovers over 108° E', 'Geostasioner: diam di atas 108° BT'), cx, cy - r * 2.3 - 18);
  }

  function drawEllipseHalf(pt, front) {
    g.save();
    g.strokeStyle = front ? 'rgba(124,200,255,.75)' : 'rgba(124,200,255,.22)';
    g.lineWidth = front ? 1.6 : 1.2;
    if (!front) g.setLineDash([3, 5]);
    g.beginPath();
    const start = front ? 0 : Math.PI;
    for (let i = 0; i <= 60; i++) {
      const th = start + (i / 60) * Math.PI;
      const [x, y] = pt(th);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.restore();
  }

  // ---------- Moon orbit ----------
  function drawMoonScene(time) {
    const r = Math.min(w, h) * 0.27;
    const cx = w * 0.55;
    const cy = h * 0.55;
    const lon0 = time * 6 * speed;
    const rx = r * 1.14;
    const ry = rx * 0.26;
    const tilt = -84 * D2R;
    const pt = (th) => {
      const x = rx * Math.cos(th);
      const y = ry * Math.sin(th);
      return [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
    };
    const ex = w * 0.13;
    const ey = h * 0.22;
    const er = r * 0.2;
    drawGlobe(earthTex, ex, ey, er, time * 20, '#2a63b8');
    label(T('Earth · DSN', 'Bumi · DSN'), ex, ey + er + 16);
    drawEllipseHalf(pt, false);
    drawGlobe(moonTex, cx, cy, r, lon0, '#8f8f8f');
    marker(cx, cy + r * 0.97, '#c9b8ff');
    label(T('South pole', 'Kutub selatan'), cx + 12, cy + r + 4, 'left');
    drawEllipseHalf(pt, true);
    const th = (time * speed * 2 * Math.PI) / 6;
    for (let i = 0; i < count; i++) {
      const a = th + (i * 2 * Math.PI) / count;
      const [x, y] = pt(a);
      if (Math.sin(a) < 0 && Math.hypot(x - cx, y - cy) < r) continue;
      if (!lost && contactWindow(time)) link(x, y, ex, ey, time);
      drawSat(x, y, lost ? '#7c879e' : '#ff9a5c', 1);
    }
  }

  // ---------- L1 ----------
  function drawL1Scene(time) {
    const sx = -h * 0.12;
    const sy = h * 0.5;
    const sr = h * 0.42;
    const sun = g.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 1.5);
    sun.addColorStop(0, '#fff6d6');
    sun.addColorStop(0.35, '#ffd166');
    sun.addColorStop(0.6, 'rgba(255,170,60,.35)');
    sun.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = sun;
    g.beginPath();
    g.arc(sx, sy, sr * 1.5, 0, Math.PI * 2);
    g.fill();
    if (!reducedMotion) {
      g.strokeStyle = 'rgba(255,209,102,.35)';
      g.lineWidth = 1;
      for (const p of wind) {
        const x = ((p.x + time * p.v * 0.12) % 1) * w;
        const y = p.y * h;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 10, y);
        g.stroke();
      }
    }
    const ex = w * 0.86;
    const ey = h * 0.5;
    const er = Math.min(w, h) * 0.07;
    drawGlobe(earthTex, ex, ey, er, time * 20, '#2a63b8');
    label(T('Earth', 'Bumi'), ex, ey + er + 16);
    const lx = w * 0.6;
    const ly = h * 0.5;
    drawL1Marker(lx, ly);
    const hx = Math.min(w, h) * 0.13;
    const hy = hx * 0.5;
    g.strokeStyle = 'rgba(124,200,255,.6)';
    g.setLineDash([3, 4]);
    g.beginPath();
    g.ellipse(lx, ly, hx, hy, -0.35, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    label(T('Halo orbit around L1', 'Orbit halo di sekitar L1'), lx, ly + hx * 0.85);
    label(T('1.5 million km (not to scale)', '1,5 juta km (bukan skala sebenarnya)'), (lx + ex) / 2, ey - er - 18, 'center', 'rgba(180,192,216,.8)');
    for (let i = 0; i < count; i++) {
      const a = (time * speed * 2 * Math.PI) / 14 + (i * 2 * Math.PI) / count;
      const x0 = hx * Math.cos(a);
      const y0 = hy * Math.sin(a);
      const x = lx + x0 * Math.cos(-0.35) - y0 * Math.sin(-0.35);
      const y = ly + x0 * Math.sin(-0.35) + y0 * Math.cos(-0.35);
      if (!lost && contactWindow(time)) link(x, y, ex, ey, time);
      drawSat(x, y, lost ? '#7c879e' : '#ff9a5c', 1);
    }
    label(T('Solar wind →', 'Angin Matahari →'), w * 0.3, 24, 'center', 'rgba(255,209,102,.85)');
  }

  function drawL1Marker(x, y) {
    g.strokeStyle = 'rgba(232,238,249,.7)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - 6, y);
    g.lineTo(x + 6, y);
    g.moveTo(x, y - 6);
    g.lineTo(x, y + 6);
    g.stroke();
    label('L1', x + 9, y - 8, 'left');
  }

  // ---------- Drawing helpers ----------
  function contactWindow(time) {
    const frac = Math.min(1, (orbit.contact?.dsn ?? 480) / 1440);
    return ((time * speed) / 9) % 1 < frac;
  }

  function drawGlobe(img, cx, cy, r, lon0, fallback) {
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = fallback;
    g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    if (img.complete && img.naturalWidth) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const rows = 18;
      const cols = 36;
      for (let j = 0; j < rows; j++) {
        const lat1 = 90 - j * 10;
        const lat2 = lat1 - 10;
        const y1 = cy - r * Math.sin(lat1 * D2R);
        const y2 = cy - r * Math.sin(lat2 * D2R);
        const cosLat = Math.cos(Math.min(Math.abs(lat1), Math.abs(lat2)) * D2R);
        const sy = (j * ih) / rows;
        const sh = ih / rows;
        for (let i = 0; i < cols; i++) {
          const lon1 = -180 + i * 10;
          const a1 = wrap180(lon1 - lon0);
          const a2 = a1 + 10;
          if (a2 <= -90 || a1 >= 90) continue;
          const c1 = Math.max(a1, -90);
          const c2 = Math.min(a2, 90);
          const x1 = cx + r * cosLat * Math.sin(c1 * D2R);
          const x2 = cx + r * cosLat * Math.sin(c2 * D2R);
          const sx = ((lon1 + 180 + (c1 - a1)) / 360) * iw;
          const sw = ((c2 - c1) / 360) * iw;
          if (x2 - x1 < 0.2) continue;
          g.drawImage(img, sx, sy, sw, sh, x1, y1, x2 - x1 + 0.8, y2 - y1 + 0.8);
        }
      }
    }
    // night side (Sun to the right)
    const night = g.createLinearGradient(cx - r, cy, cx + r * 0.35, cy);
    night.addColorStop(0, 'rgba(3,6,14,.82)');
    night.addColorStop(0.55, 'rgba(3,6,14,.35)');
    night.addColorStop(1, 'rgba(3,6,14,0)');
    g.fillStyle = night;
    g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    const shade = g.createRadialGradient(cx + r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
    shade.addColorStop(0, 'rgba(255,255,255,.06)');
    shade.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = shade;
    g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    g.restore();
    if (img === earthTex) {
      g.strokeStyle = 'rgba(124,200,255,.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
      g.stroke();
    }
  }

  function project(lat, lon, lon0, cx, cy, r) {
    const a = wrap180(lon - lon0);
    return { visible: a > -85 && a < 85, x: cx + r * Math.cos(lat * D2R) * Math.sin(a * D2R), y: cy - r * Math.sin(lat * D2R) };
  }

  function marker(x, y, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, y - 7);
    g.lineTo(x + 6, y + 4);
    g.lineTo(x - 6, y + 4);
    g.closePath();
    g.fill();
  }

  function link(x1, y1, x2, y2, time) {
    g.save();
    g.strokeStyle = 'rgba(111,227,193,.75)';
    g.lineWidth = 1.3;
    g.setLineDash([5, 5]);
    g.lineDashOffset = -time * 30;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    g.restore();
  }

  function drawSat(x, y, color, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(x - 3.5, y - 3.5, 7, 7);
    g.fillStyle = 'rgba(124,200,255,.9)';
    g.fillRect(x - 12, y - 1.5, 7, 3);
    g.fillRect(x + 5, y - 1.5, 7, 3);
    g.restore();
  }

  function label(text, x, y, align = 'center', color = 'rgba(232,238,249,.85)') {
    g.save();
    g.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
    g.textAlign = align;
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.restore();
  }

  return {
    setScene(s) {
      if (s === 'ascent') return; // the 2D view keeps the launch drawing running through the ascent
      scene = s;
      sceneStart = performance.now();
    },
    setLost() {
      lost = true;
    },
    flash(kind) {
      flash = { start: performance.now(), color: kind === 'opportunity' ? 'rgba(255,209,102,.9)' : 'rgba(255,107,107,.9)' };
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}

function quad(a, b, c, t) {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
}

export function mulberry(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
