// Live spacecraft schematic for the design room.
// A pure function: mission metrics in, inline SVG markup out (no DOM, so it also runs in Node tests).
// The drawing is a not-to-scale blueprint: bus body in the middle, solar wings left and right,
// instruments on the target-facing (bottom) side, thrusters on top, antenna on the top-right corner.
import { esc, kg } from './util.js';
import { tx, nameOf } from '../i18n.js';

const W = 340;
const H = 214;
const CX = W / 2;
const CY = 104;

const BODY = { cube6u: [44, 60], cube12u: [58, 64], smallsat: [74, 80], medium: [90, 96] };
const WING = {
  'sa-fixed': { panels: 2, hFrac: 0.6, cant: 9 },
  'sa-track': { panels: 3, hFrac: 0.6, cant: 0, joint: true },
  'sa-xl': { panels: 4, hFrac: 0.86, cant: 0, joint: true },
};
const LENS = { thermal: '#ff9a5c', multispectral: '#6fe3c1', optical: '#7cc8ff', 'ir-spectro': '#ffd166' };
const SIZE_SCALE = { S: 0.82, M: 1, L: 1.2 };

const f1 = (n) => Number(n.toFixed(1));

// ---------- Solar arrays ----------
function wing(side, w, h, spec) {
  const dir = side === 'left' ? -1 : 1;
  const hingeX = CX + dir * (w / 2);
  const free = CX - w / 2 - 12; // space between body and the edge of the drawing
  const yoke = 9;
  const pw = Math.min(27, (free - yoke) / spec.panels - 2);
  const ph = Math.max(22, h * spec.hFrac);
  let panels = '';
  for (let i = 0; i < spec.panels; i++) {
    const x0 = yoke + i * (pw + 2);
    const x = dir === 1 ? x0 : -x0 - pw;
    panels += `<rect class="sch-cell" x="${f1(x)}" y="${f1(-ph / 2)}" width="${f1(pw)}" height="${f1(ph)}" rx="1.5"/>`;
    for (let k = 1; k < 3; k++) panels += `<line class="sch-cell-grid" x1="${f1(x + (pw * k) / 3)}" y1="${f1(-ph / 2)}" x2="${f1(x + (pw * k) / 3)}" y2="${f1(ph / 2)}"/>`;
    panels += `<line class="sch-cell-grid" x1="${f1(x)}" y1="0" x2="${f1(x + pw)}" y2="0"/>`;
  }
  const boom = `<line class="sch-strut" x1="0" y1="0" x2="${dir * (yoke + (spec.panels - 1) * (pw + 2))}" y2="0"/>`;
  const joint = spec.joint ? `<circle class="sch-joint" cx="${dir * 4.5}" cy="0" r="3.4"/><path class="sch-turn" d="M${dir * 1},-8 a 7 7 0 0 ${dir === 1 ? 1 : 0} ${dir * 7},0"/>` : '';
  return `<g transform="translate(${f1(hingeX)} ${CY}) rotate(${-dir * spec.cant})">${boom}${panels}${joint}</g>`;
}

function bodyCells(w, h) {
  const sw = Math.max(5, w * 0.13);
  const rows = 4;
  const rh = (h - 12) / rows;
  let out = '';
  for (const x of [CX - w / 2 + 2.5, CX + w / 2 - 2.5 - sw]) {
    for (let r = 0; r < rows; r++) out += `<rect class="sch-cell" x="${f1(x)}" y="${f1(CY - h / 2 + 6 + r * rh)}" width="${f1(sw)}" height="${f1(rh - 2)}" rx="1"/>`;
  }
  return out;
}

