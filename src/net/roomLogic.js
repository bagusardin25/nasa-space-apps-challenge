// Rules for an online room. Pure functions: the host applies them, then sends the result
// to everyone else. No sockets here, so the tests can run them.
import { EMPTY_DESIGN, autoPropellant, normalizeDesign } from '../engine/mission.js';
import { getScenario } from '../data/scenarios.js';
import { ROLE_IDS } from '../state.js';
import { applyPick } from '../ui/picks.js';
import { tx } from '../i18n.js';

export const ROLE_GROUPS = {
  science: ['instruments'],
  launch: ['orbit', 'launcher', 'count'],
  spacecraft: ['bus', 'solar', 'battery', 'adcs', 'propulsion', 'propellant'],
  ground: ['radio', 'network', 'ops'],
};

/** Which station answers an in-flight event. The host covers anything not listed. */
export const EVENT_ROLE = {
  'solar-storm': 'ground',
  debris: 'launch',
  wheel: 'spacecraft',
  'gs-outage': 'ground',
  'budget-cut': 'ground',
  instrument: 'science',
  'battery-fade': 'spacecraft',
  mascon: 'launch',
  'opp-semeru': 'science',
  'opp-archipelago': 'ground',
  'opp-lunar': 'launch',
  'opp-solar': 'ground',
};

export const MAX_PLAYERS = 4;

export function groupRole(group) {
  return Object.keys(ROLE_GROUPS).find((role) => ROLE_GROUPS[role].includes(group)) ?? null;
}

/** Roles this person may change. The host also covers stations nobody has claimed. */
export function rolesOf(room, peerId) {
  const mine = room.peers.find((p) => p.id === peerId)?.roles ?? [];
  if (peerId !== room.hostId) return mine;
  const taken = new Set(room.peers.flatMap((p) => p.roles));
  return [...mine, ...ROLE_IDS.filter((role) => !taken.has(role))];
}

export function createRoom({ hostId, hostName, mission = null }) {
  return {
    rev: 1,
    hostId,
    peers: [{ id: hostId, name: String(hostName || 'Flight Director').slice(0, 24), roles: [] }],
    screen: 'briefing',
    scenarioId: mission?.scenarioId ?? null,
    priorityId: mission?.priorityId ?? null,
    difficultyId: mission?.difficultyId ?? 'engineer',
    teamName: mission?.teamName ?? '',
    design: normalizeDesign(mission?.design ?? EMPTY_DESIGN),
    votes: {},
    seed: null,
    decisions: [],
  };
}

function bump(room, patch) {
  return { ...room, ...patch, rev: room.rev + 1 };
}

/**
 * Apply one action from a player.
 * `ctx` is the host's mission context, needed only for propellant sizing.
 * Returns { room, notes } or { error }.
 */
