// Flight screen: launch sequence, live telemetry, in-flight decisions.
import { step, eventView, resolveEvent } from '../../engine/sim.js';
import { phaseName } from '../../engine/score.js';
import { createFlightView } from '../flightCanvas.js';
import { icon } from '../icons.js';
import { esc, num, pct, gb, money, years } from '../util.js';
import { topBar, concept } from '../components.js';
import { play } from '../audio.js';
import { tx, nameOf, inlineName } from '../../i18n.js';

// Annunciator panel: one light per subsystem, like the caution-and-warning panel in a control room.
const LAMPS = [
  { id: 'pwr', label: () => tx('POWER', 'DAYA') },
  { id: 'comms', label: () => tx('COMMS', 'KOMUNIKASI') },
  { id: 'adcs', label: () => tx('POINTING', 'ARAH') },
  { id: 'prop', label: () => tx('PROPULSION', 'PROPULSI') },
  { id: 'payload', label: () => tx('PAYLOAD', 'INSTRUMEN') },
  { id: 'data', label: () => tx('DATA', 'DATA') },
  { id: 'env', label: () => tx('SPACE WX', 'CUACA ANTARIKSA') },
  { id: 'ops', label: () => tx('GROUND OPS', 'OPERASI DARAT') },
];
/** Which light an in-flight event trips. */
const EVENT_LAMP = {
  'solar-storm': 'env', debris: 'env', wheel: 'adcs', 'gs-outage': 'comms', 'budget-cut': 'ops',
  instrument: 'payload', 'battery-fade': 'pwr', mascon: 'prop', 'opp-solar': 'env',
};
const lampText = (st) => ({
  ok: 'OK', caution: tx('CAUTION', 'WASPADA'), alarm: 'ALARM', opp: tx('CHANCE', 'PELUANG'),
  off: tx('STBY', 'SIAGA'), na: tx('NONE', 'NIHIL'), dead: tx('NO DATA', 'PUTUS'),
}[st]);

function spark(id, refLabel) {
  return `<div class="spark-wrap" aria-hidden="true">
    <svg class="spark spark-${id}" viewBox="0 0 100 32" preserveAspectRatio="none">
      <line class="spark-ref" id="sp-${id}-ref" x1="0" x2="100" y1="-9" y2="-9" vector-effect="non-scaling-stroke"/>
      <path class="spark-area" id="sp-${id}-area" d=""/>
      <polyline class="spark-line" id="sp-${id}-line" points="" vector-effect="non-scaling-stroke"/>
    </svg>
    <i class="spark-dot spark-dot-${id}" id="sp-${id}-dot"></i>${refLabel ? `<span class="spark-ref-l" id="sp-${id}-ref-l">${refLabel}</span>` : ''}
  </div>`;
}