// ---------- Instruments (drawn pointing down from the mount point) ----------
function instrumentGlyph(inst) {
  const cap = inst.cap;
  if (cap === 'radar') {
    return `<line class="sch-strut" x1="0" y1="0" x2="0" y2="19"/><rect class="sch-inst" x="-24" y="19" width="48" height="7" rx="1.5"/>
      ${[-12, 0, 12].map((x) => `<line class="sch-inst-line" x1="${x}" y1="19" x2="${x}" y2="26"/>`).join('')}`;
  }
  if (cap === 'magnetometer') {
    return `<line class="sch-strut" x1="0" y1="0" x2="0" y2="24"/><rect class="sch-inst" x="-3.5" y="24" width="7" height="6" rx="1"/>`;
  }
  if (cap === 'iot' || cap === 'ais') {
    return `<rect class="sch-inst" x="-4" y="0" width="8" height="4.5" rx="1"/><line class="sch-whip" x1="-2" y1="4.5" x2="-8" y2="22"/><line class="sch-whip" x1="2" y1="4.5" x2="8" y2="22"/>`;
  }
  if (cap === 'coronagraph') {
    return `<rect class="sch-inst" x="-5" y="0" width="10" height="15" rx="1.5"/><line class="sch-strut" x1="0" y1="15" x2="0" y2="22"/><circle class="sch-inst-solid" cx="0" cy="23.5" r="3.2"/>`;
  }
  if (cap === 'altimeter') {
    return `<rect class="sch-inst" x="-5" y="0" width="10" height="11" rx="1.5"/><line class="sch-beam" x1="0" y1="11" x2="0" y2="28"/>`;
  }
  if (cap === 'neutron' || cap === 'plasma' || cap === 'particles') {
    return `<rect class="sch-inst" x="-6.5" y="0" width="13" height="9" rx="1.5"/><path class="sch-inst" d="M-4.5,9 a4.5 4.5 0 0 0 9,0"/>`;
  }
  // cameras and spectrometers: barrel, baffle and a tinted lens
  const tint = LENS[cap] ?? '#c4a5ff';
  return `<rect class="sch-inst" x="-5" y="0" width="10" height="8" rx="1"/><path class="sch-inst" d="M-5,8 L-8.5,17 L8.5,17 L5,8 Z"/>
    <ellipse cx="0" cy="17" rx="8.5" ry="2.6" fill="${tint}" fill-opacity=".85" stroke="${tint}"/>`;
}

function instruments(v, w, h, isNew) {
  const slots = v.bus ? v.bus.slots : Math.max(1, v.insts.length);
  const n = Math.max(slots, v.insts.length);
  const pitch = Math.min(26, (w + 16) / n);
  const y = CY + h / 2;
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = CX + (i - (n - 1) / 2) * pitch;
    const inst = v.insts[i];
    if (inst) {
      const s = SIZE_SCALE[inst.size] ?? 1;
      out += `<g class="sch-part sch-payload ${isNew(inst.id) ? 'sch-new' : ''}" transform="translate(${f1(x)} ${f1(y)}) scale(${s})">${instrumentGlyph(inst)}</g>`;
    } else {
      out += `<rect class="sch-slot" x="${f1(x - 5)}" y="${f1(y + 2)}" width="10" height="9" rx="1.5"/>`;
    }
  }
  return out;
}

// ---------- Propulsion (drawn pointing up from the top face) ----------
function thruster(prop) {
  switch (prop.id) {
    case 'prop-cold':
      return `<path class="sch-prop" d="M-11,0 L-13.5,-7 L-6.5,-7 L-9,0 Z"/><path class="sch-prop" d="M9,0 L6.5,-7 L13.5,-7 L11,0 Z"/>`;
    case 'prop-mono':
      return `<rect class="sch-prop" x="-3" y="-4" width="6" height="4"/><path class="sch-prop" d="M-3,-4 L-7.5,-14 L7.5,-14 L3,-4 Z"/>`;
    case 'prop-biprop':
      return `<rect class="sch-prop" x="-4" y="-5" width="8" height="5"/><path class="sch-prop" d="M-4,-5 Q-6,-12 -11,-19 L11,-19 Q6,-12 4,-5 Z"/>`;
    case 'prop-electric':
      return `<rect class="sch-prop" x="-8" y="-10" width="16" height="10" rx="2"/><ellipse class="sch-ion" cx="0" cy="-10" rx="6" ry="2"/>
        ${[-4, 0, 4].map((x) => `<line class="sch-ion-jet" x1="${x}" y1="-13" x2="${x * 1.5}" y2="-24"/>`).join('')}`;
    default:
      return '';
  }
}

