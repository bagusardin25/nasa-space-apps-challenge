// Minimal sound design synthesized with the Web Audio API (no audio files).
// Includes Apollo-style "Quindar" tones (2525 Hz / 2475 Hz), countdown beeps, an alert klaxon and radio static.

const KEY = 'gonogo.sound';
let ctx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === 'off'; } catch { /* ignore */ }

export const isMuted = () => muted;

export function setMuted(value) {
  muted = Boolean(value);
  try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch { /* ignore */ }
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.2, ctx.currentTime, 0.02);
}

/** Browsers only allow audio after a user gesture, so the context is created lazily. */
function ready() {
  if (muted) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.2;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq, to = null, type = 'sine', dur = 0.15, gain = 0.4, at = 0, attack = 0.005, release = 0.06 }) {
  const c = ready();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.3, gain = 0.2, at = 0, freq = 1800, q = 0.8, filter = 'bandpass', fadeIn = 0.01 }) {
  const c = ready();
  if (!c) return;
  const t0 = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + fadeIn);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  click: () => tone({ freq: 1400, type: 'square', dur: 0.03, gain: 0.06 }),
  select: () => { tone({ freq: 660, dur: 0.06, gain: 0.18 }); tone({ freq: 990, dur: 0.08, gain: 0.18, at: 0.05 }); },
  deselect: () => { tone({ freq: 880, dur: 0.06, gain: 0.15 }); tone({ freq: 587, dur: 0.08, gain: 0.15, at: 0.05 }); },
  error: () => tone({ freq: 150, type: 'sawtooth', dur: 0.2, gain: 0.18 }),
  /** Apollo "Quindar" tones bracket every capcom transmission. */
  quindarIn: () => tone({ freq: 2525, dur: 0.25, gain: 0.14 }),
  quindarOut: () => tone({ freq: 2475, dur: 0.25, gain: 0.14 }),
  radio: () => { sfx.quindarIn(); noise({ dur: 0.35, gain: 0.12, at: 0.27, freq: 2200, q: 0.6 }); },
  countdown: () => tone({ freq: 880, dur: 0.14, gain: 0.3 }),
  liftoff: () => {
    tone({ freq: 1320, dur: 0.6, gain: 0.3 });
    noise({ dur: 3.2, gain: 0.5, freq: 260, filter: 'lowpass', q: 0.4, fadeIn: 0.4 });
    tone({ freq: 55, to: 38, type: 'sawtooth', dur: 3, gain: 0.12, attack: 0.3 });
  },
  separation: () => { noise({ dur: 0.12, gain: 0.3, freq: 900, q: 1.2 }); sfx.radio(); },
  alert: () => { for (let i = 0; i < 3; i++) { tone({ freq: 740, type: 'square', dur: 0.17, gain: 0.12, at: i * 0.36 }); tone({ freq: 554, type: 'square', dur: 0.17, gain: 0.12, at: i * 0.36 + 0.18 }); } },
  opportunity: () => [659, 880, 1319].forEach((f, i) => tone({ freq: f, dur: 0.28, gain: 0.2, at: i * 0.11 })),
  good: () => { tone({ freq: 784, dur: 0.12, gain: 0.2 }); tone({ freq: 1047, dur: 0.2, gain: 0.2, at: 0.1 }); sfx.quindarOut(); },
  bad: () => { tone({ freq: 330, to: 196, type: 'triangle', dur: 0.4, gain: 0.25 }); },
  go: () => tone({ freq: 1047, dur: 0.12, gain: 0.22 }),
  nogo: () => tone({ freq: 196, type: 'sawtooth', dur: 0.22, gain: 0.18 }),
  allGo: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.16, at: i * 0.07 })),
  success: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.45, gain: 0.18, at: i * 0.12 })),
  lost: () => { tone({ freq: 440, to: 98, type: 'sawtooth', dur: 1.3, gain: 0.18 }); noise({ dur: 1.2, gain: 0.08, at: 0.2, freq: 1200 }); },
};

/** Play a sound by name; silently ignored when muted or unsupported. */
export function play(name) {
  try { sfx[name]?.(); } catch { /* audio is a nice-to-have */ }
}
