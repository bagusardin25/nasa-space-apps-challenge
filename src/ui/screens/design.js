// The design room: four role tabs plus the live mission dashboard.
import {
  BUSES, INSTRUMENTS, SOLAR, BATTERIES, ADCS, PROPULSION, RADIOS, NETWORKS, OPS, LAUNCHERS, ORBITS,
  CAPABILITIES, LAUNCH_CLASS_LABEL,
} from '../../data/catalog.js';
import { launchCost } from '../../engine/mission.js';
import { orbitInfo, imagingGeometry, arrayPowerBOL } from '../../engine/physics.js';
import { roleObjectives } from '../../engine/score.js';
import { icon, ROLE_ICON } from '../icons.js';
import { esc, num, smart, money, kg, watts, pct, rate, gb, minutes, years, revisit, signed, statusPill } from '../util.js';
import { topBar, optCard, badge, section, grid, concept, issueItem, reqRow, roleMeta } from '../components.js';
import { isSharedTeam, playerFor, ROLE_IDS } from '../../state.js';
import { tx, nameOf, blurbOf, fieldOf, capLabel, launchClassLabel } from '../../i18n.js';
import { satelliteSchematic } from '../satSchematic.js';
import { launchStack, launchStackPanel } from '../launchStack.js';

const tabLabel = (id) => roleMeta(id).name;
const lcl = (cls) => launchClassLabel(cls, LAUNCH_CLASS_LABEL[cls]);

/** In Cadet mode, a known-good design is shown as "Suggested" badges. */
function guideFor(ctx) {
  return ctx.difficulty.hints ? ctx.scenario.guide?.[ctx.priority.id] ?? null : null;
}
const suggests = (guide, group, id) => Boolean(guide && (group === 'instruments' ? guide.instruments?.includes(id) : guide[group] === id));

export function renderDesign(state, m, ctx, preview) {
  const fresh = !m.design.instruments.length;
  const tabs = ROLE_IDS.map((id) => {
    const st = m.roles[id].status;
    const active = state.tab === id;
    const player = playerFor(state, id);
    const startHere = id === 'science' && fresh;
    return `<button type="button" role="tab" class="role-tab role-${id} ${active ? 'is-active' : ''} ${startHere ? 'is-start' : ''}" id="tab-${id}" aria-controls="panel"
        aria-selected="${active}" tabindex="${active ? 0 : -1}" data-action="tab" data-tab="${id}" data-focus="tab-${id}">
      <span class="rt-icon">${icon(ROLE_ICON[id], { size: 18 })}</span>
      <span class="rt-text"><span class="rt-name">${esc(tabLabel(id))}</span><span class="rt-sub">${player ? esc(player) : esc(roleMeta(id).title)}</span></span>
      ${startHere ? `<span class="start-here">${tx('Start here', 'Mulai di sini')}</span>` : `<span class="rt-dot dot-${st}" title="${st}"></span>`}
    </button>`;
  }).join('');

  const panels = { science: scienceTab, launch: launchTab, spacecraft: spacecraftTab, ground: groundTab };
  const online = state.mode === 'online' && state.online?.phase === 'live';
  const locked = online && !state.online.myRoles?.includes(state.tab);
  const lead = !online || state.online.isHost;
  const owner = online ? playerFor(state, state.tab) : null;
  return `${topBar(state, ctx, 'design')}
  <main class="design-layout" id="main">
    <section class="design-main" aria-label="${tx('Design room', 'Ruang desain')}">
      <div class="design-toolbar">
        <div class="role-tabs" role="tablist" aria-label="${tx('Mission roles', 'Peran misi')}">${tabs}</div>
      </div>
      <div class="tab-panel ${locked ? 'is-locked' : ''}" id="panel" role="tabpanel" aria-labelledby="tab-${state.tab}">
        ${locked ? `<p class="lock-note">${icon('alert', { size: 15 })} ${owner
    ? tx(`${owner} leads this station. You can look, not change it.`, `${owner} memimpin stasiun ini. Kamu boleh melihat, tidak mengubahnya.`)
    : tx('This station is not yours. You can look, not change it.', 'Stasiun ini bukan milikmu. Kamu boleh melihat, tidak mengubahnya.')}</p>` : ''}
        ${roleHeader(state, m, state.tab)}
        ${panels[state.tab](state, m, ctx)}
        <div class="panel-foot">
          <button type="button" class="btn btn-ghost btn-sm" data-action="tour">${icon('compass')}<span>${tx('Guided tour', 'Tur terpandu')}</span></button>
          ${lead ? `<button type="button" class="btn btn-ghost btn-sm" data-action="starter">${icon('wand')}<span>${tx('Load starter design', 'Muat desain awal')}</span></button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="reset-design">${icon('refresh')}<span>${tx('Clear design', 'Kosongkan desain')}</span></button>` : ''}
          <button type="button" class="btn btn-ghost btn-sm" data-action="share">${icon('link')}<span>${tx('Copy design link', 'Salin tautan desain')}</span></button>
        </div>
      </div>
    </section>
    <aside class="dashboard" id="dashboard" aria-label="${tx('Mission dashboard', 'Dasbor misi')}">
      ${renderDashboard(state, m, ctx, preview)}
    </aside>
  </main>
  ${mobileBar(m, lead)}`;
}

function roleHeader(state, m, id) {
  const r = roleMeta(id);
  const player = playerFor(state, id);
  let goal = '';
  if (isSharedTeam(state) && m.complete) {
    const o = roleObjectives(m).find((x) => x.role === id);
    goal = `<div class="role-goal ${o.met ? 'is-met' : ''}">${icon(o.met ? 'check' : 'flag', { size: 15 })}<span><strong>${tx('Role goal:', 'Target peran:')}</strong> ${esc(o.goal)} <em>(${esc(o.value)})</em></span></div>`;
  } else if (isSharedTeam(state)) {
    goal = `<div class="role-goal">${icon('flag', { size: 15 })}<span><strong>${tx('Role goal:', 'Target peran:')}</strong> ${esc(roleGoalText(id))}</span></div>`;
  }
  const st = m.roles[id];
  const missing = st.missing.length ? `<p class="role-missing">${icon('clock', { size: 14 })} ${tx('Still to choose:', 'Belum dipilih:')} ${st.missing.map((x) => esc(x.label)).join(', ')}</p>` : '';
  return `<div class="role-head role-${id}">
    <span class="role-icon">${icon(ROLE_ICON[id], { size: 26 })}</span>
    <div class="role-text">
      <p class="eyebrow">${esc(r.segment)}${player ? ` · ${icon('user', { size: 12 })} ${esc(player)}` : ''}</p>
      <h2>${esc(r.title)}</h2>
      <p class="role-blurb">${esc(r.blurb)}</p>
      ${missing}
    </div>
    <div class="role-status">${statusPill(st.status)}</div>
    ${goal}
  </div>`;
}

