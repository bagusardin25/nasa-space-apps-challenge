// Global game state, share links and the local leaderboard.

import { EMPTY_DESIGN, normalizeDesign } from './engine/mission.js';
import { getScenario, getPriority, getDifficulty } from './data/scenarios.js';

export const ROLE_IDS = ['science', 'launch', 'spacecraft', 'ground'];

export function initialState() {
  return {
    screen: 'title',
    scenarioId: null,
    priorityId: null,
    difficultyId: 'engineer',
    mode: 'solo',
    teamName: '',
    players: ['', '', '', ''],
    playerCount: 4,
    roleAssign: { science: 0, launch: 1, spacecraft: 2, ground: 3 },
    useStarter: true,
    design: normalizeDesign(EMPTY_DESIGN),
    tab: 'science',
    preview: null,
    showOtherInstruments: false,
    openGauge: null,
    stackView: 'rocket',
    rocket3dFailed: false,
    votes: {},
    online: {
      phase: 'idle',
      code: '',
      joinCode: '',
      myName: '',
      isHost: false,
      hostId: '',
      myId: '',
      myRoles: [],
      peers: [],
      message: '',
    },
    onlineDecisions: [],
    overrides: 0,
    runCount: 0,
    flight: null,
    flightMetrics: null,
    result: null,
    lastSaved: null,
  };
}

export function ctxOf(state) {
  const scenario = getScenario(state.scenarioId);
  if (!scenario) return null;
  return { scenario, priority: getPriority(scenario, state.priorityId), difficulty: getDifficulty(state.difficultyId) };
}

export function isSharedTeam(state) {
  return state.mode === 'team' || state.mode === 'online';
}

export function playerFor(state, role) {
  if (state.mode === 'online') {
    const peer = state.online?.peers?.find((p) => p.roles?.includes(role));
    return peer?.name || null;
  }
  if (state.mode !== 'team') return null;
  const idx = state.roleAssign[role] ?? 0;
  const name = (state.players[idx] ?? '').trim();
  return name || `Player ${idx + 1}`;
}

// ---------- Share links ----------
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function shareUrl(state) {
  const payload = { v: 1, s: state.scenarioId, p: state.priorityId, d: state.difficultyId, x: state.design };
  const base = location.href.split('#')[0];
  return `${base}#mission=${b64urlEncode(JSON.stringify(payload))}`;
}

export function readShareHash() {
  const m = location.hash.match(/mission=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const payload = JSON.parse(b64urlDecode(m[1]));
    if (!getScenario(payload.s)) return null;
    return { scenarioId: payload.s, priorityId: payload.p, difficultyId: payload.d ?? 'engineer', design: normalizeDesign(payload.x) };
  } catch {
    return null;
  }
}

// ---------- Leaderboard (per browser) ----------
const LB_KEY = 'gonogo.leaderboard.v1';

function readBoard() {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export function leaderboard(scenarioId, priorityId) {
  return (readBoard()[`${scenarioId}:${priorityId}`] ?? []).slice(0, 8);
}

export function saveRun(entry) {
  const board = readBoard();
  const key = `${entry.scenarioId}:${entry.priorityId}`;
  const list = board[key] ?? [];
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  board[key] = list.slice(0, 20);
  try {
    localStorage.setItem(LB_KEY, JSON.stringify(board));
  } catch {
    /* storage unavailable: the leaderboard simply won't persist */
  }
  return entry;
}