function tank(v, w, h) {
  if (!v.prop || v.prop.id === 'prop-none') return '';
  const tw = w * 0.44;
  const th = h * 0.2;
  const x = CX - tw / 2;
  const y = CY - h / 2 + 6;
  const fill = v.mass.maxProp > 0 ? Math.max(0, Math.min(1, v.mass.propellant / v.mass.maxProp)) : 0;
  const fh = (th - 2) * fill;
  return `<rect class="sch-tank" x="${f1(x)}" y="${f1(y)}" width="${f1(tw)}" height="${f1(th)}" rx="${f1(th / 2.4)}"/>
    ${fh > 0.4 ? `<rect class="sch-fuel" x="${f1(x + 1)}" y="${f1(y + th - 1 - fh)}" width="${f1(tw - 2)}" height="${f1(fh)}" rx="${f1(Math.min(fh / 2, th / 2.6))}"/>` : ''}`;
}

// ---------- Battery and attitude control (inside the body) ----------
function battery(v, w, h) {
  if (!v.battery) return '';
  const bw = w * 0.4;
  const bh = Math.max(7, h * 0.12);
  const x = CX - bw / 2;
  const y = CY - 1;
  const tier = v.battery.wh <= 120 ? 1 : v.battery.wh <= 1500 ? 2 : 3;
  const seg = (bw - 4) / 3;
  let bars = '';
  for (let i = 0; i < tier; i++) bars += `<rect class="sch-bat-bar" x="${f1(x + 2 + i * seg)}" y="${f1(y + 2)}" width="${f1(seg - 1.2)}" height="${f1(bh - 4)}"/>`;
  return `<rect class="sch-bat" x="${f1(x)}" y="${f1(y)}" width="${f1(bw)}" height="${f1(bh)}" rx="1.5"/><rect class="sch-bat-nub" x="${f1(x + bw)}" y="${f1(y + bh / 2 - 1.5)}" width="2" height="3"/>${bars}`;
}

function adcs(v, w, h) {
  if (!v.adcs) return '';
  const y = CY + h / 2 - Math.max(9, h * 0.17);
  const r = Math.min(6.5, w * 0.12);
  if (!v.adcs.wheels) {
    // magnetorquer: a little coil
    const x = CX - 9;
    return `<path class="sch-adcs" d="M${x},${f1(y)} q2.25,-6 4.5,0 q2.25,6 4.5,0 q2.25,-6 4.5,0 q2.25,6 4.5,0"/>`;
  }
  const star = v.adcs.id === 'adcs-prec';
  const cx = star ? CX - 6 : CX;
  const wheel = `<circle class="sch-adcs" cx="${f1(cx)}" cy="${f1(y)}" r="${f1(r)}"/><path class="sch-adcs" d="M${f1(cx - r)},${f1(y)} h${f1(2 * r)} M${f1(cx)},${f1(y - r)} v${f1(2 * r)}"/>`;
  const sx = CX + 9;
  const tracker = star ? `<path class="sch-star" d="M${sx},${f1(y - 5)} l1.4,3.6 l3.6,1.4 l-3.6,1.4 l-1.4,3.6 l-1.4,-3.6 l-3.6,-1.4 l3.6,-1.4 Z"/>` : '';
  return wheel + tracker;
}