function roleGoalText(id) {
  return {
    science: tx('Reach at least 90% of the science target', 'Capai minimal 90% target sains'),
    launch: tx('Meet the coverage needs with a right-sized rocket', 'Penuhi kebutuhan cakupan dengan roket yang pas ukurannya'),
    spacecraft: tx('Keep mass and power margins of at least 10%', 'Jaga margin massa dan daya minimal 10%'),
    ground: tx('Deliver 98% of data while ground costs stay under 25% of budget', 'Kirim 98% data dengan biaya darat di bawah 25% anggaran'),
  }[id];
}

const S = () => ({
  mass: tx('Mass', 'Massa'), power: tx('Power', 'Daya'), cost: tx('Cost', 'Biaya'), data: 'Data', trl: 'TRL',
});

// ---------------- Science ----------------
function scienceTab(state, m, ctx) {
  const d = m.design;
  const lead = state.mode !== 'online' || state.online?.phase !== 'live' || state.online.isHost;
  const bus = m.bus;
  const guide = guideFor(ctx);
  const L = S();
  const weights = { ...ctx.scenario.weights, ...(ctx.priority.weights ?? {}) };
  const all = INSTRUMENTS.map((i) => ({ i, w: weights[i.cap] ?? 0 }));
  const rec = all.filter((x) => x.w > 0).sort((a, b) => b.w - a.w || a.i.cost - b.i.cost);
  const other = all.filter((x) => x.w === 0);
  const lat = ctx.scenario.target?.lat ?? 0;
  const targetLabel = ctx.scenario.target ? tx(ctx.scenario.target.label, ctx.scenario.target.labelId) : '';

  const card = ({ i, w }) => {
    const selected = d.instruments.includes(i.id);
    let disabled = null;
    if (bus && !bus.sizes.includes(i.size)) disabled = tx(`Too big for a ${nameOf(bus)} (size ${i.size})`, `Terlalu besar untuk ${nameOf(bus)} (ukuran ${i.size})`);
    else if (bus && !selected && d.instruments.length >= bus.slots) disabled = tx(`All ${bus.slots} instrument slots are full`, `Semua ${bus.slots} slot instrumen sudah penuh`);
    let foot = '';
    if (i.img && m.orbit && m.info && m.orbit.body === 'earth' && ctx.scenario.target) {
      const g = imagingGeometry(i.img, m.orbit, m.info, lat, m.count);
      foot = g.covered
        ? `<span class="opt-foot">${icon('orbit', { size: 13 })}<span>${tx('From this orbit:', 'Dari orbit ini:')} <b>${detail(g.res)}</b> ${tx('detail', 'detail')} · ${tx('revisit', 'kunjungan ulang')} <b>${revisit(g.revisit)}</b></span></span>`
        : `<span class="opt-foot is-bad">${icon('orbit', { size: 13 })}<span>${tx(`Cannot see ${targetLabel} from this orbit`, `Tidak bisa melihat ${targetLabel} dari orbit ini`)}</span></span>`;
    } else if (i.img && m.orbit && m.orbit.body !== 'earth') {
      foot = `<span class="opt-foot">${icon('orbit', { size: 13 })}<span>${tx('From this orbit:', 'Dari orbit ini:')} <b>${detail(i.img.res500 * m.orbit.alt / 500)}</b> ${tx('detail', 'detail')}</span></span>`;
    }
    return optCard({
      group: 'instruments', id: i.id, name: nameOf(i), blurb: blurbOf(i), selected, disabled, value: w,
      suggested: suggests(guide, 'instruments', i.id),
      badges: [badge(capLabel(i.cap, CAPABILITIES[i.cap])), badge(i.size, 'size')],
      stats: [[L.mass, kg(i.mass)], [L.power, watts(i.power)], [L.cost, money(i.cost)], [L.data, rate(i.data)], [L.trl, String(i.trl), i.trl < 9 ? 'warn' : '']],
      foot,
    });
  };
  const slots = bus ? `<span class="slots">${icon('layers', { size: 14 })} ${tx('Slots', 'Slot')} ${d.instruments.length} / ${bus.slots}</span>` : `<span class="slots muted">${tx('Choose a bus to see slots', 'Pilih bus untuk melihat slot')}</span>`;
  const sci = m.science;
  const sciBlock = `<div class="science-preview">
      <div class="sp-row"><span>${tx('Expected science return', 'Perkiraan hasil sains')}</span><strong>${num(sci.perYear, 1)} ${tx('pts / yr', 'poin / thn')}</strong></div>
      ${bar(Math.min(1, sci.ratio / 1.2), sci.ratio >= 0.9 ? 'go' : sci.ratio >= 0.6 ? 'caution' : 'nogo', [0.75])}
      <div class="sp-row small"><span>${tx(`${pct(sci.ratio)} of this priority's target`, `${pct(sci.ratio)} dari target prioritas ini`)}</span>${concept('trade-off', tx('How is science scored?', 'Bagaimana sains dinilai?'))}</div>
    </div>`;
  const startCallout = !d.instruments.length
    ? `<div class="start-callout" role="note">${icon('compass', { size: 20 })}<div>
        <p><strong>${tx('Start here: pick 1 or 2 instruments below.', 'Mulai di sini: pilih 1 atau 2 instrumen di bawah.')}</strong></p>
        <p class="small">${tx('Instruments with three green bars matter most for this mission. Not sure? Load a starter design or take the guided tour.',
          'Instrumen dengan tiga bar hijau paling penting untuk misi ini. Ragu? Muat desain awal atau ikuti tur terpandu.')}</p>
        <div class="callout-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-action="tour">${icon('compass', { size: 15 })}<span>${tx('Take the 1-minute tour', 'Ikuti tur 1 menit')}</span></button>
          ${lead ? `<button type="button" class="btn btn-ghost btn-sm" data-action="starter">${icon('wand', { size: 15 })}<span>${tx('Load starter design', 'Muat desain awal')}</span></button>` : ''}
        </div></div></div>`
    : '';
  const cadetNote = guide ? `<p class="cadet-note">${icon('compass', { size: 14 })} ${tx('Cadet mode: options marked "Suggested" add up to a design that works. You can still pick anything.',
    'Mode Kadet: pilihan bertanda "Disarankan" membentuk desain yang berhasil. Kamu tetap bebas memilih apa saja.')}</p>` : '';

  return `${startCallout}${cadetNote}
    ${requirementsFor(m, ['science'])}
    ${sciBlock}
    ${section(tx('Instruments', 'Instrumen'), grid(rec.map(card)), { aside: slots, tour: 'instruments',
      sub: tx('What your mission measures', 'Apa yang diukur misimu'),
      hint: tx('Ranked by value for this mission. Each one adds mass, power, data and cost: watch the dashboard as you hover.',
        'Diurutkan menurut nilainya untuk misi ini. Setiap instrumen menambah massa, daya, data, dan biaya: perhatikan dasbor saat mengarahkan kursor.') })}
    <details class="more" ${state.showOtherInstruments ? 'open' : ''} data-action="toggle-others">
      <summary>${icon('down', { size: 14 })} ${tx(`Other instruments (${other.length}): no value for this objective`, `Instrumen lain (${other.length}): tidak berguna untuk tujuan ini`)}</summary>
      ${grid(other.map(card))}
    </details>`;
}

function detail(meters) {
  if (meters >= 1000) return `${num(meters / 1000, meters >= 10000 ? 0 : 1)} km`;
  return `${num(meters, meters < 10 ? 1 : 0)} m`;
}

// ---------------- Orbit & launch ----------------
function launchTab(state, m, ctx) {
  const d = m.design;
  const guide = guideFor(ctx);
  const orbitCards = ORBITS.map((o) => {
    const info = orbitInfo(o);
    const stats = [
      [tx('Altitude', 'Ketinggian'), o.body === 'l1' ? tx('1.5M km', '1,5 jt km') : `${num(o.alt)} km`],
      [tx('Period', 'Periode'), o.body === 'l1' ? tx('~6 months', '~6 bulan') : (info.periodMin >= 1440 ? tx('24 h', '24 jam') : minutes(info.periodMin))],
      [tx('Eclipse', 'Gerhana'), info.eclipseMin > 0 ? tx(`${num(info.eclipseMin)} min`, `${num(info.eclipseMin)} mnt`) : tx('none', 'tidak ada')],
    ];
    if (ctx.scenario.id === 'archipelago') stats.push([tx('Over Indonesia', 'Di atas Indonesia'), Number.isFinite(o.passes) ? tx(`${num(o.passes, 1)}×/day`, `${num(o.passes, 1)}×/hari`) : tx('nonstop', 'tanpa henti'), o.passes >= 8 ? 'good' : '']);
    else stats.push([tx('Inclination', 'Inklinasi'), `${o.inc}°`]);
    const fits = (ctx.scenario.id === 'lunar' && o.body === 'moon') || (ctx.scenario.id === 'solar' && o.body === 'l1') || (['semeru', 'archipelago'].includes(ctx.scenario.id) && o.body === 'earth');
    return optCard({
      group: 'orbit', id: o.id, name: nameOf(o), blurb: blurbOf(o), selected: d.orbit === o.id, suggested: suggests(guide, 'orbit', o.id),
      disabled: fits ? null : tx(`Wrong destination for ${ctx.scenario.name}`, `Tujuan yang salah untuk ${ctx.scenario.name}`),
      badges: [badge(o.short.split('·')[0].trim(), 'size')], stats,
    });
  });

  const fleet = `<div class="fleet">
      <div class="fleet-ctrl" role="group" aria-label="${tx('Number of spacecraft', 'Jumlah wahana')}">
        <button type="button" class="btn btn-icon" data-action="count" data-delta="-1" aria-label="${tx('One fewer spacecraft', 'Kurangi satu wahana')}" ${d.count <= 1 ? 'disabled' : ''} data-focus="count-minus">${icon('minus')}</button>
        <output class="fleet-n" aria-live="polite">${d.count}</output>
        <button type="button" class="btn btn-icon" data-action="count" data-delta="1" aria-label="${tx('One more spacecraft', 'Tambah satu wahana')}" ${d.count >= 8 ? 'disabled' : ''} data-focus="count-plus">${icon('plus')}</button>
      </div>
      <p class="fleet-text">${d.count === 1 ? tx('A single spacecraft.', 'Satu wahana.') : tx(`A constellation of ${d.count} identical spacecraft, evenly spaced.`, `Konstelasi ${d.count} wahana identik dengan jarak merata.`)}
        ${tx('More spacecraft divide revisit time and multiply passes, but every one adds hardware, launch mass and operations cost.',
          'Wahana lebih banyak membagi waktu kunjungan ulang dan melipatgandakan lintasan, tapi setiap wahana menambah biaya perangkat keras, massa peluncuran, dan operasi.')} ${concept('constellation', tx('Constellations', 'Konstelasi'))}</p>
    </div>`;

  const lc = m.orbit?.launchClass;
  const launcherCards = LAUNCHERS.map((lv) => {
    let disabled = null;
    if (lc && lv.caps[lc] === 0) disabled = tx(`Can't reach ${lcl(lc)}`, `Tidak bisa mencapai ${lcl(lc)}`);
    else if (m.bus && lv.buses && !lv.buses.includes(m.bus.id)) disabled = tx('Rideshare slots take CubeSats and SmallSats only', 'Slot rideshare hanya untuk CubeSat dan SmallSat');
    const cost = launchCost(lv, m.mass.wet || 0, d.count, lc);
    const stats = [];
    if (lc) {
      const cap = lv.caps[lc];
      const used = cap ? m.mass.fleet / cap : 0;
      stats.push([tx('Capacity', 'Kapasitas'), `${num(cap)} kg`, cap && m.mass.fleet > cap ? 'bad' : '']);
      if (cap && m.bus) stats.push([tx('Used', 'Terpakai'), pct(used), used > 1 ? 'bad' : used < 0.25 ? 'warn' : 'good']);
    } else {
      stats.push(['LEO', `${num(lv.caps.leo)} kg`], [tx('Deep space', 'Antariksa jauh'), `${num(lv.caps.deep)} kg`]);
    }
    stats.push([tx('Cost', 'Biaya'), lv.rideshare ? (m.bus ? money(cost) : tx('per kg', 'per kg')) : money(lv.cost)], [tx('Success', 'Sukses'), pct(lv.reliability)]);
    return optCard({
      group: 'launcher', id: lv.id, name: nameOf(lv), blurb: blurbOf(lv), selected: d.launcher === lv.id, disabled, stats,
      suggested: suggests(guide, 'launcher', lv.id),
      foot: `<span class="opt-foot">${icon('rocket', { size: 13 })}<span>${tx('e.g.', 'mis.')} ${esc(fieldOf(lv, 'examples'))}</span></span>`,
    });
  });

  return `${requirementsFor(m, ['launch'])}
    ${section(tx('Orbit', 'Orbit'), grid(orbitCards), { sub: tx('Where the spacecraft flies', 'Ke mana wahana terbang'),
      hint: `${tx('Where should the spacecraft fly?', 'Ke mana wahana sebaiknya terbang?')} ${concept('inclination', tx('Inclination & coverage', 'Inklinasi & cakupan'))} ${concept('kepler', tx('Orbital period', 'Periode orbit'))}` })}
    ${section(tx('Fleet size', 'Jumlah armada'), fleet, { sub: tx('How many identical spacecraft', 'Berapa banyak wahana identik') })}
    ${section(tx('Launch vehicle', 'Roket peluncur'), grid(launcherCards), { sub: tx('The rocket that gets you there', 'Roket yang mengantarmu ke sana'),
      hint: lc ? tx(`Capacities shown for ${lcl(lc)}. Your ${d.count > 1 ? 'fleet' : 'spacecraft'}: <b>${kg(m.mass.fleet)}</b>.`, `Kapasitas untuk ${lcl(lc)}. ${d.count > 1 ? 'Armadamu' : 'Wahanamu'}: <b>${kg(m.mass.fleet)}</b>.`)
        : tx('Choose an orbit first to see capacities for that destination.', 'Pilih orbit dulu untuk melihat kapasitas ke tujuan itu.') })}`;
}

