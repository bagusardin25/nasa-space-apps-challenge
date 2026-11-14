// GO/NO-GO entry point: state, routing and event handling.
import { computeMission, autoPropellant, normalizeDesign, EMPTY_DESIGN } from './engine/mission.js';
import { createFlight, hashString } from './engine/sim.js';
import { scoreMission } from './engine/score.js';
import { get } from './data/catalog.js';
import { getScenario } from './data/scenarios.js';
import { initialState, ctxOf, shareUrl, readShareHash, saveRun, ROLE_IDS } from './state.js';
import { renderTitle, renderScenarios, renderBriefing } from './ui/screens/intro.js';
import { renderDesign, renderDashboard } from './ui/screens/design.js';
import { renderGoNoGo } from './ui/screens/gonogo.js';
import { renderFlight, mountFlight } from './ui/screens/flight.js';
import { renderReport } from './ui/screens/report.js';
import { openCodex, openHowTo, openAbout, closeOverlays, overlayOpen, toast, trapFocus } from './ui/overlays.js';
import { preloadTextures } from './ui/flightCanvas.js';
import { launchStack } from './ui/launchStack.js';
import { syncRocketView, disposeRocketView, onRocketViewFail } from './ui/rocketView3d.js';
import { startTour, tourSeen, endTour, tourActive } from './ui/tour.js';
import { play, setMuted, isMuted } from './ui/audio.js';
import { smart } from './ui/util.js';
import { tx, nameOf, getLang, setLang } from './i18n.js';

const app = document.getElementById('app');
let state = initialState();
let flightCtl = null;
let previewKey = null;
let previewRaf = 0;
let lastScreen = null;

const metrics = (design = state.design) => computeMission(design, ctxOf(state));

