// The "launch stack": which rocket was chosen, what rides inside its fairing, and whether the
// rocket can lift it. Pure functions (no DOM), so one description feeds the 3D view, the text
// legend under it, and the tests.
import { LAUNCH_CLASS_LABEL } from '../data/catalog.js';
import { tx, nameOf, launchClassLabel } from '../i18n.js';
import { esc, kg, pct } from './util.js';

/** A rideshare payload flies on someone else's medium-heavy rocket. */
const HOST = { 'lv-rideshare': 'lv-mediumheavy' };
const DISH_RADIOS = ['rad-hga', 'rad-ka'];
const share = (v) => (v < 0.01 ? '<1%' : pct(v));

/**
 * @param m  current mission metrics (from computeMission)
 * @param p  metrics of the hovered option, or null
 */
export function launchStack(m, p = null) {
  const v = p ?? m;
  const preview = Boolean(p);
  const lv = v.launcher;
  const rideshare = Boolean(lv?.rideshare);
  const hostId = lv ? HOST[lv.id] ?? lv.id : null;
  const cls = v.orbit?.launchClass ?? null;
  const dest = cls ? launchClassLabel(cls, LAUNCH_CLASS_LABEL[cls]) : '';
  const cap = lv && cls ? lv.caps[cls] : 0;
  const fleet = v.mass.fleet;
  const tooBig = Boolean(lv?.buses && v.bus && !lv.buses.includes(v.bus.id));

  let status;
  if (!lv) status = 'none';
  else if (!v.orbit) status = 'no-orbit';
  else if (cap === 0) status = 'unreachable';
  else if (!v.bus) status = 'empty';
  else if (tooBig) status = 'too-big';
  else if (fleet > cap) status = 'over';
  else status = 'fits';
  const used = cap > 0 && v.bus ? fleet / cap : null;
  const oversized = status === 'fits' && v.issues.some((i) => i.id === 'lv-oversized');

  let tone = 'idle';
  let note;
  switch (status) {
    case 'none':
      note = tx('Choose a launch vehicle in Orbit & Launch to see it here.', 'Pilih roket peluncur di Orbit & Peluncuran untuk melihatnya di sini.');
      break;
    case 'no-orbit':
      note = tx('Choose an orbit to see how much this rocket can lift there.', 'Pilih orbit untuk melihat berapa yang bisa diangkat roket ini ke sana.');
      break;
    case 'unreachable':
      tone = 'bad';
      note = tx(`This rocket cannot reach ${dest}.`, `Roket ini tidak bisa mencapai ${dest}.`);
      break;
    case 'empty':
      note = tx('The fairing is empty. Choose a spacecraft bus to load it.', 'Fairing masih kosong. Pilih bus wahana untuk mengisinya.');
      break;
    case 'too-big':
      tone = 'bad';
      note = tx('A rideshare slot only takes CubeSats and SmallSats.', 'Slot rideshare hanya menerima CubeSat dan SmallSat.');
      break;
    case 'over':
      tone = 'bad';
      note = tx(`Too heavy: ${kg(fleet)} to lift, but the limit to ${dest} is ${kg(cap)}.`,
        `Terlalu berat: ${kg(fleet)} harus diangkat, padahal batas ke ${dest} hanya ${kg(cap)}.`);
      break;
    default:
      if (oversized) {
        tone = 'warn';
        note = tx(`Fits, but it uses only ${share(used)} of the capacity to ${dest}. A smaller rocket would be cheaper.`,
          `Muat, tapi hanya memakai ${share(used)} kapasitas ke ${dest}. Roket yang lebih kecil akan lebih murah.`);
      } else if (rideshare) {
        tone = 'ok';
        note = tx(`Fits: ${kg(fleet)} on a shared rocket. You pay per kilogram.`, `Muat: ${kg(fleet)} di roket bersama. Biayanya dihitung per kilogram.`);
      } else {
        tone = 'ok';
        note = tx(`Fits: uses ${share(used)} of the capacity to ${dest}.`, `Muat: memakai ${share(used)} kapasitas ke ${dest}.`);
      }
  }

  const layout = !lv ? null
    : rideshare ? tx('Shared medium-heavy rocket', 'Roket menengah-berat bersama')
      : hostId === 'lv-medium' ? tx('Core + 6 strap-on boosters', 'Inti + 6 booster tempel')
        : hostId === 'lv-heavy' ? tx('Core + 2 side boosters', 'Inti + 2 pendorong samping')
          : tx('Single core', 'Satu inti');
  const payloadText = v.bus ? `${v.count} × ${nameOf(v.bus)}` : null;
  const liftText = cap > 0 ? tx(`${kg(fleet)} of ${kg(cap)}`, `${kg(fleet)} dari ${kg(cap)}`) : null;

  const lvChanged = preview && (v.launcher?.id ?? null) !== (m.launcher?.id ?? null);
  const payloadChanged = preview && ((v.bus?.id ?? null) !== (m.bus?.id ?? null) || v.count !== m.count);
  const liftChanged = preview && (lvChanged || (v.orbit?.id ?? null) !== (m.orbit?.id ?? null) || Math.abs(fleet - m.mass.fleet) > 0.05);

  const sat = v.bus ? {
    bus: v.bus.id,
    solar: v.solar && v.solarSpec ? (v.solar.id === 'sa-body' ? 'body' : 'wings') : null,
    instruments: v.insts.map((i) => ({ cap: i.cap, size: i.size })),
    antenna: v.radio ? (DISH_RADIOS.includes(v.radio.id) ? 'dish' : 'whip') : null,
    thruster: Boolean(v.prop && v.prop.id !== 'prop-none'),
  } : null;

  const rocketName = lv ? nameOf(lv) : tx('no rocket chosen', 'belum ada roket');
  return {
    preview, status, tone, note, used,
    hostId,
    ghost: !lv,
    rideshare,
    alarm: ['over', 'too-big', 'unreachable'].includes(status),
    sat,
    count: v.count,
    rows: [
      ['rocket', tx('Rocket', 'Roket'), lv ? nameOf(lv) : null, lvChanged],
      ['layout', tx('Layout', 'Susunan'), layout, lvChanged],
      ['payload', tx('Payload', 'Muatan'), payloadText, payloadChanged],
      ['lift', tx('Lift', 'Angkat'), liftText, liftChanged],
    ],
    labels: {
      fairing: tx('Fairing', 'Fairing'),
      payload: !sat ? '' : v.count > 1 ? tx(`Payload ×${v.count}`, `Muatan ×${v.count}`) : tx('Payload', 'Muatan'),
      others: rideshare ? tx('Other payloads', 'Muatan lain') : '',
      upper: tx('Upper stage', 'Tingkat atas'),
      first: tx('First stage', 'Tingkat pertama'),
      boost: hostId === 'lv-medium' ? tx('Boosters ×6', 'Booster ×6')
        : hostId === 'lv-heavy' ? tx('Side boosters ×2', 'Pendorong samping ×2') : '',
      hint: tx('Drag to rotate', 'Seret untuk memutar'),
    },
    summary: tx(`3D view of the launch stack: ${rocketName}${payloadText ? `, carrying ${payloadText}` : ''}. ${note}`,
      `Tampilan 3D susunan peluncuran: ${rocketName}${payloadText ? `, membawa ${payloadText}` : ''}. ${note}`),
  };
}