export function renderFlight(state, m, ctx) {
  const f = state.flight;
  return `${topBar(state, ctx, 'flight')}
  <main class="flight" id="main">
    <section class="flight-stage">
      <div class="stage-head">
        <div><p class="eyebrow" id="t-phase">${tx('Final countdown', 'Hitung mundur terakhir')}</p>
          <h1 class="stage-title">${esc(ctx.scenario.name)} <span class="muted">· ${esc(nameOf(m.orbit))}</span></h1></div>
        <div class="clock"><span class="muted">${tx('Mission month', 'Bulan misi')}</span><strong id="t-month">0</strong><span class="muted">${tx('of', 'dari')} ${f.endMonth}</span></div>
      </div>
      <div class="canvas-wrap">
        <canvas id="flight-canvas" role="img" aria-label="${esc(tx(`Animated view of the spacecraft in ${nameOf(m.orbit)}. Live values are listed in the telemetry panel.`, `Animasi wahana di ${nameOf(m.orbit)}. Nilai langsung ada di panel telemetri.`))}"></canvas>
        <div class="event-layer" id="event-layer" hidden></div>
      </div>
      <div class="timeline" aria-hidden="true"><span class="tl-fill" id="t-progress"></span>${f.events.map((e) => `<i class="tl-ev ${e.event.kind}" style="left:${(e.month / Math.max(1, f.endMonth)) * 100}%"></i>`).join('')}<i class="tl-req" style="left:${Math.min(100, (f.requiredMonths / Math.max(1, f.endMonth)) * 100)}%" title="${tx('Required lifetime', 'Umur yang diwajibkan')}"></i></div>
      <div class="flight-controls">
        <button type="button" class="btn btn-secondary btn-sm" data-action="flight-pause" id="c-pause" disabled>${icon('pause')}<span>${tx('Pause', 'Jeda')}</span></button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="flight-speed" id="c-speed" disabled>${icon('forward')}<span>${tx('Speed', 'Kecepatan')} ×1</span></button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="flight-skip" id="c-skip" disabled>${icon('skip')}<span>${tx('Skip to next event', 'Lompat ke event berikutnya')}</span></button>
      </div>
    </section>
    <aside class="telemetry" aria-label="${tx('Telemetry', 'Telemetri')}">
      <h2 class="dash-h">${tx('Telemetry', 'Telemetri')}<span class="tm-live is-stby" id="t-live"><i aria-hidden="true"></i><span id="t-live-l">${tx('STANDBY', 'SIAGA')}</span></span></h2>
      <div class="annun" role="group" aria-label="${tx('Subsystem status lights', 'Lampu status subsistem')}">
        <p class="annun-master is-off" id="t-master">${tx('SYSTEMS ON STANDBY', 'SISTEM SIAGA')}</p>
        <ul class="annun-grid" id="t-lamps">${LAMPS.map((l) => `<li><button type="button" class="lamp is-off" id="lamp-${l.id}" data-lamp="${l.id}" aria-pressed="false" aria-controls="t-lamp-info">
          <i class="lamp-led" aria-hidden="true"></i><span class="lamp-k">${l.label()}</span><span class="lamp-s">${lampText('off')}</span></button></li>`).join('')}</ul>
        <div class="lamp-info" id="t-lamp-info" aria-live="polite"><p class="muted">${tx('Select a light to see what it is telling you.', 'Pilih sebuah lampu untuk melihat artinya.')}</p></div>
      </div>
      <div class="tm">
        <div class="tm-row"><span>${icon('flask', { size: 15 })} ${tx('Science collected', 'Sains terkumpul')}</span><strong id="t-science">0%</strong></div>
        <div class="bar bar-go"><span class="bar-fill" id="t-science-bar" style="width:0%"></span><i class="bar-mark" style="left:${(1 / 1.2) * 100}%"></i></div>
        ${spark('science', tx('target', 'target'))}
        <div class="tm-row"><span>${icon('thruster', { size: 15 })} ${tx('Fuel left (delta-v)', 'Sisa bahan bakar (delta-v)')}</span><strong id="t-dv">${num(f.dvLeft)} m/s</strong></div>
        ${spark('fuel', m.prop && m.prop.id !== 'prop-none' ? '' : tx('no thrusters on board', 'tanpa pendorong'))}
        <div class="tm-row"><span>${icon('database', { size: 15 })} ${tx('Data delivered', 'Data terkirim')}</span><strong id="t-data">0 GB</strong></div>
        <div class="tm-row"><span>${icon('clock', { size: 15 })} ${tx('Expected life', 'Perkiraan umur')}</span><strong id="t-life">${years(f.lifeMonths / 12)}</strong></div>
        <div class="tm-row"><span>${icon('coins', { size: 15 })} ${tx('Extra costs', 'Biaya tambahan')}</span><strong id="t-cost">${money(0)}</strong></div>
      </div>
      <h2 class="dash-h">${tx('Mission log', 'Log misi')}</h2>
      <ol class="log" id="t-log" aria-live="polite"></ol>
    </aside>
  </main>`;
}

