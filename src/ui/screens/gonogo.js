// The Go/No-Go poll: every role reports before launch.
import { icon, ROLE_ICON } from '../icons.js';
import { esc, statusPill, money, num } from '../util.js';
import { topBar, roleMeta, issueItem } from '../components.js';
import { isSharedTeam, playerFor, ROLE_IDS } from '../../state.js';
import { tx } from '../../i18n.js';

export function renderGoNoGo(state, m, ctx) {
  const team = isSharedTeam(state);
  const online = state.mode === 'online' && state.online?.phase === 'live';
  const lead = !online || state.online.isHost;
  const rows = [...ROLE_IDS, 'mission'].map((id) => {
    const r = roleMeta(id);
    const st = m.roles[id];
    const auto = st.status;
    const vote = state.votes[id];
    const player = id === 'mission' ? (team ? tx('Whole team', 'Seluruh tim') : null) : playerFor(state, id);
    const issues = st.issues.filter((i) => i.severity !== 'info').slice(0, 3);
    const missing = st.missing.map((x) => x.label);
    const mine = !online || state.online.myRoles?.includes(id);
    const voteCtrl = team && id !== 'mission'
      ? `<div class="vote" role="group" aria-label="${esc(tx(`${r.title} vote`, `Suara ${r.title}`))}">
          <button type="button" class="vote-btn go ${vote === 'go' ? 'is-on' : ''}" aria-pressed="${vote === 'go'}" data-action="vote" data-role="${id}" data-vote="go" ${auto === 'incomplete' || !mine ? 'disabled' : ''} data-focus="vote-${id}-go">GO</button>
          <button type="button" class="vote-btn nogo ${vote === 'nogo' ? 'is-on' : ''}" aria-pressed="${vote === 'nogo'}" data-action="vote" data-role="${id}" data-vote="nogo" ${!mine ? 'disabled' : ''} data-focus="vote-${id}-nogo">NO-GO</button>
          ${online && !mine ? `<span class="vote-wait">${tx('Their call', 'Keputusan mereka')}</span>` : ''}
        </div>`
      : '';
    const subtitle = id === 'mission'
      ? tx(`${money(m.cost.total)} of ${money(m.cost.cap)} · ${num(m.schedule.devMonths)} of ${m.schedule.deadline} months`,
        `${money(m.cost.total)} dari ${money(m.cost.cap)} · ${num(m.schedule.devMonths)} dari ${m.schedule.deadline} bulan`)
      : r.segment;
    return `<li class="poll-row st-${auto}">
      <div class="poll-light" aria-hidden="true"><span></span></div>
      <div class="poll-who">
        <span class="poll-icon role-${id}">${icon(ROLE_ICON[id], { size: 20 })}</span>
        <div><p class="poll-title">${esc(id === 'mission' ? tx('Flight Director: budget & schedule', 'Flight Director: anggaran & jadwal') : r.title)}</p>
        <p class="muted small">${esc(subtitle)}${player ? ` · ${esc(player)}` : ''}</p></div>
      </div>
      <div class="poll-status">${statusPill(auto)}</div>
      <div class="poll-detail">
        ${missing.length ? `<p class="small">${icon('clock', { size: 13 })} ${tx('Still to choose:', 'Belum dipilih:')} ${missing.map(esc).join(', ')}</p>` : ''}
        ${issues.length ? `<ul class="issues compact">${issues.map(issueItem).join('')}</ul>` : missing.length ? '' : `<p class="small muted">${icon('check', { size: 13 })} ${tx('No open issues.', 'Tidak ada masalah terbuka.')}</p>`}
      </div>
      ${voteCtrl}
    </li>`;
  }).join('');

  const incomplete = !m.complete;
  const nogoRoles = [...ROLE_IDS, 'mission'].filter((id) => m.roles[id].status === 'nogo');
  const cautionRoles = [...ROLE_IDS, 'mission'].filter((id) => m.roles[id].status === 'caution');
  let summary;
  let cta;
  const launchLabel = tx('Launch', 'Luncurkan');
  if (incomplete) {
    const n = m.missing.length;
    summary = `<p class="poll-summary st-incomplete">${icon('clock')} ${tx(`The design is not finished: ${n} choice${n > 1 ? 's' : ''} still open.`, `Desain belum selesai: ${n} pilihan belum diisi.`)}</p>`;
    cta = `<button type="button" class="btn btn-primary btn-lg" disabled>${icon('rocket')}<span>${launchLabel}</span></button>`;
  } else if (team) {
    const allVoted = ROLE_IDS.every((id) => state.votes[id]);
    const allGo = ROLE_IDS.every((id) => state.votes[id] === 'go');
    summary = allGo
      ? `<p class="poll-summary st-go">${icon('check')} ${tx('All stations GO.', 'Semua stasiun GO.')}${nogoRoles.length
        ? tx(` Note: the automated checks still flag ${nogoRoles.length} NO-GO item${nogoRoles.length > 1 ? 's' : ''}. You are overriding them as a team.`, ` Catatan: pemeriksaan otomatis masih menandai ${nogoRoles.length} item NO-GO. Kalian mengabaikannya sebagai tim.`)
        : tx(' Cleared for launch.', ' Siap diluncurkan.')}</p>`
      : `<p class="poll-summary ${allVoted ? 'st-nogo' : 'st-incomplete'}">${icon(allVoted ? 'x' : 'users')} ${allVoted
        ? tx('At least one station called NO-GO. Go back and fix it together.', 'Setidaknya satu stasiun menyatakan NO-GO. Kembali dan perbaiki bersama.')
        : tx('Each lead must call GO or NO-GO for their station.', 'Setiap pimpinan harus menyatakan GO atau NO-GO untuk stasiunnya.')}</p>`;
    cta = `<button type="button" class="btn btn-primary btn-lg" data-action="launch" ${allGo && lead ? '' : 'disabled'} data-focus="launch">${icon('rocket')}<span>${launchLabel}</span></button>`;
  } else {
    const clean = nogoRoles.length === 0;
    summary = clean
      ? `<p class="poll-summary st-go">${icon('check')} ${tx('All stations GO', 'Semua stasiun GO')}${cautionRoles.length ? tx(`, with cautions from ${cautionRoles.map((r) => roleMeta(r).name).join(', ')}`, `, dengan catatan waspada dari ${cautionRoles.map((r) => roleMeta(r).name).join(', ')}`) : ''}. ${tx('Cleared for launch.', 'Siap diluncurkan.')}</p>`
      : `<p class="poll-summary st-nogo">${icon('alert')} ${tx(`${nogoRoles.length} station${nogoRoles.length > 1 ? 's' : ''} report${nogoRoles.length === 1 ? 's' : ''} NO-GO. You can still launch as Flight Director, but each override costs discipline points, and the flight will show the consequences.`,
        `${nogoRoles.length} stasiun melapor NO-GO. Sebagai Flight Director kamu tetap bisa meluncur, tapi setiap pengabaian mengurangi poin disiplin, dan penerbangan akan menunjukkan akibatnya.`)}</p>`;
    cta = `<button type="button" class="btn ${clean ? 'btn-primary' : 'btn-danger'} btn-lg" data-action="launch" data-focus="launch">${icon('rocket')}<span>${clean ? launchLabel : tx('Override and launch', 'Abaikan dan luncurkan')}</span></button>`;
  }

  return `${topBar(state, ctx, 'gonogo')}
  <main class="page gonogo" id="main">
    <div class="page-head">
      <p class="eyebrow">${tx('Launch readiness review', 'Tinjauan kesiapan peluncuran')}</p>
      <h1>${tx('Go/No-Go poll', 'Poll Go/No-Go')}</h1>
      <p class="lede">${tx('Before every launch, the Flight Director polls each station.', 'Sebelum setiap peluncuran, Flight Director menanyai setiap stasiun.')} ${team
    ? tx('Each lead calls GO only if they are confident in their part of the mission.', 'Setiap pimpinan menyatakan GO hanya jika yakin dengan bagian misinya.')
    : tx('Here is what each of your four stations reports.', 'Berikut laporan dari keempat stasiunmu.')}</p>
    </div>
    <ol class="poll">${rows}</ol>
    ${summary}
    <div class="poll-cta">
      <button type="button" class="btn btn-secondary btn-lg" data-action="go" data-screen="design" data-focus="back-design" ${online && !lead ? 'disabled' : ''}>${icon('left')}<span>${tx('Back to the design room', 'Kembali ke ruang desain')}</span></button>
      ${cta}
    </div>
  </main>`;
}