// ---------------- Spacecraft ----------------
function spacecraftTab(state, m, ctx) {
  const d = m.design;
  const bus = m.bus;
  const guide = guideFor(ctx);
  const L = S();
  const needBus = bus ? null : tx('Choose a bus first', 'Pilih bus dulu');
  const busCards = BUSES.map((b) => optCard({
    group: 'bus', id: b.id, name: nameOf(b), blurb: blurbOf(b), selected: d.bus === b.id, suggested: suggests(guide, 'bus', b.id),
    stats: [[tx('Max mass', 'Massa maks'), `${num(b.maxMass)} kg`], [tx('Slots', 'Slot'), `${b.slots} (${b.sizes.join('/')})`], [L.cost, money(b.cost)], [tx('Build time', 'Waktu bangun'), tx(`${b.devMonths} mo`, `${b.devMonths} bln`)]],
  }));

  const solarCards = SOLAR.map((s) => {
    const spec = bus ? s.byBus[bus.id] : null;
    const disabled = needBus ?? (spec ? null : tx(`Not made for a ${nameOf(bus)}`, `Tidak dibuat untuk ${nameOf(bus)}`));
    const stats = spec
      ? [[tx('Power (new)', 'Daya (baru)'), watts(arrayPowerBOL(spec.area, s.cos))], [tx('Area', 'Luas'), `${smart(spec.area)} m²`], [L.mass, kg(spec.mass)], [L.cost, money(spec.cost)]]
      : [[tx('Sun angle', 'Sudut Matahari'), pct(s.cos)]];
    return optCard({ group: 'solar', id: s.id, name: nameOf(s), blurb: blurbOf(s), selected: d.solar === s.id, disabled, stats, suggested: suggests(guide, 'solar', s.id) });
  }).filter((_, i) => bus || i < 3);

  const eclipseWh = m.batteryInfo.eclipseEnergy;
  const batteryCards = BATTERIES.filter((b) => !bus || b.buses.includes(bus.id)).map((b) => {
    const dod = eclipseWh > 0 ? eclipseWh / (b.wh * 0.9) : 0;
    const stats = [[tx('Capacity', 'Kapasitas'), `${num(b.wh)} Wh`], [L.mass, kg(b.mass)], [L.cost, money(b.cost)]];
    if (m.orbit && m.power.eclipseMin > 0 && bus) stats.push([tx('Drain / eclipse', 'Terkuras / gerhana'), pct(Math.min(dod, 9.99)), dod > 0.8 ? 'bad' : dod > 0.4 ? 'warn' : 'good']);
    return optCard({ group: 'battery', id: b.id, name: nameOf(b), selected: d.battery === b.id, disabled: needBus, stats, suggested: suggests(guide, 'battery', b.id) });
  });

  const s = bus?.scale ?? 1;
  const adcsCards = ADCS.map((a) => optCard({
    group: 'adcs', id: a.id, name: nameOf(a), blurb: blurbOf(a), selected: d.adcs === a.id, suggested: suggests(guide, 'adcs', a.id),
    disabled: a.earthFieldOnly && m.orbit && m.orbit.commsClass !== 'leo' ? tx('Needs Earth\'s magnetic field (low orbit only)', 'Butuh medan magnet Bumi (hanya orbit rendah)') : null,
    stats: [[tx('Pointing', 'Ketepatan'), `${a.accuracy}°`], [L.mass, kg(a.mass * s)], [L.power, watts(a.power * s ** 0.6)], [L.cost, money(a.cost * s ** 0.8)]],
  }));

  const propCards = PROPULSION.map((p) => optCard({
    group: 'propulsion', id: p.id, name: nameOf(p), blurb: blurbOf(p), selected: d.propulsion === p.id, suggested: suggests(guide, 'propulsion', p.id),
    disabled: bus && p.buses && !p.buses.includes(bus.id) ? tx('Too big for CubeSats', 'Terlalu besar untuk CubeSat') : null,
    stats: p.isp ? [['Isp', `${p.isp} s`], [tx('Dry mass', 'Massa kering'), kg(p.dry * s)], [L.cost, money(p.cost * s ** 0.8)]] : [['Delta-v', '0 m/s']],
  }));

  let propPanel = '';
  if (m.prop && m.prop.id !== 'prop-none' && bus) {
    const dv = m.dv;
    const maxP = m.mass.maxProp;
    const rows = [
      [tx('Orbit insertion', 'Masuk orbit'), dv.insertion],
      [tx(`Station-keeping (${num(dv.perYear)} m/s × ${num(dv.skYears, 1)} yr)`, `Menjaga orbit (${num(dv.perYear)} m/s × ${num(dv.skYears, 1)} thn)`), dv.skNeeded],
      [tx('Disposal reserve', 'Cadangan pembuangan'), dv.deorbit],
    ].filter(([, v]) => v > 0);
    propPanel = `<div class="prop-panel">
      <label class="prop-label" for="propellant">${tx('Propellant load', 'Muatan propelan')} <output>${smart(m.mass.propellant)} kg</output> <span class="muted">${tx(`of ${smart(maxP)} kg tank`, `dari tangki ${smart(maxP)} kg`)}</span></label>
      <input id="propellant" type="range" min="0" max="${maxP}" step="${maxP > 50 ? 1 : 0.1}" value="${m.mass.propellant}" data-action="propellant" data-focus="propellant" />
      <div class="prop-readout">
        <div class="dv-big"><span class="muted">Delta-v</span><strong>${num(dv.available)} m/s</strong><span class="muted">${tx('needed', 'dibutuhkan')} ${num(dv.needed)} m/s</span></div>
        <ul class="dv-list">${rows.map(([k, v]) => `<li><span>${esc(k)}</span><span>${num(v)} m/s</span></li>`).join('') || `<li><span>${tx('No maneuvers required by this orbit', 'Orbit ini tidak butuh manuver')}</span><span></span></li>`}</ul>
        <button type="button" class="btn btn-secondary btn-sm" data-action="autoprop">${icon('wand')}<span>${tx('Auto-size for the mission', 'Hitung otomatis untuk misi')}</span></button>
      </div>
      <p class="formula">Δv = Isp × g₀ × ln(${tx('wet', 'basah')} ÷ ${tx('dry', 'kering')}) = ${m.prop.isp} × 9.81 × ln(${smart(m.mass.wet)} ÷ ${smart(m.mass.dry)}) ${concept('delta-v', tx('Rocket equation', 'Persamaan roket'))}</p>
    </div>`;
  }

  const eclipseHint = m.orbit
    ? (m.power.eclipseMin > 0
      ? tx(`This orbit has ${num(m.power.eclipseMin)}-minute eclipses every ${minutes(m.info.periodMin)}.`, `Orbit ini mengalami gerhana ${num(m.power.eclipseMin)} menit setiap ${minutes(m.info.periodMin)}.`)
      : tx('This orbit has no eclipses.', 'Orbit ini tidak mengalami gerhana.'))
    : '';
  return `${requirementsFor(m, ['spacecraft'])}
    ${section(tx('Spacecraft bus', 'Bus wahana'), grid(busCards), { sub: tx('The body: structure, computer and wiring', 'Badan wahana: struktur, komputer, dan kabel') })}
    ${section(tx('Solar arrays', 'Panel surya'), grid(solarCards), { sub: tx('Make electricity from sunlight', 'Membangkitkan listrik dari sinar Matahari'), hint: `${eclipseHint} ${concept('power', tx('Power budget', 'Anggaran daya'))}` })}
    ${section(tx('Battery', 'Baterai'), grid(batteryCards), { sub: tx('Stores power for the dark part of each orbit', 'Menyimpan daya untuk bagian gelap setiap orbit'),
      hint: `${tx('Runs the spacecraft in Earth\'s (or the Moon\'s) shadow.', 'Menjalankan wahana saat berada di bayangan Bumi (atau Bulan).')} ${concept('battery', tx('Depth of discharge', 'Kedalaman pengosongan'))}` })}
    ${section(tx('Attitude control (ADCS)', 'Kendali sikap (ADCS)'), grid(adcsCards), { sub: tx('How the spacecraft points itself', 'Cara wahana mengarahkan dirinya'),
      hint: `${tx('Instruments and antennas need steady pointing.', 'Instrumen dan antena butuh arah yang stabil.')} ${concept('attitude', tx('Pointing', 'Pengarahan'))}` })}
    ${section(tx('Propulsion', 'Propulsi'), grid(propCards) + propPanel, { sub: tx('Thrusters to change or keep the orbit', 'Pendorong untuk mengubah atau menjaga orbit'), hint: `${concept('isp', tx('Specific impulse', 'Impuls spesifik'))}` })}`;
}

