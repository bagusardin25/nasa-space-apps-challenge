// Screens for an online team: the lobby, the briefing panel, and the connection bar.
import { icon, ROLE_ICON } from '../icons.js';
import { esc } from '../util.js';
import { roleMeta } from '../components.js';
import { ROLE_IDS } from '../../state.js';
import { tx } from '../../i18n.js';

export function roomLink(code) {
  const base = location.href.split('#')[0];
  return `${base}#room=${code}`;
}

export function renderNetBar(state) {
  const net = state.online;
  if (state.mode !== 'online' || net?.phase !== 'live') return '';
  const mine = (net.myRoles ?? []).map((id) => roleMeta(id).title);
  const who = mine.length
    ? mine.join(' · ')
    : tx('No station yet. Claim one.', 'Belum ada stasiun. Klaim satu.');
  const people = net.peers.length;
  return `<p class="net-bar">
    <span>${icon('users', { size: 15 })} <strong>${esc(net.code)}</strong> · ${people}/4 · ${esc(who)}</span>
    <button type="button" class="btn btn-ghost btn-sm" data-action="net-copy">${tx('Copy room link', 'Salin tautan ruang')}</button>
  </p>`;
}

function roleButtons(net) {
  return ROLE_IDS.map((id) => {
    const meta = roleMeta(id);
    const owner = net.peers.find((p) => p.roles?.includes(id));
    const mine = owner?.id === net.myId;
    const taken = owner && !mine;
    const label = mine
      ? tx('Release', 'Lepas')
      : taken
        ? owner.name
        : tx('Claim', 'Klaim');
    return `<button type="button" class="role-claim role-${id} ${mine ? 'is-mine' : ''} ${taken ? 'is-taken' : ''}"
      data-action="${mine ? 'net-release' : 'net-claim'}" data-role="${id}" ${taken ? 'disabled' : ''}>
      <span class="role-claim-i">${icon(ROLE_ICON[id], { size: 16 })}</span>
      <span><strong>${esc(meta.title)}</strong><em>${esc(label)}</em></span>
    </button>`;
  }).join('');
}

export function renderOnlineSetup(state) {
  const net = state.online;
  const live = net.phase === 'live';
  if (!live) {
    return `<div class="team-setup">
      <p class="muted small">${tx(
    'Each player joins from their own screen. The flight director picks the mission. Everyone else claims a station and can only change that part of the spacecraft.',
    'Setiap pemain masuk dari layarnya sendiri. Flight director memilih misi. Pemain lain mengklaim satu stasiun dan hanya bisa mengubah bagian itu.',
  )}</p>
      <div class="team-row">
        <label class="field"><span class="field-l">${tx('Your name', 'Namamu')}</span>
          <input type="text" maxlength="24" value="${esc(net.myName)}" placeholder="${tx('e.g. Sari', 'mis. Sari')}" data-action="net-name" data-focus="net-name" autocomplete="nickname" /></label>
        <label class="field"><span class="field-l">${tx('Room code', 'Kode ruang')}</span>
          <input type="text" maxlength="6" value="${esc(net.joinCode)}" placeholder="AB12CD" data-action="net-code" data-focus="net-code" autocapitalize="characters" /></label>
      </div>
      <div class="net-actions">
        <button type="button" class="btn btn-primary" data-action="net-host" ${net.phase === 'connecting' ? 'disabled' : ''}>${tx('Create a room', 'Buat ruang')}</button>
        <button type="button" class="btn btn-secondary" data-action="net-join" ${net.phase === 'connecting' ? 'disabled' : ''}>${tx('Join with code', 'Masuk dengan kode')}</button>
      </div>
      ${net.message ? `<p class="net-msg">${esc(net.message)}</p>` : ''}
    </div>`;
  }
  const director = net.peers.find((p) => p.id === net.hostId)?.name ?? tx('Flight director', 'Flight director');
  return `<div class="team-setup">
    <p><strong>${tx('Room', 'Ruang')} ${esc(net.code)}</strong> · ${tx('Flight director:', 'Flight director:')} ${esc(director)}</p>
    <p class="muted small">${net.isHost
    ? tx('Share the code or the room link. You fly any station that nobody has claimed.', 'Bagikan kode atau tautan ruang. Kamu menerbangkan stasiun yang belum diklaim siapa pun.')
    : tx('Claim your station. You will follow the flight director into the design room.', 'Klaim stasiunmu. Kamu akan mengikuti flight director masuk ke ruang desain.')}</p>
    ${net.isHost
    ? `<label class="field"><span class="field-l">${tx('Team name', 'Nama tim')}</span>
        <input type="text" maxlength="28" value="${esc(state.teamName)}" placeholder="${tx('e.g. Orbit Rangers', 'mis. Orbit Rangers')}" data-action="team-name" data-focus="team-name" autocomplete="off" /></label>`
    : (state.teamName ? `<p class="muted small">${tx('Team', 'Tim')}: ${esc(state.teamName)}</p>` : '')}
    <div class="role-claims">${roleButtons(net)}</div>
    <div class="net-actions">
      <button type="button" class="btn btn-secondary btn-sm" data-action="net-copy">${tx('Copy room link', 'Salin tautan ruang')}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="net-leave">${tx('Leave room', 'Keluar dari ruang')}</button>
    </div>
  </div>`;
}

export function renderLobby(state) {
  const net = state.online;
  return `<main class="page lobby" id="main">
    <p class="eyebrow">${tx('Online team', 'Tim daring')}</p>
    <h1>${tx('Join a room', 'Masuk ke ruang')}</h1>
    <p class="lede">${tx('Ask the flight director for the six-letter code, then claim a station.', 'Minta kode enam huruf dari flight director, lalu klaim satu stasiun.')}</p>
    <div class="team-setup">
      <div class="team-row">
        <label class="field"><span class="field-l">${tx('Your name', 'Namamu')}</span>
          <input type="text" maxlength="24" value="${esc(net.myName)}" data-action="net-name" data-focus="net-name" autocomplete="nickname" /></label>
        <label class="field"><span class="field-l">${tx('Room code', 'Kode ruang')}</span>
          <input type="text" maxlength="6" value="${esc(net.joinCode)}" data-action="net-code" data-focus="net-code" autocapitalize="characters" /></label>
      </div>
      <div class="net-actions">
        <button type="button" class="btn btn-primary" data-action="net-join" data-focus="start" ${net.phase === 'connecting' ? 'disabled' : ''}>${tx('Join room', 'Masuk ruang')}</button>
        <button type="button" class="btn btn-ghost" data-action="home">${tx('Back', 'Kembali')}</button>
      </div>
      ${net.phase === 'connecting' ? `<p class="net-msg">${tx('Looking for that room…', 'Mencari ruang itu…')}</p>` : ''}
      ${net.message ? `<p class="net-msg">${esc(net.message)}</p>` : ''}
    </div>
  </main>`;
}
