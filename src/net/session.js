// Online room. The host owns the room state. Everyone else sends actions and follows snapshots.
import { connectBroker } from './mqtt.js';
import { applyRoomAction, createRoom, rolesOf } from './roomLogic.js';

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => CODE[b % CODE.length]).join('');
}

let client = null;
let room = null;
let myId = '';
let isHost = false;
let topic = '';
let handlers = {};
let joinTimer = null;
let suppressClosed = false;

function emitStatus(phase, message = '') {
  handlers.onStatus?.(phase, message);
}

function publish(notes = []) {
  if (!client || !room) return;
  client.send(topic, JSON.stringify({ t: 'snap', room, notes }));
}

/** Drop the socket after a short pause so the last packet can leave. */
function hangUp() {
  const dying = client;
  stop({ close: false });
  if (dying) setTimeout(() => dying.close(), 250);
}

function accept(action, actorId) {
  const res = applyRoomAction(room, action, actorId, handlers.ctx?.() ?? null);
  if (res.closed) {
    client?.send(topic, JSON.stringify({ t: 'closed' }));
    hangUp();
    handlers.onClosed?.();
    return;
  }
  if (res.error) {
    if (actorId === myId) handlers.onReject?.(res.error);
    else client?.send(topic, JSON.stringify({ t: 'err', actor: actorId, error: res.error }));
    return;
  }
  // A repeated join asks for the snapshot again. Send it, but do not rebuild the page.
  if (res.room === room && !res.notes?.length) {
    publish();
    return;
  }
  room = res.room;
  const notes = res.notes ?? [];
  handlers.onRoom?.(room, notes);
  publish(notes);
}

function onPacket(text) {
  let msg;
  try { msg = JSON.parse(text); } catch { return; }
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'closed') {
    if (suppressClosed) return;
    stop();
    handlers.onClosed?.();
    return;
  }
  if (msg.t === 'err' && msg.actor === myId) {
    handlers.onReject?.(msg.error);
    if (msg.error === 'full') {
      stop();
      emitStatus('error', 'full');
    }
    return;
  }
  if (msg.t === 'snap' && !isHost && msg.room?.rev) {
    if (room && msg.room.rev <= room.rev) return;
    room = msg.room;
    clearInterval(joinTimer);
    joinTimer = null;
    handlers.onRoom?.(room, msg.notes ?? []);
    return;
  }
  if (msg.t === 'act' && isHost && room) accept(msg, msg.actor);
}

async function open(code) {
  topic = `spaceapps-gonogo/v1/${code}`;
  client = await connectBroker((_topic, text) => {
    if (_topic === topic) onPacket(text);
  });
  client.subscribe(topic);
}

function stop({ close = true } = {}) {
  clearInterval(joinTimer);
  joinTimer = null;
  if (close) client?.close();
  client = null;
  room = null;
  isHost = false;
  topic = '';
}

export function configure(next) {
  handlers = next;
}

export function current() {
  return room;
}

export function selfId() {
  return myId;
}

export function ensureId() {
  if (!myId) myId = makeId();
  return myId;
}

export async function host(name, mission = null) {
  const id = myId || makeId();
  suppressClosed = false;
  stop();
  myId = id;
  isHost = true;
  const code = makeCode();
  room = createRoom({ hostId: myId, hostName: name, mission });
  await open(code);
  publish();
  return { code, room };
}

export async function join(code, name) {
  const id = myId || makeId();
  suppressClosed = false;
  stop();
  myId = id;
  isHost = false;
  const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  await open(clean);
  const announce = () => client?.send(topic, JSON.stringify({ t: 'act', type: 'join', id: myId, name, actor: myId }));
  announce();
  joinTimer = setInterval(announce, 2000);
  setTimeout(() => {
    if (!room && joinTimer) {
      stop();
      emitStatus('error', 'missing');
    }
  }, 10000);
  return clean;
}

export function act(action) {
  if (!client) return;
  if (isHost) accept({ ...action, id: action.id ?? myId }, myId);
  else client.send(topic, JSON.stringify({ t: 'act', ...action, actor: myId }));
}

export function leave() {
  suppressClosed = true;
  const dying = client;
  const wasHost = isHost;
  const id = myId;
  const chan = topic;
  if (dying && room && id) {
    if (wasHost) dying.send(chan, JSON.stringify({ t: 'closed' }));
    else dying.send(chan, JSON.stringify({ t: 'act', type: 'leave', actor: id }));
  }
  stop({ close: false });
  if (dying) setTimeout(() => dying.close(), 250);
}

export function amHost() {
  return isHost;
}

export function myRoles() {
  return room ? rolesOf(room, myId) : [];
}
