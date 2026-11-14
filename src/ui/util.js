// Formatting and markup helpers.
import { tx } from '../i18n.js';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function num(v, digits = 0) {
  if (v === Infinity) return '∞';
  if (!Number.isFinite(v)) return '–';
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** Pick a sensible number of decimals for a value. */
export function smart(v) {
  if (!Number.isFinite(v)) return num(v);
  const a = Math.abs(v);
  if (a >= 100) return num(v, 0);
  if (a >= 10) return num(v, 1);
  if (a >= 1) return num(v, 1);
  if (a >= 0.1) return num(v, 2);
  if (a === 0) return '0';
  return num(v, 3);
}

export const money = (v) => `$${smart(v)}M`;
export const kg = (v) => `${smart(v)} kg`;
export const watts = (v) => `${num(v, v < 100 ? 1 : 0)} W`;
export const pct = (v, d = 0) => `${num(v * 100, d)}%`;

export function rate(mbps) {
  if (!mbps) return '0 bps';
  if (mbps >= 1000) return `${num(mbps / 1000, 1)} Gbps`;
  if (mbps >= 1) return `${smart(mbps)} Mbps`;
  return `${smart(mbps * 1000)} kbps`;
}

export function gb(v) {
  if (!Number.isFinite(v)) return '–';
  if (v >= 1000) return `${num(v / 1000, 1)} TB`;
  if (v >= 1) return `${smart(v)} GB`;
  return `${smart(v * 1000)} MB`;
}

export function minutes(min) {
  if (!Number.isFinite(min)) return '–';
  if (min >= 1440) return tx('continuous', 'terus-menerus');
  if (min >= 60) return tx(`${Math.floor(min / 60)} h ${Math.round(min % 60)} min`, `${Math.floor(min / 60)} j ${Math.round(min % 60)} mnt`);
  return tx(`${Math.round(min)} min`, `${Math.round(min)} mnt`);
}

export function years(y) {
  if (!Number.isFinite(y)) return '∞';
  if (y >= 15) return tx('15+ yr', '15+ thn');
  if (y < 1) return tx(`${num(y * 12, 0)} months`, `${num(y * 12, 0)} bulan`);
  return tx(`${num(y, 1)} yr`, `${num(y, 1)} thn`);
}

export function revisit(days) {
  if (days == null || !Number.isFinite(days)) return tx('never', 'tidak pernah');
  if (days < 1) return tx(`${num(days * 24, days * 24 < 10 ? 1 : 0)} h`, `${num(days * 24, days * 24 < 10 ? 1 : 0)} jam`);
  return tx(`${num(days, 1)} days`, `${num(days, 1)} hari`);
}

export function signed(v, unit = '', digits = 1) {
  const s = v > 0 ? '+' : v < 0 ? '−' : '±';
  return `${s}${num(Math.abs(v), digits)}${unit}`;
}

export function statusLabel(status) {
  return { go: 'GO', caution: tx('CAUTION', 'WASPADA'), nogo: 'NO-GO', incomplete: tx('PENDING', 'BELUM') }[status] ?? status;
}

export function statusPill(status, extra = '') {
  return `<span class="pill pill-${status}">${statusLabel(status)}${extra}</span>`;
}

export function attrs(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`))
    .join(' ');
}