// ---------------- Ground & comms ----------------
function groundTab(state, m, ctx) {
  const d = m.design;
  const guide = guideFor(ctx);
  const L = S();
  const cc = m.orbit?.commsClass;
  const radioCards = RADIOS.map((r) => {
    const disabled = m.bus && r.buses && !r.buses.includes(m.bus.id) ? tx('Needs a SmallSat or larger', 'Butuh SmallSat atau lebih besar') : null;
    const stats = [[tx('Band', 'Pita'), r.band]];
    if (cc) stats.push([tx('Rate here', 'Laju di sini'), r.rates[cc] ? rate(r.rates[cc]) : tx('no link', 'tidak tersambung'), r.rates[cc] ? '' : 'bad']);
    else stats.push([tx('Rate (LEO)', 'Laju (LEO)'), rate(r.rates.leo)]);
    stats.push([L.mass, kg(r.mass)], [L.power, watts(r.power)], [L.cost, money(r.cost)]);
    return optCard({ group: 'radio', id: r.id, name: nameOf(r), blurb: blurbOf(r), selected: d.radio === r.id, disabled, stats, suggested: suggests(guide, 'radio', r.id) });
  });
  const netCards = NETWORKS.map((n) => {
    const contact = m.orbit ? (m.orbit.contact[n.id] ?? 0) : null;
    let disabled = null;
    if (m.orbit && contact === 0) disabled = n.deepSpace ? tx('Reserved for missions beyond Earth orbit', 'Khusus misi di luar orbit Bumi') : tx('Too small to hear a spacecraft this far away', 'Terlalu kecil untuk mendengar wahana sejauh ini');
    const stats = [[tx('Bands', 'Pita'), n.bands.join(' · ')], [tx('Contact', 'Kontak'), contact == null ? tx('pick orbit', 'pilih orbit') : tx(`${minutes(contact)}/day`, `${minutes(contact)}/hari`)], [tx('Setup', 'Persiapan'), money(n.setup)], [tx('Per year', 'Per tahun'), money(n.perYear)]];
    return optCard({ group: 'network', id: n.id, name: nameOf(n), blurb: blurbOf(n), selected: d.network === n.id, disabled, stats, suggested: suggests(guide, 'network', n.id) });
  });
  const opsCards = OPS.map((o) => optCard({
    group: 'ops', id: o.id, name: nameOf(o), blurb: blurbOf(o), selected: d.ops === o.id, suggested: suggests(guide, 'ops', o.id),
    stats: [[tx('Team', 'Tim'), fieldOf(o, 'people')], [tx('Per year', 'Per tahun'), money(o.perYear)], [tx('Fixes problems', 'Memperbaiki masalah'), pct(o.recovery)]],
  }));

  const c = m.comms;
  const flow = m.insts.length && m.radio && m.network && m.orbit
    ? `<div class="dataflow">
        <div class="df-node"><span class="muted">${tx('Instruments make', 'Instrumen menghasilkan')}</span><strong>${gb(c.generatedGB)}</strong><span class="muted">${tx('per day', 'per hari')}</span></div>
        <div class="df-arrow ${c.delivery >= 0.98 ? 'ok' : 'bad'}">${icon('right', { size: 20 })}<span>${tx(`${pct(c.delivery)} delivered`, `${pct(c.delivery)} terkirim`)}</span></div>
        <div class="df-node"><span class="muted">${tx('Downlink can carry', 'Downlink mampu membawa')}</span><strong>${gb(c.downlinkGB)}</strong><span class="muted">${rate(c.rate)} × ${minutes(c.contactMin)}</span></div>
      </div>`
    : '';
  return `${requirementsFor(m, ['ground'])}
    ${flow}
    ${section(tx('Radio', 'Radio'), grid(radioCards), { sub: tx('Sends data home', 'Mengirim data pulang'), hint: `${tx('Signals weaken with the square of distance.', 'Sinyal melemah sebanding kuadrat jarak.')} ${concept('data-rate', tx('Data budget', 'Anggaran data'))}` })}
    ${section(tx('Ground network', 'Jaringan stasiun bumi'), grid(netCards), { sub: tx('Antennas on Earth that listen', 'Antena di Bumi yang mendengarkan'), hint: `${concept('dsn', 'Deep Space Network')}` })}
    ${section(tx('Operations team', 'Tim operasi'), grid(opsCards), { sub: tx('People who fly the mission', 'Orang-orang yang menerbangkan misi'),
      hint: tx('Your team plans every day of the mission and fixes anomalies. Better teams cost more each year.', 'Timmu merencanakan setiap hari misi dan memperbaiki anomali. Tim yang lebih baik lebih mahal setiap tahun.') })}`;
}

