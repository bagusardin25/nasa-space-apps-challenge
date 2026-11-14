// GO/NO-GO entry point: state, routing and event handling.
import { computeMission, autoPropellant, normalizeDesign, EMPTY_DESIGN } from './engine/mission.js';
import { createFlight, hashString } from './engine/sim.js';
import { scoreMission } from './engine/score.js';
import { getScenario } from './data/scenarios.js';
import { initialState, ctxOf, shareUrl, readShareHash, saveRun, ROLE_IDS, isSharedTeam } from './state.js';
import { applyPick } from './ui/picks.js';
import { renderTitle, renderScenarios, renderBriefing } from './ui/screens/intro.js';
import { renderLobby, renderNetBar, roomLink } from './ui/screens/online.js';
import { renderDesign, renderDashboard } from './ui/screens/design.js';
import { renderGoNoGo } from './ui/screens/gonogo.js';
import { renderFlight, mountFlight } from './ui/screens/flight.js';
import { renderReport } from './ui/screens/report.js';
import { roleMeta } from './ui/components.js';
import { openCodex, openHowTo, openAbout, closeOverlays, overlayOpen, toast, trapFocus } from './ui/overlays.js';
import { preloadTextures } from './ui/flightCanvas.js';
import { launchStack } from './ui/launchStack.js';
import { syncRocketView, disposeRocketView, onRocketViewFail } from './ui/rocketView3d.js';
import { startTour, tourSeen, endTour, tourActive } from './ui/tour.js';
import { play, setMuted, isMuted } from './ui/audio.js';
import { smart } from './ui/util.js';
import { tx, nameOf, getLang, setLang } from './i18n.js';
import * as session from './net/session.js';
import { EVENT_ROLE, rolesOf } from './net/roomLogic.js';

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
    case 'lobby': html = renderLobby(state); title = tx('Join a room · GO/NO-GO', 'Masuk ke ruang · GO/NO-GO'); break;
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
  app.innerHTML = `${renderNetBar(state)}${html}`;
  lastScreen = state.screen;
  if (designMetrics) syncStack(designMetrics);
  else disposeRocketView();

  if (state.screen === 'flight' && !flightCtl) {
    flightCtl = mountFlight(app, {
      state, m: state.flightMetrics, ctx, onFinish: finishFlight,
      link: state.mode === 'online' ? flightLink() : null,
    });
    if (state.mode === 'online') flightCtl.setDecisions(state.onlineDecisions);
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

// ---------------- Online room ----------------
const NET_ERRORS = {
  full: () => tx('That room is full (4 players).', 'Ruang itu sudah penuh (4 pemain).'),
  taken: () => tx('Another player already leads that station.', 'Pemain lain sudah memimpin stasiun itu.'),
  'not-your-station': () => tx('That station is not yours.', 'Stasiun itu bukan milikmu.'),
  'host-only': () => tx('Only the flight director can do that.', 'Hanya flight director yang bisa melakukan itu.'),
  stale: () => tx('That decision was already made.', 'Keputusan itu sudah diambil.'),
  missing: () => tx('No room with that code. Ask the flight director to check it.', 'Tidak ada ruang dengan kode itu. Minta flight director memeriksanya.'),
  'no-broker': () => tx('Could not reach a room server. Check your connection and try again.', 'Tidak bisa menghubungi server ruang. Periksa koneksimu dan coba lagi.'),
  'not-ready': () => tx('Every station must call GO before launch.', 'Setiap stasiun harus GO sebelum meluncur.'),
  'not-in-room': () => tx('You are not in this room anymore.', 'Kamu sudah tidak ada di ruang ini.'),
};

function netMessage(code) {
  return (NET_ERRORS[code] ?? (() => tx('That action was rejected.', 'Aksi itu ditolak.')))();
}

function flightLink() {
  return {
    canChoose(eventId) {
      const role = EVENT_ROLE[eventId];
      const mine = state.online.myRoles ?? [];
      return role ? mine.includes(role) : state.online.isHost;
    },
    waitText(eventId) {
      const role = EVENT_ROLE[eventId];
      const title = role ? roleMeta(role).title : tx('the flight director', 'flight director');
      return tx(`Waiting for ${title} to decide.`, `Menunggu ${title} memutuskan.`);
    },
    send(eventId, optionId, index) {
      session.act({ type: 'choice', eventId, optionId, index });
    },
  };
}

function adoptRoom(next, notes = []) {
  if (!next?.hostId || !getScenario(next.scenarioId)) return;
  const prevSeed = state.flight?.seed;
  state.design = normalizeDesign(next.design);
  state.votes = next.votes ?? {};
  state.scenarioId = next.scenarioId;
  state.priorityId = next.priorityId;
  state.difficultyId = next.difficultyId ?? 'engineer';
  state.teamName = next.teamName ?? '';
  state.onlineDecisions = next.decisions ?? [];
  state.online = {
    ...state.online,
    phase: 'live',
    hostId: next.hostId,
    isHost: next.hostId === state.online.myId,
    peers: next.peers,
    myRoles: rolesOf(next, state.online.myId),
    message: '',
  };
  if (next.screen === 'flight' && next.seed != null && prevSeed !== next.seed) {
    const ctx = ctxOf(state);
    const m = metrics();
    state.overrides = 0;
    state.cautions = 0;
    state.flightMetrics = m;
    state.flight = createFlight(m, ctx, next.seed);
    state.result = null;
    state.screen = 'flight';
    render();
    notes.forEach((n) => toast(n));
    return;
  }
  if (next.screen === 'flight' && state.screen === 'flight') {
    flightCtl?.setDecisions(state.onlineDecisions);
    notes.forEach((n) => toast(n));
    return;
  }
  state.screen = next.screen || state.screen;
  previewKey = null;
  render();
  notes.forEach((n) => toast(n));
}

function onlineName() {
  return state.online.myName.trim() || tx('Player', 'Pemain');
}

async function hostRoom() {
  state.online.phase = 'connecting';
  state.online.message = '';
  state.online.myId = session.ensureId();
  state.mode = 'online';
  render();
  try {
    const opened = await session.host(onlineName(), {
      scenarioId: state.scenarioId,
      priorityId: state.priorityId,
      difficultyId: state.difficultyId,
      teamName: state.teamName,
      design: state.design,
    });
    state.online.code = opened.code;
    state.online.joinCode = opened.code;
    history.replaceState(null, '', `${location.pathname}${location.search}#room=${opened.code}`);
    adoptRoom(opened.room);
  } catch {
    session.leave();
    state.online.phase = 'error';
    state.online.message = netMessage('no-broker');
    render();
  }
}

async function joinRoom() {
  const clean = state.online.joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (clean.length < 4) {
    state.online.message = tx('Enter the room code.', 'Masukkan kode ruang.');
    render();
    return;
  }
  state.online.phase = 'connecting';
  state.online.message = '';
  state.online.code = clean;
  state.online.joinCode = clean;
  state.online.myId = session.ensureId();
  state.mode = 'online';
  history.replaceState(null, '', `${location.pathname}${location.search}#room=${clean}`);
  render();
  try {
    await session.join(clean, onlineName());
  } catch {
    state.online.phase = 'error';
    state.online.message = netMessage('no-broker');
    render();
  }
}

function leaveRoom() {
  session.leave();
  state.online = { ...initialState().online, myName: state.online.myName, joinCode: state.online.joinCode };
  state.onlineDecisions = [];
  if (location.hash.includes('room=')) history.replaceState(null, '', location.pathname + location.search);
}

session.configure({
  ctx: () => ctxOf(state),
  onRoom: (next, notes) => adoptRoom(next, notes),
  onReject: (code) => toast(netMessage(code), 'bad'),
  onClosed: () => {
    leaveRoom();
    toast(tx('The flight director closed the room.', 'Flight director menutup ruang.'), 'bad');
    go('title');
  },
  onStatus: (phase, code) => {
    if (phase === 'error') {
      state.online.phase = 'error';
      state.online.message = netMessage(code);
      render();
    }
  },
});

// ---------------- Flight ----------------
function launch() {
  const ctx = ctxOf(state);
  const m = metrics();
  if (!m.complete) return;
  if (isSharedTeam(state) && !ROLE_IDS.every((r) => state.votes[r] === 'go')) return;
  state.overrides = isSharedTeam(state) ? 0 : [...ROLE_IDS, 'mission'].filter((r) => m.roles[r].status === 'nogo').length;
  state.cautions = isSharedTeam(state) ? 0 : [...ROLE_IDS, 'mission'].filter((r) => m.roles[r].status === 'caution').length;
  state.runCount += 1;
  const seed = (hashString(JSON.stringify(state.design) + state.scenarioId + state.priorityId + state.difficultyId) ^ Math.imul(state.runCount, 2654435761)) >>> 0;
  if (state.mode === 'online') {
    session.act({ type: 'launch', seed });
    return;
  }
  state.flightMetrics = m;
  state.flight = createFlight(m, ctx, seed);
  state.result = null;
  go('flight');
}

function finishFlight() {
  const ctx = ctxOf(state);
  const m = state.flightMetrics;
  state.result = scoreMission(m, state.flight, ctx, { team: isSharedTeam(state), overrides: state.overrides, cautions: state.cautions });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  saveRun({
    id,
    scenarioId: state.scenarioId,
    priorityId: ctx.priority.id,
    name: isSharedTeam(state) ? (state.teamName.trim() || tx('Team', 'Tim')) : tx('Solo run', 'Main solo'),
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
app.addEventListener('click', async (e) => {
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
    case 'home':
      if (state.online.phase === 'live' || state.online.phase === 'connecting') leaveRoom();
      state.mode = state.mode === 'online' ? 'solo' : state.mode;
      go('title');
      break;
    case 'go': {
      const screen = el.dataset.screen;
      const shared = ['briefing', 'design', 'gonogo'];
      const live = state.mode === 'online' && (state.online.phase === 'live' || state.online.phase === 'connecting');
      if (live && shared.includes(screen)) {
        if (state.online.phase !== 'live' || !state.online.isHost) {
          toast(netMessage('host-only'), 'bad');
          break;
        }
        session.act({ type: 'screen', screen });
        break;
      }
      if (live && ['title', 'scenarios', 'lobby'].includes(screen)) {
        leaveRoom();
        state.mode = 'solo';
      }
      go(screen);
      break;
    }
    case 'step': {
      // Go back to an earlier step from the bar at the top (or the button under the flight view).
      const screen = el.dataset.screen;
      if (!['briefing', 'design', 'gonogo'].includes(screen)) break;
      const midFlight = state.screen === 'flight' && !state.flight?.done;
      if (state.mode === 'online' && (state.online.phase === 'live' || state.online.phase === 'connecting')) {
        if (state.online.phase !== 'live' || !state.online.isHost) { toast(netMessage('host-only'), 'bad'); break; }
        if (state.screen === 'flight') break;
        session.act({ type: 'screen', screen, clearVotes: true });
        break;
      }
      if (state.screen === 'flight' || state.screen === 'report') state.votes = {};
      go(screen);
      if (midFlight) toast(tx('Flight stopped. Change the design, then launch again.', 'Penerbangan dihentikan. Ubah desainnya, lalu luncurkan lagi.'));
      break;
    }
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
        if (state.result) state.result = scoreMission(state.flightMetrics, state.flight, ctx, { team: isSharedTeam(state), overrides: state.overrides, cautions: state.cautions });
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
      if (state.mode === 'online' && state.online.phase === 'live' && !state.online.isHost) break;
      const changed = state.scenarioId !== el.dataset.id;
      const priorityId = changed ? getScenario(el.dataset.id).priorities[0].id : state.priorityId;
      if (state.mode === 'online' && state.online.phase === 'live') {
        session.act({ type: 'scenario', id: el.dataset.id, priorityId });
        break;
      }
      state.scenarioId = el.dataset.id;
      if (changed) {
        state.priorityId = priorityId;
        state.design = normalizeDesign(EMPTY_DESIGN);
        state.tab = 'science';
      }
      go('briefing');
      break;
    }
    case 'priority':
      if (state.mode === 'online' && state.online.phase === 'live') {
        if (state.online.isHost) session.act({ type: 'priority', id: el.dataset.id });
        break;
      }
      state.priorityId = el.dataset.id; render(); break;
    case 'difficulty':
      if (state.mode === 'online' && state.online.phase === 'live') {
        if (state.online.isHost) session.act({ type: 'difficulty', id: el.dataset.id });
        break;
      }
      state.difficultyId = el.dataset.id; render(); break;
    case 'mode':
      if (state.online.phase === 'live' || state.online.phase === 'connecting') leaveRoom();
      state.mode = el.dataset.id;
      render();
      break;
    case 'enter-design': {
      if (state.mode === 'online' && state.online.phase === 'live' && !state.online.isHost) break;
      const empty = !state.design.bus && !state.design.orbit && !state.design.instruments.length;
      if (state.useStarter && empty) loadStarter();
      if (state.mode === 'online' && state.online.phase === 'live') {
        session.act({ type: 'enter', design: state.design });
        break;
      }
      go('design');
      break;
    }
    case 'tab': state.tab = el.dataset.tab; previewKey = null; render({ focus: `tab-${state.tab}` }); app.querySelector('.design-main')?.scrollIntoView({ block: 'start' }); break;
    case 'pick': {
      const selected = el.getAttribute('aria-pressed') === 'true';
      play(selected && el.dataset.group === 'instruments' ? 'deselect' : 'select');
      if (state.mode === 'online' && state.online.phase === 'live') {
        session.act({ type: 'pick', group: el.dataset.group, id: el.dataset.id });
        break;
      }
      const res = applyPick(state.design, el.dataset.group, el.dataset.id, { ctx: ctxOf(state) });
      commitDesign(res.design, res.notes);
      break;
    }
    case 'count': {
      if (state.mode === 'online' && state.online.phase === 'live') {
        session.act({ type: 'pick', group: 'count', delta: Number(el.dataset.delta) });
        break;
      }
      const d = normalizeDesign(state.design);
      d.count = Math.max(1, Math.min(8, d.count + Number(el.dataset.delta)));
      commitDesign(d);
      break;
    }
    case 'autoprop': {
      if (state.mode === 'online' && state.online.phase === 'live') {
        session.act({ type: 'autoprop' });
        break;
      }
      const d = normalizeDesign(state.design);
      d.propellant = autoPropellant(d, ctxOf(state));
      commitDesign(d, [tx(`Propellant set to ${smart(d.propellant)} kg.`, `Propelan diatur ${smart(d.propellant)} kg.`)]);
      break;
    }
    case 'net-host': hostRoom(); break;
    case 'net-join': joinRoom(); break;
    case 'net-leave': leaveRoom(); go(state.screen === 'lobby' ? 'title' : 'briefing'); break;
    case 'net-claim': session.act({ type: 'claim', role: el.dataset.role }); break;
    case 'net-release': session.act({ type: 'release', role: el.dataset.role }); break;
    case 'net-copy': {
      const url = roomLink(state.online.code || state.online.joinCode);
      try {
        await navigator.clipboard.writeText(url);
        toast(tx('Room link copied.', 'Tautan ruang disalin.'), 'good');
      } catch {
        window.prompt(tx('Copy this room link:', 'Salin tautan ruang ini:'), url);
      }
      break;
    }
    case 'gauge': state.openGauge = state.openGauge === el.dataset.id ? null : el.dataset.id; renderDash(); break;
    case 'stack-view': state.stackView = el.dataset.id; renderDash(); break;
    case 'starter':
      if (state.mode === 'online' && !state.online.isHost) break;
      loadStarter();
      if (state.mode === 'online' && state.online.phase === 'live') session.act({ type: 'design', design: state.design });
      else { render(); toast(tx('Starter design loaded. It flies, but look for its flaws.', 'Desain awal dimuat. Bisa terbang, tapi cari kelemahannya.')); }
      break;
    case 'reset-design':
      if (state.mode === 'online' && !state.online.isHost) break;
      if (state.mode === 'online' && state.online.phase === 'live') session.act({ type: 'design', design: normalizeDesign(EMPTY_DESIGN) });
      else { state.design = normalizeDesign(EMPTY_DESIGN); state.votes = {}; render(); toast(tx('Design cleared.', 'Desain dikosongkan.')); }
      break;
    case 'share': copyShare(); break;
    case 'vote': {
      play(el.dataset.vote === 'go' ? 'go' : 'nogo');
      if (state.mode === 'online' && state.online.phase === 'live') {
        session.act({ type: 'vote', role: el.dataset.role, vote: el.dataset.vote });
        break;
      }
      state.votes = { ...state.votes, [el.dataset.role]: el.dataset.vote };
      if (ROLE_IDS.every((r) => state.votes[r] === 'go')) play('allGo');
      render();
      break;
    }
    case 'launch': launch(); break;
    case 'flight-pause': flightCtl?.togglePause(); break;
    case 'flight-speed': flightCtl?.cycleSpeed(); break;
    case 'flight-skip': flightCtl?.skip(); break;
    case 'to-report': go('report'); break;
    case 'revise':
      if (state.mode === 'online' && state.online.phase === 'live') {
        if (state.online.isHost) session.act({ type: 'screen', screen: 'design', clearVotes: true });
        break;
      }
      state.votes = {}; go('design'); break;
    case 'refly': launch(); break;
    default: break;
  }
});

app.addEventListener('input', (e) => {
  const el = e.target;
  const a = el.dataset.action;
  if (a === 'propellant') {
    if (state.mode === 'online' && state.online.phase === 'live' && !state.online.myRoles?.includes('spacecraft')) return;
    state.design = { ...state.design, propellant: Number(el.value) };
    const out = el.closest('.prop-panel')?.querySelector('output');
    if (out) out.textContent = `${smart(Number(el.value))} kg`;
    renderDash();
  } else if (a === 'team-name') state.teamName = el.value;
  else if (a === 'player-name') state.players[Number(el.dataset.index)] = el.value;
  else if (a === 'net-name') state.online.myName = el.value;
  else if (a === 'net-code') state.online.joinCode = el.value.toUpperCase();
});

app.addEventListener('change', (e) => {
  const el = e.target;
  const a = el.dataset.action;
  if (a === 'propellant') {
    if (state.mode === 'online' && state.online.phase === 'live') session.act({ type: 'pick', group: 'propellant', value: Number(el.value) });
    else { state.votes = {}; render({ focus: 'propellant' }); }
  } else if (a === 'net-name' && state.online.phase === 'live') session.act({ type: 'name', name: state.online.myName });
  else if (a === 'team-name' && state.mode === 'online' && state.online.phase === 'live' && state.online.isHost) {
    session.act({ type: 'team-name', name: state.teamName });
  }
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
    const res = applyPick(state.design, group, id, { silent: true, ctx: ctxOf(state) });
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
} else {
  const roomCode = location.hash.match(/^#room=([A-Za-z0-9]{4,8})/)?.[1];
  if (roomCode) {
    state.online.joinCode = roomCode.toUpperCase().slice(0, 6);
    state.screen = 'lobby';
    state.mode = 'online';
  }
}
preloadTextures();
render();