// ---------- Radio (drawn pointing up, then tilted outward on the top-right corner) ----------
function antenna(radio) {
  switch (radio.id) {
    case 'rad-uhf':
      return `<line class="sch-whip sch-radio-line" x1="0" y1="0" x2="-7" y2="-22"/><line class="sch-whip sch-radio-line" x1="0" y1="0" x2="7" y2="-22"/>`;
    case 'rad-s':
      return `<line class="sch-strut" x1="0" y1="0" x2="0" y2="-6"/><rect class="sch-radio" x="-6" y="-10" width="12" height="4" rx="1"/>`;
    case 'rad-x':
      return `<rect class="sch-radio" x="-2.5" y="-6" width="5" height="6"/><path class="sch-radio" d="M-2.5,-6 L-7,-15 L7,-15 L2.5,-6 Z"/>`;
    case 'rad-hga':
      return `<line class="sch-strut" x1="0" y1="0" x2="0" y2="-9"/><path class="sch-radio" d="M-12,-17 Q0,-3 12,-17 Z"/><line class="sch-strut" x1="0" y1="-10" x2="0" y2="-21"/><circle class="sch-radio-dot" cx="0" cy="-21" r="1.8"/>`;
    case 'rad-ka':
      return `<line class="sch-strut" x1="0" y1="0" x2="0" y2="-9"/><path class="sch-radio" d="M-15,-19 Q0,-2 15,-19 Z"/><path class="sch-strut" d="M-9,-14 L0,-25 L9,-14"/><ellipse class="sch-radio-dot" cx="0" cy="-25" rx="3.4" ry="1.4"/>`;
    default:
      return '';
  }
}

/**
 * @param m  current mission metrics (from computeMission)
 * @param p  metrics of the hovered option, or null. When given, the previewed spacecraft is drawn
 *           and the parts that would change are highlighted.
 */