function requirementsFor(m, roles) {
  const rows = m.reqResults.filter((r) => roles.includes(r.role));
  if (!rows.length) return '';
  return `<ul class="req-list req-inline">${rows.map((r) => reqRow(r.label, r.pass, r.value, !m.complete)).join('')}</ul>`;
}

// ---------------- Dashboard ----------------
function bar(fill, tone, marks = []) {
  const w = Math.max(0, Math.min(1, fill)) * 100;
  return `<div class="bar bar-${tone}" aria-hidden="true"><span class="bar-fill" style="width:${w.toFixed(1)}%"></span>${marks.map((x) => `<i class="bar-mark" style="left:${(x * 100).toFixed(1)}%"></i>`).join('')}</div>`;
}

function delta(v, unit, goodWhen, digits = 1, threshold = 0.05) {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < threshold) return '';
  const good = goodWhen === 'up' ? v > 0 : v < 0;
  return `<span class="delta ${good ? 'is-good' : 'is-bad'}">${signed(v, unit, digits)}</span>`;
}

/** Top dashboard panel: the 3D launch stack, or the flat spacecraft schematic. */
function assemblyPanel(state, m, p) {
  if (state.rocket3dFailed) return satelliteSchematic(m, p);
  const view = state.stackView === 'sat' ? 'sat' : 'rocket';
  const btn = (id, ic, label) => `<button type="button" class="asm-btn ${view === id ? 'is-on' : ''}" aria-pressed="${view === id}"
      data-action="stack-view" data-id="${id}" data-focus="asm-${id}">${icon(ic, { size: 14 })}<span>${label}</span></button>`;
  return `<div class="asm">
    <div class="asm-switch" role="group" aria-label="${tx('Assembly view', 'Tampilan rakitan')}">
      ${btn('rocket', 'rocket', tx('Rocket 3D', 'Roket 3D'))}${btn('sat', 'satellite', tx('Schematic', 'Skema'))}
    </div>
    ${view === 'rocket' ? launchStackPanel(launchStack(m, p)) : satelliteSchematic(m, p)}
  </div>`;
}