// ---------------- Rendering ----------------
function render(opts = {}) {
  const prevFocus = opts.focus ?? document.activeElement?.dataset?.focus ?? null;
  const dash = app.querySelector('.dashboard');
  const dashScroll = dash ? dash.scrollTop : 0;
  const screenChanged = state.screen !== lastScreen;

  if (flightCtl && state.screen !== 'flight') {
    flightCtl.destroy();
    flightCtl = null;
  }
  if (screenChanged) endTour(false);
  const ctx = ctxOf(state);
  let html = '';
  let designMetrics = null;
  let title = tx('GO/NO-GO · Space Mission Design Game', 'GO/NO-GO · Game Desain Misi Antariksa');
  switch (state.screen) {
    case 'title': html = renderTitle(state); break;
    case 'scenarios': html = renderScenarios(state); title = tx('Choose a mission · GO/NO-GO', 'Pilih misi · GO/NO-GO'); break;
    case 'briefing': html = renderBriefing(state, ctx); title = `${ctx.scenario.name} · Brief · GO/NO-GO`; break;
    case 'design': designMetrics = metrics(); html = renderDesign(state, designMetrics, ctx, null); title = `${ctx.scenario.name} · ${tx('Design room', 'Ruang desain')} · GO/NO-GO`; break;
    case 'gonogo': html = renderGoNoGo(state, metrics(), ctx); title = `${tx('Go/No-Go poll', 'Poll Go/No-Go')} · GO/NO-GO`; break;
    case 'flight': html = renderFlight(state, state.flightMetrics, ctx); title = `${tx('In flight', 'Dalam penerbangan')} · GO/NO-GO`; break;
    case 'report': html = renderReport(state, state.flightMetrics, ctx); title = `${tx('Mission report', 'Laporan misi')} · GO/NO-GO`; break;
    default: html = renderTitle(state);
  }
  document.title = title;
  app.innerHTML = html;
  lastScreen = state.screen;
  if (designMetrics) syncStack(designMetrics);
  else disposeRocketView();

  if (state.screen === 'flight' && !flightCtl) {
    flightCtl = mountFlight(app, { state, m: state.flightMetrics, ctx, onFinish: finishFlight });
  }
  if (state.screen === 'report') {
    app.querySelectorAll('img[data-fallback]').forEach((img) => img.addEventListener('error', () => {
      img.closest('.img-frame').innerHTML = `<p class="muted small img-missing">${tx('The NASA image could not be loaded (are you offline?). Use the link below to explore it.', 'Citra NASA tidak bisa dimuat (sedang offline?). Pakai tautan di bawah untuk menjelajahinya.')}</p>`;
    }, { once: true }));
  }

  const newDash = app.querySelector('.dashboard');
  if (newDash && !screenChanged) newDash.scrollTop = dashScroll;
  if (screenChanged) {
    window.scrollTo(0, 0);
    const h1 = app.querySelector('h1, h2');
    if (opts.focus) app.querySelector(`[data-focus="${opts.focus}"]`)?.focus({ preventScroll: true });
    else if (h1 && state.screen !== 'title') { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    else app.querySelector('[data-focus="start"]')?.focus({ preventScroll: true });
    // First visit to the design room: offer the guided tour automatically.
    if (state.screen === 'design' && !tourSeen()) setTimeout(() => { if (state.screen === 'design' && !overlayOpen()) startTour(); }, 450);
  } else if (prevFocus) {
    app.querySelector(`[data-focus="${CSS.escape(prevFocus)}"]`)?.focus({ preventScroll: true });
  }
}

function renderDash(previewDesign = null) {
  const el = app.querySelector('#dashboard');
  if (!el) return;
  const scroll = el.scrollTop;
  const focusKey = document.activeElement?.closest?.('#dashboard') ? document.activeElement.dataset.focus : null;
  const m = metrics();
  const p = previewDesign ? metrics(previewDesign) : null;
  el.innerHTML = renderDashboard(state, m, ctxOf(state), p);
  el.scrollTop = scroll;
  if (focusKey) el.querySelector(`[data-focus="${focusKey}"]`)?.focus({ preventScroll: true });
  syncStack(m, p);
}

/** Re-attach the 3D rocket to its slot (the dashboard HTML was just rebuilt) and show the current design. */
function syncStack(m, p = null) {
  const slot = app.querySelector('[data-rocket-slot]');
  syncRocketView(slot, launchStack(m, p), state.tab === 'launch' ? 'rocket' : 'payload');
}
onRocketViewFail(() => {
  state.rocket3dFailed = true;
  if (state.screen === 'design') renderDash();
});

function go(screen, opts) {
  state.screen = screen;
  if (location.hash.includes('mission=')) history.replaceState(null, '', location.pathname + location.search);
  render(opts);
  if (screen === 'gonogo') play('radio');
}

// ---------------- Design changes ----------------
function applyPick(design, group, id, { silent = false } = {}) {
  const d = normalizeDesign(design);
  const notes = [];
  const ctx = ctxOf(state);
  if (group === 'instruments') {
    const has = d.instruments.includes(id);
    if (has) d.instruments = d.instruments.filter((x) => x !== id);
    else d.instruments.push(id);
  } else if (group === 'bus') {
    d.bus = id;
    const bus = get('buses', id);
    const bn = nameOf(bus);
    const solar = get('solar', d.solar);
    if (solar && !solar.byBus[id]) { notes.push(tx(`${nameOf(solar)} removed: not made for a ${bn}.`, `${nameOf(solar)} dilepas: tidak dibuat untuk ${bn}.`)); d.solar = null; }
    const bat = get('batteries', d.battery);
    if (bat && !bat.buses.includes(id)) { notes.push(tx(`${nameOf(bat)} removed: not offered for a ${bn}.`, `${nameOf(bat)} dilepas: tidak tersedia untuk ${bn}.`)); d.battery = null; }
    const prop = get('propulsion', d.propulsion);
    if (prop?.buses && !prop.buses.includes(id)) { notes.push(tx(`${nameOf(prop)} removed: too big for a ${bn}.`, `${nameOf(prop)} dilepas: terlalu besar untuk ${bn}.`)); d.propulsion = null; d.propellant = 0; }
    const radio = get('radios', d.radio);
    if (radio?.buses && !radio.buses.includes(id)) { notes.push(tx(`${nameOf(radio)} removed: needs a bigger spacecraft.`, `${nameOf(radio)} dilepas: butuh wahana lebih besar.`)); d.radio = null; }
    const keep = d.instruments.filter((x) => bus.sizes.includes(get('instruments', x).size));
    const dropped = d.instruments.filter((x) => !keep.includes(x));
    if (dropped.length) {
      const names = dropped.map((x) => nameOf(get('instruments', x))).join(', ');
      notes.push(tx(`${names} removed: too big for a ${bn}.`, `${names} dilepas: terlalu besar untuk ${bn}.`));
    }
    if (keep.length > bus.slots) notes.push(tx(`Only ${bus.slots} instrument slots: kept the first ${bus.slots}.`, `Hanya ${bus.slots} slot instrumen: ${bus.slots} yang pertama dipertahankan.`));
    d.instruments = keep.slice(0, bus.slots);
  } else if (group === 'propulsion') {
    d.propulsion = id;
    if (id === 'prop-none') d.propellant = 0;
    else if (ctx && d.bus && d.orbit) {
      const kgNeeded = autoPropellant(d, ctx);
      d.propellant = kgNeeded;
      if (!silent) notes.push(kgNeeded > 0
        ? tx(`Propellant auto-sized to ${smart(kgNeeded)} kg for this mission's delta-v. Adjust it with the slider.`,
          `Propelan otomatis diatur ${smart(kgNeeded)} kg sesuai delta-v misi ini. Atur dengan slider.`)
        : tx('This orbit needs no maneuvers for the planned mission, so the tank starts empty. Add propellant with the slider if you want a reserve.',
          'Orbit ini tidak butuh manuver untuk misi yang direncanakan, jadi tangki dimulai kosong. Tambah propelan dengan slider jika ingin cadangan.'));
    }
  } else {
    d[group] = id;
  }
  // keep propellant within the tank
  const prop = get('propulsion', d.propulsion);
  const bus = get('buses', d.bus);
  if (prop && bus) d.propellant = Math.min(d.propellant, prop.maxPropFrac * bus.maxMass);
  return { design: d, notes };
}

function commitDesign(design, notes = []) {
  state.design = normalizeDesign(design);
  state.votes = {};
  previewKey = null;
  render();
  notes.forEach((n) => toast(n));
}

function loadStarter() {
  const s = getScenario(state.scenarioId);
  state.design = normalizeDesign(s.starter);
  state.votes = {};
}

// ---------------- Flight ----------------
function launch() {
  const ctx = ctxOf(state);
  const m = metrics();
  if (!m.complete) return;
  if (state.mode === 'team' && !ROLE_IDS.every((r) => state.votes[r] === 'go')) return;
  state.overrides = state.mode === 'team' ? 0 : [...ROLE_IDS, 'mission'].filter((r) => m.roles[r].status === 'nogo').length;
  state.cautions = state.mode === 'team' ? 0 : [...ROLE_IDS, 'mission'].filter((r) => m.roles[r].status === 'caution').length;
  state.runCount += 1;
  const seed = (hashString(JSON.stringify(state.design) + state.scenarioId + state.priorityId + state.difficultyId) ^ Math.imul(state.runCount, 2654435761)) >>> 0;
  state.flightMetrics = m;
  state.flight = createFlight(m, ctx, seed);
  state.result = null;
  go('flight');
}

function finishFlight() {
  const ctx = ctxOf(state);
  const m = state.flightMetrics;
  state.result = scoreMission(m, state.flight, ctx, { team: state.mode === 'team', overrides: state.overrides, cautions: state.cautions });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  saveRun({
    id,
    scenarioId: state.scenarioId,
    priorityId: ctx.priority.id,
    name: state.mode === 'team' ? (state.teamName.trim() || tx('Team', 'Tim')) : tx('Solo run', 'Main solo'),
    score: state.result.total,
    grade: state.result.grade.grade,
    outcome: state.result.outcome,
    difficulty: ctx.difficulty.name,
    summary: `${m.count > 1 ? `${m.count}× ` : ''}${nameOf(m.bus)} · ${m.orbit.short.split('·')[0].trim()} · ${ctx.difficulty.name}`,
    date: new Date().toISOString(),
  });
  state.lastSaved = id;
}

// ---------------- Clipboard ----------------
async function copyShare() {
  const url = shareUrl(state);
  try {
    await navigator.clipboard.writeText(url);
    toast(tx('Design link copied. Anyone with the link can open this design.', 'Tautan desain disalin. Siapa pun yang punya tautannya bisa membuka desain ini.'), 'good');
  } catch {
    window.prompt(tx('Copy this design link:', 'Salin tautan desain ini:'), url);
  }
}

function runTour() {
  if (state.screen !== 'design') return;
  closeOverlays();
  startTour();
}

// ---------------- Event handling ----------------
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !app.contains(el)) return;
  const a = el.dataset.action;
  if (el.getAttribute('aria-disabled') === 'true' && a === 'pick') {
    const reason = el.querySelector('.opt-flag span')?.textContent;
    play('error');
    if (reason) toast(reason, 'bad');
    return;
  }
  if (!['pick', 'vote', 'launch', 'refly', 'sound', 'propellant'].includes(a)) play('click');
  switch (a) {
    case 'home': go('title'); break;
    case 'go': go(el.dataset.screen); break;
    case 'codex': openCodex(el.dataset.id ?? null); break;
    case 'howto': openHowTo({ canTour: state.screen === 'design', onTour: runTour }); break;
    case 'about': openAbout(); break;
    case 'tour': runTour(); break;
    case 'lang': {
      if (state.screen === 'flight') break;
      setLang(el.dataset.id);
      // Text inside the metrics and report is generated in the active language, so rebuild it (numbers are deterministic).
      if (state.flightMetrics && state.flight?.done) {
        const ctx = ctxOf(state);
        state.flightMetrics = computeMission(state.flightMetrics.design, ctx);
        if (state.result) state.result = scoreMission(state.flightMetrics, state.flight, ctx, { team: state.mode === 'team', overrides: state.overrides, cautions: state.cautions });
      }
      render({ focus: null });
      app.querySelector(`[data-action="lang"][data-id="${getLang()}"]`)?.focus({ preventScroll: true });
      break;
    }
    case 'sound': {
      setMuted(!isMuted());
      if (!isMuted()) play('select');
      const focusSound = true;
      render();
      if (focusSound) app.querySelector('[data-action="sound"]')?.focus({ preventScroll: true });
      break;
    }
    case 'pick-scenario': {
      const changed = state.scenarioId !== el.dataset.id;
      state.scenarioId = el.dataset.id;
      if (changed) {
        state.priorityId = getScenario(state.scenarioId).priorities[0].id;
        state.design = normalizeDesign(EMPTY_DESIGN);
        state.tab = 'science';
      }
      go('briefing');
      break;
    }
    case 'priority': state.priorityId = el.dataset.id; render(); break;
    case 'difficulty': state.difficultyId = el.dataset.id; render(); break;
    case 'mode': state.mode = el.dataset.id; render(); break;
    case 'enter-design': {
      const empty = !state.design.bus && !state.design.orbit && !state.design.instruments.length;
      if (state.useStarter && empty) loadStarter();
      go('design');
      break;
    }
    case 'tab': state.tab = el.dataset.tab; previewKey = null; render({ focus: `tab-${state.tab}` }); app.querySelector('.design-main')?.scrollIntoView({ block: 'start' }); break;
    case 'pick': {
      const selected = el.getAttribute('aria-pressed') === 'true';
      const res = applyPick(state.design, el.dataset.group, el.dataset.id);
      play(selected && el.dataset.group === 'instruments' ? 'deselect' : 'select');
      commitDesign(res.design, res.notes);
      break;
    }
    case 'count': {
      const d = normalizeDesign(state.design);
      d.count = Math.max(1, Math.min(8, d.count + Number(el.dataset.delta)));
      commitDesign(d);
      break;
    }
    case 'autoprop': {
      const d = normalizeDesign(state.design);
      d.propellant = autoPropellant(d, ctxOf(state));
      commitDesign(d, [tx(`Propellant set to ${smart(d.propellant)} kg.`, `Propelan diatur ${smart(d.propellant)} kg.`)]);
      break;
    }
    case 'gauge': state.openGauge = state.openGauge === el.dataset.id ? null : el.dataset.id; renderDash(); break;
    case 'stack-view': state.stackView = el.dataset.id; renderDash(); break;
    case 'starter': loadStarter(); render(); toast(tx('Starter design loaded. It flies, but look for its flaws.', 'Desain awal dimuat. Bisa terbang, tapi cari kelemahannya.')); break;
    case 'reset-design': state.design = normalizeDesign(EMPTY_DESIGN); state.votes = {}; render(); toast(tx('Design cleared.', 'Desain dikosongkan.')); break;
    case 'share': copyShare(); break;
    case 'vote': {
      state.votes = { ...state.votes, [el.dataset.role]: el.dataset.vote };
      const allGo = ROLE_IDS.every((r) => state.votes[r] === 'go');
      play(allGo ? 'allGo' : el.dataset.vote === 'go' ? 'go' : 'nogo');
      render();
      break;
    }
    case 'launch': launch(); break;
    case 'flight-pause': flightCtl?.togglePause(); break;
    case 'flight-speed': flightCtl?.cycleSpeed(); break;
    case 'flight-skip': flightCtl?.skip(); break;
    case 'to-report': go('report'); break;
    case 'revise': state.votes = {}; go('design'); break;
    case 'refly': launch(); break;
    default: break;
  }
});