/** Drives the flight. Returns a controller with destroy(). */
export function mountFlight(root, { state, m, ctx, onFinish }) {
  const f = state.flight;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const view = createFlightView(root.querySelector('#flight-canvas'), {
    orbit: m.orbit, scenario: ctx.scenario, count: m.count, network: m.network, launcher: m.launcher, reducedMotion: reduced,
  });
  const $ = (id) => root.querySelector(`#${id}`);
  const timers = new Set();
  let paused = false;
  let speed = 1;
  let skipping = false;
  let loop = null;
  let destroyed = false;

  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, reduced ? Math.min(ms, 600) : ms);
    timers.add(id);
  };
  const log = (text, tone = 'info', month = f.month) => {
    const li = document.createElement('li');
    li.className = `log-${tone}`;
    li.innerHTML = `<span class="log-m">${tx('M', 'B')}${month}</span><span>${esc(text)}</span>`;
    $('t-log').prepend(li);
  };
  const phase = (text) => { $('t-phase').textContent = text; };

  // ---------- Strip charts ----------
  const dv0 = Math.max(f.dvLeft, 1e-9);
  const hist = { science: [], fuel: [] };
  function record(series, value) {
    const last = series[series.length - 1];
    if (last && last[0] === f.month) last[1] = value;
    else series.push([f.month, value]);
  }
  function drawSpark(id, series, yMax, ref = null) {
    const span = Math.max(1, f.endMonth, f.month);
    const X = (mo) => (mo / span) * 100;
    const Y = (v) => 30 - Math.max(0, Math.min(1, v / yMax)) * 27;
    const pts = series.map(([mo, v]) => `${X(mo).toFixed(2)},${Y(v).toFixed(2)}`);
    const [lastMo, lastV] = series[series.length - 1];
    $(`sp-${id}-line`).setAttribute('points', pts.join(' '));
    $(`sp-${id}-area`).setAttribute('d', `M${X(series[0][0]).toFixed(2)},32 L${pts.join(' L')} L${X(lastMo).toFixed(2)},32 Z`);
    const dot = $(`sp-${id}-dot`);
    dot.style.left = `${X(lastMo).toFixed(2)}%`;
    dot.style.top = `${((Y(lastV) / 32) * 100).toFixed(2)}%`;
    if (ref != null) {
      $(`sp-${id}-ref`).setAttribute('y1', Y(ref).toFixed(2));
      $(`sp-${id}-ref`).setAttribute('y2', Y(ref).toFixed(2));
      const l = $(`sp-${id}-ref-l`);
      if (l) l.style.top = `${((Y(ref) / 32) * 100).toFixed(2)}%`;
    }
  }

  // ---------- Subsystem lights ----------
  const hasProp = Boolean(m.prop && m.prop.id !== 'prop-none');
  const sticky = {}; // lights left amber by a decision that went badly: { why, concept }
  let online = false; // false until commissioning ends
  let active = null; // { lamp, kind, why, concept } while an event waits for a decision
  let selected = null; // light whose explanation is shown
  /** State of every light plus a plain-language reason and a codex concept. */
  function lampStates() {
    const out = {};
    const set = (id, st, why, concept = null) => { out[id] = { st, why, concept }; };
    if (f.lost) {
      for (const l of LAMPS) set(l.id, 'dead', tx(`No telemetry: the mission was lost. ${f.lost.reason}`, `Tidak ada telemetri: misi hilang. ${f.lost.reason}`));
      return out;
    }
    if (!online) {
      for (const l of LAMPS) set(l.id, 'off', tx('Standing by. Lights come on after commissioning, when the spacecraft is checked out in orbit.', 'Siaga. Lampu menyala setelah komisioning, saat wahana selesai diperiksa di orbit.'));
      return out;
    }
    const nominal = tx('Nominal: nothing to report.', 'Normal: tidak ada yang perlu dilaporkan.');
    for (const l of LAMPS) set(l.id, 'ok', nominal);

    if (m.batteryInfo.brownout) set('pwr', 'caution', tx(`The battery is drained ${pct(Math.min(m.batteryInfo.dod, 9.99))} in every eclipse: more than it can safely give.`, `Baterai terkuras ${pct(Math.min(m.batteryInfo.dod, 9.99))} di setiap gerhana: lebih dari batas amannya.`), 'battery');
    else if (m.statuses.power !== 'go') set('pwr', 'caution', tx(`Power margin is only ${pct(m.power.margin)} at end of life. Engineers want at least 10%.`, `Margin daya hanya ${pct(m.power.margin)} di akhir misi. Insinyur menginginkan minimal 10%.`), 'power');

    if (m.statuses.comms !== 'go') set('comms', 'caution', tx(`Pointing (${m.adcs.accuracy}°) is too coarse for this antenna (needs ${m.radio.pointing}°), so the link runs at a fraction of its rate.`, `Ketepatan arah (${m.adcs.accuracy}°) terlalu kasar untuk antena ini (butuh ${m.radio.pointing}°), jadi tautan hanya berjalan di sebagian kecil lajunya.`), 'attitude');

    if (m.statuses.data !== 'go') set('data', 'caution', tx(`Only ${pct(m.comms.delivery)} of the data reaches the ground: instruments make ${gb(m.comms.generatedGB)} a day but the downlink carries ${gb(m.comms.downlinkGB)}.`, `Hanya ${pct(m.comms.delivery)} data yang sampai ke Bumi: instrumen menghasilkan ${gb(m.comms.generatedGB)} per hari, tapi downlink hanya membawa ${gb(m.comms.downlinkGB)}.`), 'data-rate');

    if (!hasProp) set('prop', 'na', tx('No thrusters on board: the spacecraft cannot change or hold its orbit.', 'Tidak ada pendorong: wahana tidak bisa mengubah atau menjaga orbitnya.'), 'delta-v');
    else if (f.dvLeft < dv0 * 0.1) set('prop', 'caution', tx(`Fuel is nearly gone: ${num(f.dvLeft)} m/s of delta-v left.`, `Bahan bakar hampir habis: sisa delta-v ${num(f.dvLeft)} m/s.`), 'delta-v');
    else if (m.statuses.dv !== 'go') set('prop', 'caution', tx(`Not enough fuel to hold this orbit for the required ${m.life.required} years.`, `Bahan bakar tidak cukup untuk menjaga orbit ini selama ${m.life.required} tahun yang diwajibkan.`), 'delta-v');

    if (f.downtimeQueue > 0) set('payload', 'caution', tx(`Instruments are off while the spacecraft recovers: ${num(f.downtimeQueue)} more days without science.`, `Instrumen mati selama wahana memulihkan diri: ${num(f.downtimeQueue)} hari lagi tanpa sains.`), 'radiation');
    else if (f.scienceMult < 1) set('payload', 'caution', tx(`Science output is down to ${pct(f.scienceMult)} of normal after earlier decisions.`, `Hasil sains turun menjadi ${pct(f.scienceMult)} dari normal akibat keputusan sebelumnya.`), 'trl');

    for (const [id, x] of Object.entries(sticky)) if (out[id].st === 'ok' || out[id].st === 'na') set(id, 'caution', x.why, x.concept);
    if (active) set(active.lamp, active.kind === 'opportunity' ? 'opp' : 'alarm', active.why, active.concept);
    return out;
  }
  function lamps() {
    const states = lampStates();
    for (const l of LAMPS) {
      const st = states[l.id].st;
      const el = $(`lamp-${l.id}`);
      el.setAttribute('aria-pressed', String(selected === l.id));
      if (el.dataset.st === st) continue;
      el.dataset.st = st;
      el.className = `lamp is-${st}`;
      el.querySelector('.lamp-s').textContent = lampText(st);
    }
    if (selected) {
      const x = states[selected];
      const html = `<p class="lamp-info-h is-${x.st}"><strong>${LAMPS.find((l) => l.id === selected).label()}</strong> · ${lampText(x.st)}</p><p>${esc(x.why)}</p>${x.concept ? concept(x.concept) : ''}`;
      const info = $('t-lamp-info');
      if (info.dataset.html !== html) { info.dataset.html = html; info.innerHTML = html; }
    }
    const all = Object.values(states).map((x) => x.st);
    const [cls, text] = f.lost ? ['alarm', tx('LOSS OF SIGNAL', 'SINYAL HILANG')]
      : !online ? ['off', tx('SYSTEMS ON STANDBY', 'SISTEM SIAGA')]
        : all.includes('alarm') ? ['alarm', tx('MASTER ALARM', 'ALARM UTAMA')]
          : all.includes('opp') ? ['opp', tx('OPPORTUNITY', 'PELUANG')]
            : all.includes('caution') ? ['caution', tx('MASTER CAUTION', 'WASPADA')]
              : ['ok', tx('ALL SYSTEMS NOMINAL', 'SEMUA SISTEM NORMAL')];
    const master = $('t-master');
    master.className = `annun-master is-${cls}`;
    master.textContent = text;
    const live = f.lost ? ['los', tx('NO SIGNAL', 'TANPA SINYAL')] : !online ? ['stby', tx('STANDBY', 'SIAGA')]
      : f.done ? ['end', tx('END', 'SELESAI')] : paused ? ['hold', tx('HOLD', 'JEDA')] : ['on', tx('LIVE', 'LANGSUNG')];
    $('t-live').className = `tm-live is-${live[0]}`;
    $('t-live-l').textContent = live[1];
  }

  function telemetry() {
    const target = (m.science.target || 1) * m.life.required;
    const ratio = f.science / target;
    record(hist.science, ratio);
    record(hist.fuel, f.dvLeft);
    drawSpark('science', hist.science, Math.max(1.2, ratio * 1.05), 1);
    drawSpark('fuel', hist.fuel, Math.max(dv0, f.dvLeft));
    lamps();
    $('t-month').textContent = String(f.month);
    $('t-science').textContent = pct(ratio);
    $('t-science-bar').style.width = `${Math.min(100, (ratio / 1.2) * 100).toFixed(1)}%`;
    $('t-data').textContent = gb(f.dataGB);
    $('t-dv').textContent = `${num(f.dvLeft)} m/s`;
    $('t-life').textContent = years(f.lifeMonths / 12);
    $('t-cost').textContent = money(f.extraCost);
    $('t-progress').style.width = `${Math.min(100, (f.month / Math.max(1, f.endMonth)) * 100).toFixed(1)}%`;
  }

  function controls(enabled) {
    ['c-pause', 'c-speed', 'c-skip'].forEach((id) => { $(id).disabled = !enabled; });
  }

  function finish() {
    controls(false);
    clearInterval(loop);
    loop = null;
    telemetry();
    const layer = $('event-layer');
    const lostTxt = f.lost;
    if (lostTxt) view.setLost();
    play(lostTxt ? 'lost' : 'success');
    phase(lostTxt ? tx('Mission lost', 'Misi hilang') : tx('Mission complete', 'Misi selesai'));
    layer.hidden = false;
    layer.innerHTML = `<div class="event-card ${lostTxt ? 'is-lost' : 'is-done'}" role="dialog" aria-modal="true" aria-labelledby="end-title">
      <p class="eyebrow">${lostTxt ? tx(`Lost during ${esc(lostTxt.phase)}`, `Hilang saat ${esc(phaseName(lostTxt.phase))}`) : tx(`${num(f.month / 12, 1)} years of operations`, `${num(f.month / 12, 1)} tahun operasi`)}</p>
      <h2 id="end-title">${lostTxt ? tx('Loss of mission', 'Misi hilang') : tx('Mission complete', 'Misi selesai')}</h2>
      <p>${esc(lostTxt ? lostTxt.reason : tx(`The spacecraft finished its mission and returned ${gb(f.dataGB)} of data.`, `Wahana menyelesaikan misinya dan mengirim ${gb(f.dataGB)} data.`))}</p>
      <button type="button" class="btn btn-primary btn-lg" data-action="to-report" data-focus="to-report">${icon('right')}<span>${tx('See the mission report', 'Lihat laporan misi')}</span></button>
    </div>`;
    layer.querySelector('button').focus();
    onFinish?.();
  }

  function showEvent() {
    const ev = eventView(f, m, ctx);
    if (!ev) return;
    clearInterval(loop);
    loop = null;
    skipping = false;
    controls(false);
    view.flash(ev.kind);
    active = { lamp: EVENT_LAMP[ev.id] ?? (ev.kind === 'opportunity' ? 'payload' : 'env'), kind: ev.kind, concept: ev.concept,
      why: tx(`${ev.title}: waiting for your decision.`, `${ev.title}: menunggu keputusanmu.`) };
    selected = active.lamp;
    lamps();
    play(ev.kind === 'opportunity' ? 'opportunity' : 'alert');
    phase(ev.kind === 'opportunity' ? tx('Opportunity', 'Peluang') : tx('Anomaly: decision needed', 'Anomali: perlu keputusan'));
    const layer = $('event-layer');
    layer.hidden = false;
    layer.innerHTML = `<div class="event-card ${ev.kind}" role="dialog" aria-modal="true" aria-labelledby="ev-title" aria-describedby="ev-text">
      <p class="eyebrow">${icon(ev.icon, { size: 14 })} ${ev.kind === 'opportunity' ? tx('Opportunity', 'Peluang') : tx('Anomaly', 'Anomali')} · ${tx('Month', 'Bulan')} ${f.month}</p>
      <h2 id="ev-title">${esc(ev.title)}</h2>
      <p id="ev-text">${esc(ev.text)}</p>
      <div class="ev-options">${ev.options.map((o) => `<button type="button" class="ev-opt" data-option="${o.id}" ${o.disabled ? 'disabled' : ''}>
        <span class="ev-opt-l">${esc(o.label)}</span><span class="ev-opt-d">${esc(o.disabled ?? o.detail)}</span></button>`).join('')}</div>
      <div class="ev-foot">${concept(ev.concept, tx('Learn the concept', 'Pelajari konsepnya'))}</div>
    </div>`;
    const first = layer.querySelector('.ev-opt:not([disabled])');
    first?.focus();
    layer.querySelectorAll('.ev-opt').forEach((btn) => btn.addEventListener('click', () => choose(btn.dataset.option)));
  }

  function choose(optionId) {
    const res = resolveEvent(f, m, ctx, optionId);
    if (!res) return;
    const bad = res.effects.endMission || (res.effects.scienceMult && res.effects.scienceMult < 1) || (res.effects.lifeMonths && res.effects.lifeMonths < 0);
    play(bad ? 'bad' : 'good');
    log(`${res.text}`, bad ? 'bad' : res.effects.bonusYears ? 'good' : 'info');
    if (active) {
      if (bad) sticky[active.lamp] = { why: res.text, concept: active.concept };
      else delete sticky[active.lamp];
      active = null;
    }
    telemetry();
    const layer = $('event-layer');
    const card = layer.querySelector('.event-card');
    card.querySelector('.ev-options').innerHTML = `<div class="ev-result ${bad ? 'bad' : 'good'}">${icon(bad ? 'alert' : 'check', { size: 16 })}<p>${esc(res.text)}</p></div>
      <button type="button" class="btn btn-primary" data-ev-continue>${icon('play')}<span>${tx('Continue mission', 'Lanjutkan misi')}</span></button>`;
    const cont = card.querySelector('[data-ev-continue]');
    cont.focus();
    cont.addEventListener('click', () => {
      play('click');
      layer.hidden = true;
      layer.innerHTML = '';
      if (f.done) finish();
      else { controls(true); phase(tx('Science operations', 'Operasi sains')); run(); }
    });
  }

  function tickMs() {
    const base = Math.max(90, Math.min(600, 14000 / Math.max(1, f.endMonth)));
    return base / (skipping ? 10 : speed);
  }

  function run() {
    clearInterval(loop);
    if (paused) return;
    loop = setInterval(() => {
      const ev = step(f, m, ctx);
      telemetry();
      if (ev) showEvent();
      else if (f.done) finish();
    }, tickMs());
  }

  $('t-lamps').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lamp]');
    if (!btn) return;
    play('click');
    selected = btn.dataset.lamp;
    lamps();
  });

  // ---------- Sequence ----------
  f.trace = { science: hist.science, fuel: hist.fuel, dv0: f.dvLeft };
  telemetry();
  for (const p of f.prelaunch) log(p.text, p.tone === 'good' ? 'good' : 'bad', 0);
  log(tx(`Launching on a ${inlineName(m.launcher)} to ${inlineName(m.orbit)}.`, `Meluncur dengan ${inlineName(m.launcher)} menuju ${inlineName(m.orbit)}.`), 'info', 0);
  let tminus = 3;
  const tLabel = (n) => tx(`Final countdown: T−${n}`, `Hitung mundur: T−${n}`);
  phase(tLabel(3));
  play('countdown');
  const countdown = () => {
    tminus -= 1;
    if (tminus > 0) { phase(tLabel(tminus)); play('countdown'); later(countdown, 600); return; }
    phase(tx('Liftoff', 'Lepas landas'));
    play('liftoff');
    view.setScene('launch');
    later(afterLaunch, 2900);
  };
  later(countdown, 600);

  function afterLaunch() {
    if (f.lost?.phase === 'launch') return finish();
    play('separation');
    log(tx('Spacecraft separated from the rocket.', 'Wahana terpisah dari roket.'), 'good', 0);
    if (m.orbit.body !== 'earth') {
      view.setScene('cruise');
      phase(m.life.cruiseMonths >= 3
        ? tx(`Cruise: ${num(m.life.cruiseMonths)}-month spiral`, `Perjalanan: spiral ${num(m.life.cruiseMonths)} bulan`)
        : tx('Cruise to destination', 'Perjalanan ke tujuan'));
      later(afterCruise, 2600);
    } else afterCruise();
  }
  function afterCruise() {
    view.setScene('orbit');
    if (f.lost?.phase === 'insertion') return later(finish, 900);
    if (m.dv.insertion > 0) log(tx(`Orbit insertion burn: ${num(m.dv.insertion)} m/s. In orbit!`, `Pembakaran masuk orbit: ${num(m.dv.insertion)} m/s. Masuk orbit!`), 'good', 0);
    phase(tx('Commissioning', 'Komisioning'));
    later(() => {
      if (f.lost?.phase === 'commissioning') return finish();
      play('radio');
      log(tx('Commissioning complete: arrays deployed, instruments on, first data received.', 'Komisioning selesai: panel terbuka, instrumen menyala, data pertama diterima.'), 'good', 0);
      phase(tx('Science operations', 'Operasi sains'));
      online = true;
      lamps();
      controls(true);
      run();
    }, 1400);
  }

  return {
    togglePause() {
      paused = !paused;
      $('c-pause').innerHTML = paused ? `${icon('play')}<span>${tx('Resume', 'Lanjutkan')}</span>` : `${icon('pause')}<span>${tx('Pause', 'Jeda')}</span>`;
      if (paused) { clearInterval(loop); loop = null; } else run();
      lamps();
    },
    cycleSpeed() {
      speed = speed === 1 ? 3 : speed === 3 ? 6 : 1;
      $('c-speed').innerHTML = `${icon('forward')}<span>${tx('Speed', 'Kecepatan')} ×${speed}</span>`;
      if (loop) run();
    },
    skip() {
      skipping = true;
      if (paused) this.togglePause();
      else run();
    },
    destroy() {
      destroyed = true;
      clearInterval(loop);
      timers.forEach(clearTimeout);
      view.destroy();
    },
  };
}