export function satelliteSchematic(m, p = null) {
  const v = p ?? m;
  const preview = Boolean(p);
  const changed = (a, b) => preview && (a?.id ?? null) !== (b?.id ?? null);
  const cls = (flag) => (flag ? 'sch-new' : '');
  const [w, h] = v.bus ? BODY[v.bus.id] ?? BODY.smallsat : [56, 64];
  const top = CY - h / 2;

  const solarChanged = changed(v.solar, m.solar) || (preview && Boolean(v.solarSpec) !== Boolean(m.solarSpec));
  let solar = '';
  if (v.solar && v.bus) {
    const spec = WING[v.solar.id];
    solar = spec ? wing('left', w, h, spec) + wing('right', w, h, spec) : bodyCells(w, h);
  }
  const mIds = new Set(m.insts.map((i) => i.id));
  const body = v.bus
    ? `<rect class="sch-body" x="${f1(CX - w / 2)}" y="${f1(top)}" width="${w}" height="${h}" rx="5"/>
       <path class="sch-body-rib" d="M${f1(CX - w / 2 + 4)},${f1(top + 4)} h${w - 8} M${f1(CX - w / 2 + 4)},${f1(top + h - 4)} h${w - 8}"/>`
    : `<rect class="sch-ghost" x="${f1(CX - w / 2)}" y="${f1(top)}" width="${w}" height="${h}" rx="5"/>
       <text class="sch-hint" x="${CX}" y="${CY + 4}" text-anchor="middle">${esc(tx('no bus yet', 'belum ada bus'))}</text>`;

  const radioX = CX + w / 2 - 8;
  const parts = [
    `<g class="sch-part sch-solar ${cls(solarChanged)}">${solar}</g>`,
    `<g class="sch-part sch-bus ${cls(changed(v.bus, m.bus))}">${body}</g>`,
    v.bus ? `<g class="sch-part ${cls(changed(v.prop, m.prop))}">${tank(v, w, h)}</g>` : '',
    v.bus ? `<g class="sch-part ${cls(changed(v.battery, m.battery))}">${battery(v, w, h)}</g>` : '',
    v.bus ? `<g class="sch-part ${cls(changed(v.adcs, m.adcs))}">${adcs(v, w, h)}</g>` : '',
    v.prop && v.prop.id !== 'prop-none' ? `<g class="sch-part ${cls(changed(v.prop, m.prop))}" transform="translate(${CX} ${f1(top)})">${thruster(v.prop)}</g>` : '',
    v.radio ? `<g class="sch-part ${cls(changed(v.radio, m.radio))}" transform="translate(${f1(radioX)} ${f1(top)}) rotate(32)">${antenna(v.radio)}</g>` : '',
    instruments(v, w, h, (id) => preview && !mIds.has(id)),
  ].join('');

  const fleet = v.count > 1 ? `<text class="sch-fleet" x="12" y="22">×${v.count}</text>` : '';
  const massTxt = v.bus ? `<text class="sch-note" x="12" y="${H - 10}">${esc(tx('fueled mass', 'massa basah'))} ${esc(kg(v.mass.wet))}</text>` : '';
  const target = `<text class="sch-note" x="${W - 12}" y="${H - 10}" text-anchor="end">${esc(tx('target side ↓', 'sisi target ↓'))}</text>`;

  const instNames = v.insts.map((i) => nameOf(i)).join(', ');
  const label = v.bus || v.insts.length
    ? tx(`Spacecraft diagram: ${[v.bus && nameOf(v.bus), v.solar && nameOf(v.solar), instNames, v.prop && nameOf(v.prop), v.radio && nameOf(v.radio)].filter(Boolean).join('; ')}.`,
      `Diagram wahana: ${[v.bus && nameOf(v.bus), v.solar && nameOf(v.solar), instNames, v.prop && nameOf(v.prop), v.radio && nameOf(v.radio)].filter(Boolean).join('; ')}.`)
    : tx('Spacecraft diagram: nothing chosen yet.', 'Diagram wahana: belum ada yang dipilih.');

  const svg = `<svg class="sch-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    <defs><pattern id="sch-grid" width="17" height="17" patternUnits="userSpaceOnUse"><path d="M17 0H0V17" fill="none" stroke="currentColor" stroke-width=".5"/></pattern></defs>
    <rect class="sch-bg" width="${W}" height="${H}" fill="url(#sch-grid)"/>
    ${parts}${fleet}${massTxt}${target}
  </svg>`;

  const slots = v.bus ? `${v.insts.length} / ${v.bus.slots}` : String(v.insts.length);
  const propTxt = v.prop ? (v.prop.id === 'prop-none' ? nameOf(v.prop) : `${nameOf(v.prop)} · ${kg(v.mass.propellant)}`) : null;
  const rows = [
    ['bus', tx('Body', 'Badan'), v.bus ? nameOf(v.bus) : null, changed(v.bus, m.bus)],
    ['solar', tx('Solar', 'Surya'), v.solar ? nameOf(v.solar) : null, solarChanged],
    ['payload', tx('Sensors', 'Sensor'), v.insts.length ? `${slots} · ${instNames}` : null, preview && (v.insts.length !== m.insts.length || v.insts.some((i) => !mIds.has(i.id)))],
    ['prop', tx('Thrust', 'Dorong'), propTxt, changed(v.prop, m.prop)],
    ['radio', tx('Radio', 'Radio'), v.radio ? nameOf(v.radio) : null, changed(v.radio, m.radio)],
  ];
  const legend = rows.map(([key, k, val, isNew]) => `<li class="sch-row sch-k-${key} ${val ? '' : 'is-empty'} ${isNew ? 'is-new' : ''}">
      <i class="sch-dot" aria-hidden="true"></i><span class="sch-key">${esc(k)}</span><span class="sch-val" title="${esc(val ?? '')}">${esc(val ?? tx('not chosen', 'belum dipilih'))}</span></li>`).join('');

  return `<div class="dash-block sch ${preview ? 'is-preview' : ''}" data-tour="schematic">
    <div class="dash-row"><h3 class="dash-h">${tx('Spacecraft assembly', 'Rakitan wahana')}</h3>${preview
    ? `<span class="sch-tag">${tx('PREVIEW', 'PRATINJAU')}</span>` : `<span class="sch-tag sch-tag-live">${tx('LIVE', 'LANGSUNG')}</span>`}</div>
    ${svg}
    <ul class="sch-legend">${legend}</ul>
  </div>`;
}