app.addEventListener('input', (e) => {
  const el = e.target;
  const a = el.dataset.action;
  if (a === 'propellant') {
    state.design = { ...state.design, propellant: Number(el.value) };
    const out = el.closest('.prop-panel')?.querySelector('output');
    if (out) out.textContent = `${smart(Number(el.value))} kg`;
    renderDash();
  } else if (a === 'team-name') state.teamName = el.value;
  else if (a === 'player-name') state.players[Number(el.dataset.index)] = el.value;
});

app.addEventListener('change', (e) => {
  const el = e.target;
  const a = el.dataset.action;
  if (a === 'propellant') { state.votes = {}; render({ focus: 'propellant' }); }
  else if (a === 'player-count') {
    state.playerCount = Number(el.value);
    ROLE_IDS.forEach((r, i) => { state.roleAssign[r] = i % state.playerCount; });
    render();
  } else if (a === 'assign') { state.roleAssign[el.dataset.role] = Number(el.value); render(); }
  else if (a === 'use-starter') state.useStarter = el.checked;
  else if (a === 'player-name') render();
});

app.addEventListener('toggle', (e) => {
  if (e.target.matches?.('details.more')) state.showOtherInstruments = e.target.open;
}, true);

// Hover / focus previews on the design screen
function schedulePreview(key) {
  if (key === previewKey) return;
  previewKey = key;
  cancelAnimationFrame(previewRaf);
  previewRaf = requestAnimationFrame(() => {
    if (state.screen !== 'design') return;
    if (!previewKey) { renderDash(); return; }
    const [group, id] = previewKey.split(':');
    const res = applyPick(state.design, group, id, { silent: true });
    renderDash(JSON.stringify(res.design) === JSON.stringify(state.design) ? null : res.design);
  });
}
app.addEventListener('pointerover', (e) => {
  const card = e.target.closest('[data-preview]');
  if (card && card.getAttribute('aria-disabled') !== 'true' && !tourActive()) schedulePreview(card.dataset.preview);
});
app.addEventListener('pointerout', (e) => {
  const card = e.target.closest('[data-preview]');
  if (card && !card.contains(e.relatedTarget)) schedulePreview(null);
});
app.addEventListener('focusin', (e) => {
  const card = e.target.closest?.('[data-preview]');
  if (card && card.getAttribute('aria-disabled') !== 'true' && e.target.matches(':focus-visible')) schedulePreview(card.dataset.preview);
});
app.addEventListener('focusout', (e) => {
  if (e.target.closest?.('[data-preview]') && !e.relatedTarget?.closest?.('[data-preview]')) schedulePreview(null);
});

// Arrow keys move between role tabs
app.addEventListener('keydown', (e) => {
  const tab = e.target.closest?.('[role="tab"]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || tourActive()) return;
  e.preventDefault();
  const i = ROLE_IDS.indexOf(tab.dataset.tab);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? ROLE_IDS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + ROLE_IDS.length) % ROLE_IDS.length;
  state.tab = ROLE_IDS[next];
  render({ focus: `tab-${state.tab}` });
});

document.addEventListener('keydown', (e) => {
  if (tourActive()) return;
  if (e.key === 'Escape' && overlayOpen()) closeOverlays();
  else if (overlayOpen()) trapFocus(e);
});

// Codex links inside dialogs and the drawer
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action="codex"]');
  if (el && !app.contains(el)) openCodex(el.dataset.id ?? null);
});

// ---------------- Boot ----------------
document.documentElement.lang = getLang();
const shared = readShareHash();
if (shared) {
  state = { ...state, ...shared, screen: 'design', useStarter: false };
  toast(tx('Shared design loaded.', 'Desain yang dibagikan dimuat.'));
}
preloadTextures();
render();