export function renderDashboard(state, m, ctx, p) {
  const c = m.cost;
  const onlineLive = state.mode === 'online' && state.online?.phase === 'live';
  const lead = !onlineLive || state.online.isHost;
  const spend = c.spend;
  const total = Math.max(c.total, 0.0001);
  const budgetTone = c.total > c.cap ? 'nogo' : c.margin < 0.1 ? 'caution' : 'go';
  const split = ['science', 'spacecraft', 'launch', 'ground']
    .map((r) => `<span class="split-seg role-bg-${r}" style="width:${((spend[r] / Math.max(c.cap, total)) * 100).toFixed(2)}%" title="${esc(roleMeta(r).name)}: ${money(spend[r])}"></span>`).join('');
  const pts = tx(' pts', ' poin');

  const g = gaugeList(m, p);
  const gauges = g.map((x) => {
    const open = state.openGauge === x.id;
    return `<li class="gauge st-${x.status} ${open ? 'is-open' : ''}">
      <button type="button" class="gauge-head" data-action="gauge" data-id="${x.id}" aria-expanded="${open}" data-focus="gauge-${x.id}">
        <span class="g-icon">${icon(x.icon, { size: 16 })}</span>
        <span class="g-label">${x.label}</span>
        <span class="g-value">${x.value}${x.delta ?? ''}</span>
        <span class="g-chev">${icon('down', { size: 14 })}</span>
      </button>
      ${bar(x.fill, x.status === 'incomplete' ? 'muted' : x.status, x.marks ?? [])}
      <div class="g-sub">${x.sub}</div>
      ${open ? `<div class="g-detail">${x.detail}</div>` : ''}
    </li>`;
  }).join('');

  const reqs = m.reqResults.map((r) => reqRow(r.label, r.pass, r.value, !m.complete)).join('')
    + m.constraints.map((r) => reqRow(r.label, r.pass, r.value, !m.complete)).join('');
  const visibleIssues = m.issues.filter((i) => !i.id.startsWith('req-'));
  const shown = visibleIssues.slice(0, 5);
  const more = visibleIssues.length - shown.length;
  const missingCount = m.missing.length;

  const sciDelta = p ? delta((p.science.ratio - m.science.ratio) * 100, pts, 'up', 0, 0.5) : '';
  const costDelta = p ? delta(p.cost.total - m.cost.total, 'M', 'down', 1, 0.05) : '';

  return `<div class="dash-inner">
    ${assemblyPanel(state, m, p)}
    <div class="dash-block budget-block">
      <div class="dash-row"><span class="dash-label">${icon('coins', { size: 16 })} ${tx('Budget', 'Anggaran')}</span>${statusPill(m.complete ? budgetTone : (c.total > c.cap ? 'nogo' : 'incomplete'))}</div>
      <div class="budget-big"><strong>${money(c.total)}</strong>${costDelta}<span class="muted"> ${tx('of', 'dari')} ${money(c.cap)}</span></div>
      <div class="split" aria-hidden="true">${split}</div>
      <div class="split-legend">${['science', 'spacecraft', 'launch', 'ground'].map((r) => `<span><i class="role-bg-${r}"></i>${esc(roleMeta(r).name)} ${money(spend[r])}</span>`).join('')}</div>
    </div>
    <div class="dash-block">
      <div class="dash-row"><span class="dash-label">${icon('flask', { size: 16 })} ${tx('Science return', 'Hasil sains')}</span><span class="mono">${pct(m.science.ratio)}${sciDelta}</span></div>
      ${bar(Math.min(1, m.science.ratio / 1.2), m.science.ratio >= 0.9 ? 'go' : m.science.ratio >= 0.6 ? 'caution' : 'nogo', [0.75])}
      <div class="g-sub">${tx(`of target · ${num(m.science.perYear, 1)} pts/yr`, `dari target · ${num(m.science.perYear, 1)} poin/thn`)}</div>
    </div>
    <ul class="gauges">${gauges}</ul>
    <div class="dash-block">
      <h3 class="dash-h">${tx('Requirements', 'Requirement')}</h3>
      <ul class="req-list">${reqs}</ul>
    </div>
    <div class="dash-block" data-tour="notes">
      <h3 class="dash-h">${tx('Flight Director\'s notes', 'Catatan Flight Director')} ${visibleIssues.length ? `<span class="count">${visibleIssues.length}</span>` : ''}</h3>
      ${shown.length ? `<ul class="issues">${shown.map(issueItem).join('')}</ul>` : `<p class="muted small">${m.complete
    ? tx('No problems found. Check the margins, then call the Go/No-Go poll.', 'Tidak ada masalah. Periksa margin, lalu mulai poll Go/No-Go.')
    : tx('Notes appear as you design.', 'Catatan muncul saat kamu mendesain.')}</p>`}
      ${more > 0 ? `<p class="muted small">${tx(`+${more} more note${more > 1 ? 's' : ''} in the Go/No-Go poll.`, `+${more} catatan lain di poll Go/No-Go.`)}</p>` : ''}
    </div>
    <div class="dash-cta">
      <button type="button" class="btn btn-primary btn-block" data-action="go" data-screen="gonogo" data-focus="to-gonogo" ${lead ? '' : 'disabled'}>
        ${icon('flag')}<span>${lead
    ? tx('Call the Go/No-Go poll', 'Mulai poll Go/No-Go')
    : tx('Waiting for the flight director', 'Menunggu flight director')}</span>
      </button>
      ${missingCount ? `<p class="muted small center">${tx(`${missingCount} choice${missingCount > 1 ? 's' : ''} still open`, `${missingCount} pilihan belum diisi`)}</p>` : ''}
    </div>
  </div>`;
}