export function applyRoomAction(room, action, actorId, ctx = null) {
  const known = room.peers.some((p) => p.id === actorId);
  if (action.type !== 'join' && !known) return { error: 'not-in-room' };
  const host = actorId === room.hostId;
  const holds = (role) => rolesOf(room, actorId).includes(role);

  switch (action.type) {
    case 'join': {
      if (!actorId) return { error: 'bad-join' };
      if (room.peers.some((p) => p.id === actorId)) return { room };
      if (room.peers.length >= MAX_PLAYERS) return { error: 'full' };
      const name = String(action.name || 'Player').slice(0, 24);
      return { room: bump(room, { peers: [...room.peers, { id: actorId, name, roles: [] }] }) };
    }
    case 'leave': {
      if (actorId === room.hostId) return { error: 'closed', closed: true };
      const votes = { ...room.votes };
      for (const role of room.peers.find((p) => p.id === actorId)?.roles ?? []) delete votes[role];
      return { room: bump(room, { peers: room.peers.filter((p) => p.id !== actorId), votes }) };
    }
    case 'name': {
      const name = String(action.name || '').slice(0, 24);
      return { room: bump(room, { peers: room.peers.map((p) => (p.id === actorId ? { ...p, name } : p)) }) };
    }
    case 'claim': {
      if (!ROLE_IDS.includes(action.role)) return { error: 'bad-role' };
      const owner = room.peers.find((p) => p.roles.includes(action.role));
      if (owner && owner.id !== actorId) return { error: 'taken' };
      const peers = room.peers.map((p) => {
        const roles = p.roles.filter((r) => r !== action.role);
        if (p.id === actorId) roles.push(action.role);
        return { ...p, roles };
      });
      const votes = { ...room.votes };
      delete votes[action.role];
      return { room: bump(room, { peers, votes }) };
    }
    case 'release': {
      const peers = room.peers.map((p) => (
        p.id === actorId ? { ...p, roles: p.roles.filter((r) => r !== action.role) } : p
      ));
      const votes = { ...room.votes };
      delete votes[action.role];
      return { room: bump(room, { peers, votes }) };
    }
    case 'scenario':
      if (!host) return { error: 'host-only' };
      if (!getScenario(action.id)) return { error: 'bad-screen' };
      return { room: bump(room, {
        scenarioId: action.id,
        priorityId: action.priorityId,
        screen: 'briefing',
        design: normalizeDesign(EMPTY_DESIGN),
        votes: {},
        seed: null,
        decisions: [],
      }) };
    case 'priority':
      if (!host) return { error: 'host-only' };
      return { room: bump(room, { priorityId: action.id, votes: {} }) };
    case 'difficulty':
      if (!host) return { error: 'host-only' };
      return { room: bump(room, { difficultyId: action.id, votes: {} }) };
    case 'team-name':
      if (!host) return { error: 'host-only' };
      return { room: bump(room, { teamName: String(action.name || '').slice(0, 28) }) };
    case 'enter':
      if (!host) return { error: 'host-only' };
      return { room: bump(room, { screen: 'design', design: normalizeDesign(action.design), votes: {} }) };
    case 'design':
      if (!host) return { error: 'host-only' };
      return { room: bump(room, { design: normalizeDesign(action.design), votes: {} }) };
    case 'screen': {
      if (!host) return { error: 'host-only' };
      if (!['briefing', 'design', 'gonogo'].includes(action.screen)) return { error: 'bad-screen' };
      const votes = action.clearVotes ? {} : room.votes;
      return { room: bump(room, { screen: action.screen, votes }) };
    }
    case 'pick': {
      const role = groupRole(action.group);
      if (!role || !holds(role)) return { error: 'not-your-station' };
      if (action.group === 'count') {
        const design = normalizeDesign(room.design);
        design.count = Math.max(1, Math.min(8, design.count + Number(action.delta)));
        return { room: bump(room, { design, votes: {} }) };
      }
      if (action.group === 'propellant') {
        return { room: bump(room, { design: normalizeDesign({ ...room.design, propellant: Number(action.value) }), votes: {} }) };
      }
      const res = applyPick(room.design, action.group, action.id, { silent: true, ctx });
      return { room: bump(room, { design: res.design, votes: {} }), notes: res.notes };
    }
    case 'autoprop': {
      if (!holds('spacecraft')) return { error: 'not-your-station' };
      if (!ctx) return { error: 'no-context' };
      const design = normalizeDesign(room.design);
      design.propellant = autoPropellant(design, ctx);
      const notes = [tx(`Propellant set to ${Math.round(design.propellant)} kg.`, `Propelan diatur ${Math.round(design.propellant)} kg.`)];
      return { room: bump(room, { design, votes: {} }), notes };
    }
    case 'vote': {
      if (!ROLE_IDS.includes(action.role) || !holds(action.role)) return { error: 'not-your-station' };
      if (action.vote !== 'go' && action.vote !== 'nogo') return { error: 'bad-vote' };
      return { room: bump(room, { votes: { ...room.votes, [action.role]: action.vote } }) };
    }
    case 'launch':
      if (!host) return { error: 'host-only' };
      if (!ROLE_IDS.every((role) => room.votes[role] === 'go')) return { error: 'not-ready' };
      return { room: bump(room, { screen: 'flight', seed: action.seed >>> 0, decisions: [] }) };
    case 'choice': {
      const role = EVENT_ROLE[action.eventId];
      if (role && !holds(role)) return { error: 'not-your-station' };
      if (!role && !host) return { error: 'host-only' };
      if (room.decisions.length !== action.index) return { error: 'stale' };
      return { room: bump(room, { decisions: [...room.decisions, { eventId: action.eventId, optionId: action.optionId }] }) };
    }
    default:
      return { error: 'unknown' };
  }
}