const BAR_TONE = { ok: 'go', warn: 'caution', bad: 'nogo', idle: 'muted' };

/** Dashboard panel: an empty slot for the 3D view plus the same facts as text. */
export function launchStackPanel(stack) {
  const legend = stack.rows.map(([key, k, val, isNew]) => `<li class="sch-row rk3d-k-${key} ${val ? '' : 'is-empty'} ${isNew ? 'is-new' : ''}">
      <i class="sch-dot" aria-hidden="true"></i><span class="sch-key">${esc(k)}</span><span class="sch-val" title="${esc(val ?? '')}">${esc(val ?? tx('not chosen', 'belum dipilih'))}</span></li>`).join('');
  const bar = stack.used == null ? ''
    : `<div class="bar bar-${BAR_TONE[stack.tone]}" aria-hidden="true"><span class="bar-fill" style="width:${(Math.min(1, stack.used) * 100).toFixed(1)}%"></span></div>`;
  return `<div class="dash-block sch rk3d ${stack.preview ? 'is-preview' : ''}" data-tour="stack">
    <div class="dash-row"><h3 class="dash-h">${tx('Launch stack', 'Susunan peluncuran')}</h3>${stack.preview
    ? `<span class="sch-tag">${tx('PREVIEW', 'PRATINJAU')}</span>` : `<span class="sch-tag sch-tag-live">${tx('LIVE', 'LANGSUNG')}</span>`}</div>
    <div class="rk3d-slot" data-rocket-slot role="img" aria-label="${esc(stack.summary)}"><p class="rk3d-wait">${tx('Loading 3D view…', 'Memuat tampilan 3D…')}</p></div>
    ${bar}
    <p class="rk3d-note rk3d-${stack.tone}">${esc(stack.note)}</p>
    <ul class="sch-legend">${legend}</ul>
  </div>`;
}