function gaugeList(m, p) {
  const st = m.statuses;
  const mass = m.mass;
  const pw = m.power;
  const cm = m.comms;
  const pts = tx(' pts', ' poin');
  const list = [];

  list.push({
    id: 'mass', label: tx('Mass', 'Massa'), icon: 'weight', status: st.mass,
    value: m.bus ? `${kg(mass.wet)} / ${kg(mass.busMax)}` : '–',
    delta: p && p.bus ? delta(p.mass.wet - mass.wet, ' kg', 'down', 1, 0.05) : '',
    fill: m.bus ? Math.max(mass.wet / mass.busMax, mass.launchCap ? mass.fleet / mass.launchCap : 0) : 0,
    marks: [0.9],
    sub: m.bus
      ? `${tx('Margin', 'Margin')} ${pct(mass.margin)}${m.launcher && mass.launchCap ? tx(` · rocket carries ${kg(mass.launchCap)}${m.count > 1 ? `, fleet ${kg(mass.fleet)}` : ''}`, ` · roket membawa ${kg(mass.launchCap)}${m.count > 1 ? `, armada ${kg(mass.fleet)}` : ''}`) : ''}`
      : tx('Choose a bus', 'Pilih bus'),
    detail: `<ul class="kv">${m.parts.list.map((x) => `<li><span>${esc(x.label)}</span><span>${kg(x.mass)}</span></li>`).join('')}
      <li><span>${tx('Cabling, brackets, thermal (7%)', 'Kabel, braket, termal (7%)')}</span><span>${kg(m.parts.harnessMass)}</span></li>
      <li><span>${tx('Propellant', 'Propelan')}</span><span>${kg(mass.propellant)}</span></li>
      <li class="kv-total"><span>${tx('Fueled (wet) mass', 'Massa basah (berbahan bakar)')}</span><span>${kg(mass.wet)}</span></li></ul>
      ${concept('margin', tx('Why keep margin?', 'Kenapa perlu margin?'))}`,
  });
  list.push({
    id: 'power', label: tx('Power', 'Daya'), icon: 'bolt', status: st.power,
    value: m.solarSpec && m.orbit ? `${watts(pw.reqArray)} / ${watts(pw.genEOL)}` : '–',
    delta: p && p.solarSpec && p.orbit && m.solarSpec && m.orbit ? delta((p.power.margin - pw.margin) * 100, pts, 'up', 0, 0.5) : '',
    fill: pw.genEOL > 0 ? pw.reqArray / pw.genEOL : 0,
    marks: [0.9],
    sub: m.solarSpec && m.orbit ? tx(`Needed vs available at end of life · margin ${pct(pw.margin)}`, `Dibutuhkan vs tersedia di akhir misi · margin ${pct(pw.margin)}`) : tx('Choose arrays and an orbit', 'Pilih panel dan orbit'),
    detail: `<ul class="kv">${m.parts.list.filter((x) => x.power > 0).map((x) => `<li><span>${esc(x.label)}</span><span>${watts(x.power)}</span></li>`).join('')}
      <li><span>${tx('Heaters & thermal control (8%)', 'Pemanas & kendali termal (8%)')}</span><span>${watts(m.parts.thermalPower)}</span></li>
      <li class="kv-total"><span>${tx('Average load', 'Beban rata-rata')}</span><span>${watts(pw.load)}</span></li>
      <li><span>${tx('Array power needed (load + recharge)', 'Daya panel yang dibutuhkan (beban + isi ulang)')}</span><span>${watts(pw.reqArray)}</span></li>
      <li><span>${tx('Array power, new → end of life', 'Daya panel, baru → akhir misi')}</span><span>${watts(pw.genBOL)} → ${watts(pw.genEOL)}</span></li>
      <li><span>${tx('Eclipse per orbit', 'Gerhana per orbit')}</span><span>${tx(`${num(pw.eclipseMin)} min`, `${num(pw.eclipseMin)} mnt`)}</span></li>
      <li><span>${tx('Battery drain per eclipse', 'Baterai terkuras per gerhana')}</span><span>${pct(Math.min(m.batteryInfo.dod, 9.99))}</span></li>
      <li><span>${tx('Battery life', 'Umur baterai')}</span><span>${years(m.batteryInfo.life)}</span></li></ul>
      ${concept('power', tx('Power budget', 'Anggaran daya'))} ${concept('battery', tx('Battery wear', 'Keausan baterai'))}`,
  });
  list.push({
    id: 'data', label: 'Data', icon: 'database', status: st.data,
    value: m.insts.length ? tx(`${gb(cm.generatedGB)}/day`, `${gb(cm.generatedGB)}/hari`) : '–',
    delta: p && p.radio && p.network && m.radio && m.network ? delta((p.comms.delivery - cm.delivery) * 100, pts, 'up', 0, 0.5) : '',
    fill: cm.downlinkGB > 0 ? cm.generatedGB / cm.downlinkGB : cm.generatedGB > 0 ? 1 : 0,
    marks: [1],
    sub: m.radio && m.network ? tx(`Downlink capacity ${gb(cm.downlinkGB)}/day · ${pct(cm.delivery)} delivered`, `Kapasitas downlink ${gb(cm.downlinkGB)}/hari · ${pct(cm.delivery)} terkirim`) : tx('Generated by instruments', 'Dihasilkan instrumen'),
    detail: `<ul class="kv">${m.insts.map((i) => `<li><span>${esc(nameOf(i))}</span><span>${tx(`${gb(i.data * i.duty * 86400 / 8000)}/day`, `${gb(i.data * i.duty * 86400 / 8000)}/hari`)}</span></li>`).join('')}
      <li class="kv-total"><span>${tx('Generated per day', 'Dihasilkan per hari')}</span><span>${gb(cm.generatedGB)}</span></li>
      <li><span>Downlink: ${rate(cm.rate)} × ${minutes(cm.contactMin)}</span><span>${gb(cm.downlinkGB)}</span></li></ul>
      ${concept('data-rate', tx('Data budget', 'Anggaran data'))}`,
  });
  list.push({
    id: 'comms', label: tx('Comms', 'Komunikasi'), icon: 'signal', status: st.comms,
    value: m.radio && m.network && m.orbit ? (cm.linkCloses ? rate(cm.rate) : tx('no link', 'tidak tersambung')) : '–',
    delta: p && p.radio && p.network && p.orbit && m.radio && m.network && m.orbit && p.comms.rate !== cm.rate
      ? `<span class="delta ${p.comms.rate > cm.rate ? 'is-good' : 'is-bad'}">→ ${rate(p.comms.rate)}</span>` : '',
    fill: Math.min(1, cm.contactMin / 1440),
    sub: m.radio && m.network && m.orbit
      ? tx(`${minutes(cm.contactMin)} of contact per day via ${esc(nameOf(m.network).split(':')[0])}`, `${minutes(cm.contactMin)} kontak per hari lewat ${esc(nameOf(m.network).split(':')[0])}`)
      : tx('Choose a radio, network and orbit', 'Pilih radio, jaringan, dan orbit'),
    detail: `<ul class="kv"><li><span>Radio</span><span>${esc(m.radio ? nameOf(m.radio) : '–')}</span></li>
      <li><span>${tx('Ground network', 'Jaringan darat')}</span><span>${esc(m.network ? nameOf(m.network) : '–')}</span></li>
      <li><span>${tx('Band supported', 'Pita didukung')}</span><span>${cm.bandOk ? tx('yes', 'ya') : tx('no', 'tidak')}</span></li>
      <li><span>${tx('Contact per day', 'Kontak per hari')}</span><span>${minutes(cm.contactMin)}</span></li>
      <li><span>${tx('Link rate', 'Laju tautan')}</span><span>${rate(cm.rate)}</span></li></ul>${concept('dsn', tx('Ground networks', 'Jaringan darat'))}`,
  });
  list.push({
    id: 'time', label: tx('Time', 'Waktu'), icon: 'clock', status: st.time,
    value: m.bus && m.orbit ? tx(`${years(m.life.mission)} life`, `umur ${years(m.life.mission)}`) : '–',
    delta: p && p.bus && p.orbit && m.bus && m.orbit ? delta(Math.min(p.life.mission, 15) - Math.min(m.life.mission, 15), tx(' yr', ' thn'), 'up', 1, 0.05) : '',
    fill: m.bus ? m.schedule.devMonths / m.schedule.deadline : 0,
    marks: [1],
    sub: m.bus
      ? tx(`Build ${num(m.schedule.devMonths)} of ${m.schedule.deadline} months · need ${m.life.required} yr in flight`, `Bangun ${num(m.schedule.devMonths)} dari ${m.schedule.deadline} bulan · perlu ${m.life.required} thn terbang`)
      : tx('Development time and mission lifetime', 'Waktu pengembangan dan umur misi'),
    detail: `<ul class="kv"><li><span>${tx('Development', 'Pengembangan')}</span><span>${tx(`${num(m.schedule.devMonths)} months`, `${num(m.schedule.devMonths)} bulan`)}</span></li>
      <li><span>${tx('Launch deadline', 'Tenggat peluncuran')}</span><span>${tx(`${m.schedule.deadline} months`, `${m.schedule.deadline} bulan`)}</span></li>
      ${m.life.factors.map((f) => `<li class="${f.key === m.life.limiting.key ? 'kv-hl' : ''}"><span>${tx('Life limit:', 'Batas umur:')} ${esc(f.label)}</span><span>${years(f.years)}</span></li>`).join('')}
      ${m.life.cruiseMonths ? `<li><span>${tx('Cruise to destination', 'Perjalanan ke tujuan')}</span><span>${tx(`${num(m.life.cruiseMonths, 1)} months`, `${num(m.life.cruiseMonths, 1)} bulan`)}</span></li>` : ''}</ul>
      ${concept('lifetime', tx('Mission lifetime', 'Umur misi'))} ${concept('trl', tx('TRL & schedule', 'TRL & jadwal'))}`,
  });
  list.push({
    id: 'dv', label: 'Delta-v', icon: 'thruster', status: st.dv,
    value: m.prop && m.orbit ? `${num(m.dv.available)} / ${num(m.dv.needed)} m/s` : '–',
    delta: p && p.prop && p.orbit && m.prop && m.orbit ? delta(p.dv.available - m.dv.available, ' m/s', 'up', 0, 0.5) : '',
    fill: m.dv.available > 0 ? m.dv.needed / m.dv.available : m.dv.needed > 0 ? 1 : 0,
    marks: [1],
    sub: m.prop && m.orbit
      ? (m.dv.insertion ? tx(`Insertion needs ${num(m.dv.insertion)} m/s`, `Masuk orbit butuh ${num(m.dv.insertion)} m/s`) : tx('Available vs needed for the planned mission', 'Tersedia vs dibutuhkan untuk misi'))
      : tx('Choose propulsion and an orbit', 'Pilih propulsi dan orbit'),
    detail: `<ul class="kv"><li><span>${tx('Available (rocket equation)', 'Tersedia (persamaan roket)')}</span><span>${num(m.dv.available)} m/s</span></li>
      <li><span>${tx('Orbit insertion', 'Masuk orbit')}</span><span>${num(m.dv.insertion)} m/s</span></li>
      <li><span>${tx(`Station-keeping (${num(m.dv.perYear)} m/s per year beyond natural life)`, `Menjaga orbit (${num(m.dv.perYear)} m/s per tahun di luar umur alami)`)}</span><span>${num(m.dv.skNeeded)} m/s</span></li>
      <li><span>${tx('Disposal reserve', 'Cadangan pembuangan')}</span><span>${num(m.dv.deorbit)} m/s</span></li></ul>${concept('delta-v', 'Delta-v')}`,
  });
  return list;
}

function mobileBar(m, lead = true) {
  const items = [['mass', 'weight'], ['power', 'bolt'], ['budget', 'coins'], ['data', 'database'], ['dv', 'thruster']];
  return `<nav class="mobile-bar" aria-label="${tx('Mission status', 'Status misi')}">
    <a class="mb-status" href="#dashboard">${items.map(([k, ic]) => `<span class="mb-item st-${m.statuses[k]}" title="${k}">${icon(ic, { size: 16 })}</span>`).join('')}<span class="mb-label">${tx('Dashboard', 'Dasbor')}</span></a>
    <button type="button" class="btn btn-primary btn-sm" data-action="go" data-screen="gonogo" ${lead ? '' : 'disabled'}>${icon('flag')}<span>${lead ? 'Go/No-Go' : tx('Waiting', 'Menunggu')}</span></button>
  </nav>`;
}
