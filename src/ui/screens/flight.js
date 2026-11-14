// Flight screen: launch sequence, live telemetry, in-flight decisions.
import { step, eventView, resolveEvent } from '../../engine/sim.js';
import { phaseName } from '../../engine/score.js';
import { createFlightView } from '../flightCanvas.js';
import { icon } from '../icons.js';
import { esc, num, pct, gb, money, years } from '../util.js';
import { topBar, concept } from '../components.js';
import { play } from '../audio.js';
import { tx, nameOf, inlineName } from '../../i18n.js';

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
      <h2 class="dash-h">${tx('Telemetry', 'Telemetri')}</h2>
      <div class="tm">
        <div class="tm-row"><span>${icon('flask', { size: 15 })} ${tx('Science collected', 'Sains terkumpul')}</span><strong id="t-science">0%</strong></div>
        <div class="bar bar-go"><span class="bar-fill" id="t-science-bar" style="width:0%"></span><i class="bar-mark" style="left:${(1 / 1.2) * 100}%"></i></div>
        <div class="tm-row"><span>${icon('database', { size: 15 })} ${tx('Data delivered', 'Data terkirim')}</span><strong id="t-data">0 GB</strong></div>
        <div class="tm-row"><span>${icon('thruster', { size: 15 })} ${tx('Delta-v left', 'Sisa delta-v')}</span><strong id="t-dv">${num(f.dvLeft)} m/s</strong></div>
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
    orbit: m.orbit, scenario: ctx.scenario, count: m.count, network: m.network, reducedMotion: reduced,
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

  function telemetry() {
    const target = (m.science.target || 1) * m.life.required;
    const ratio = f.science / target;
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

  // ---------- Sequence ----------
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
      controls(true);
      run();
    }, 1400);
  }

  return {
    togglePause() {
      paused = !paused;
      $('c-pause').innerHTML = paused ? `${icon('play')}<span>${tx('Resume', 'Lanjutkan')}</span>` : `${icon('pause')}<span>${tx('Pause', 'Jeda')}</span>`;
      if (paused) { clearInterval(loop); loop = null; } else run();
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
